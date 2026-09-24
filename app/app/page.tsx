"use client";

import { useEffect, useRef, useState } from "react";
import { SAMPLE, PRESETS, type Preset } from "@/lib/engine/sample";
import type { ProductionSheet, Variation } from "@/lib/engine/schema";
import { pullListCsv, sheetText, downloadText, safeFileName } from "@/lib/export";
import { costSheet, type PriceItem } from "@/lib/prices";
import { getStore, type KitchenStore, type SavedRecipe, type SheetHistoryEntry, type KitchenNote, type VerifiedYieldItem } from "@/lib/store";
import { downloadBackup, restoreBackup } from "@/lib/backup";
import { validateSheet, checksHeadline } from "@/lib/engine/validate";
import { buildHaccp, haccpText, KIND_MEANING, type HaccpPlan, type ControlKind } from "@/lib/engine/haccp";
import { estimateNutrition, type NutritionEstimate } from "@/lib/engine/nutrition";
import { buildPrepList, buildSop, opsDocText, type OpsDoc } from "@/lib/engine/ops";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { TopBar } from "@/components/TopBar";
import { downscaleImage } from "@/lib/image";
import { LABEL, LABEL_INLINE, FIELD, fieldCls, CHIP, chip, PRIMARY, H2, NOTE_WARN, Section, Dot } from "@/components/paper";

type ApiReply = {
  ok?: boolean;
  error?: string;
  sheet?: unknown;
  demo?: boolean;
  note?: string;
  result?: { variations?: unknown };
  ms?: number;
  engine?: string;
  knowledge?: string[];
  fields?: string[];
  yieldsUsed?: string[];
};

/** Parse an API reply; a platform error page (timeout, crash) becomes one plain sentence, not a JSON parser error. */
async function readJson(res: Response): Promise<ApiReply> {
  const text = await res.text();
  try {
    return JSON.parse(text) as ApiReply;
  } catch {
    if (res.status === 504 || /FUNCTION_INVOCATION_TIMEOUT|timed out/i.test(text)) {
      throw new Error("The engine took too long on this recipe — try again, or scale a shorter card.");
    }
    throw new Error(`The server returned an unexpected response (${res.status}). Try again in a moment.`);
  }
}

export default function Home() {
  const [recipeName, setRecipeName] = useState("");
  const [recipeText, setRecipeText] = useState("");
  const [basePortions, setBasePortions] = useState<string>("");
  const [targetCovers, setTargetCovers] = useState<string>("");
  const [portionSize, setPortionSize] = useState("");
  const [equipment, setEquipment] = useState("");
  const [holdingTime, setHoldingTime] = useState("");

  const [imageData, setImageData] = useState("");
  const [imageMediaType, setImageMediaType] = useState("");
  const [imageName, setImageName] = useState("");

  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [history, setHistory] = useState<SheetHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Field-level validation: what is missing, in plain words, on the field itself.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const fieldRefs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const clearFieldError = (f: Field) => setFieldErrors((m) => (m[f] ? { ...m, [f]: undefined } : m));
  const [sheet, setSheet] = useState<ProductionSheet | null>(null);
  const [demo, setDemo] = useState(false);
  const [engineNote, setEngineNote] = useState("");
  const [engineMs, setEngineMs] = useState<number | null>(null);
  const [engineLabel, setEngineLabel] = useState<string | null>(null);
  const [knowledgeUsed, setKnowledgeUsed] = useState<string[]>([]);

  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineNote, setRefineNote] = useState("");

  const [variations, setVariations] = useState<Variation[]>([]);
  const [varLoading, setVarLoading] = useState(false);

  const [kitchen, setKitchen] = useState<KitchenNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [showKitchen, setShowKitchen] = useState(false);

  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [pName, setPName] = useState("");
  const [pUnit, setPUnit] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [showPrices, setShowPrices] = useState(false);

  // Verified yields — the kitchen's own numbers, which outrank the standard tables.
  const [yields, setYields] = useState<VerifiedYieldItem[]>([]);
  const [yProduct, setYProduct] = useState("");
  const [yKind, setYKind] = useState<"trim" | "cook">("cook");
  const [yPct, setYPct] = useState("");
  const [ySource, setYSource] = useState("");
  const [showYields, setShowYields] = useState(false);
  const [yieldsUsed, setYieldsUsed] = useState<string[]>([]);

  // Lifecycle status of the library card in the form — Draft as soon as the card is edited.
  const [recipeStatus, setRecipeStatus] = useState("Draft");

  const [dataNote, setDataNote] = useState("");

  // The working-data store (browser storage, or the chef's Supabase rows).
  // Created lazily on the client — never during server prerender.
  const storeRef = useRef<KitchenStore | null>(null);
  const store = () => (storeRef.current ??= getStore());
  const [storeKind, setStoreKind] = useState<"local" | "supabase">("local");

  useEffect(() => {
    const s = store();
    setStoreKind(s.kind);
    s.recipes.list().then(setSaved).catch(() => {});
    s.history.list().then(setHistory).catch(() => {});
    s.notes.list().then(setKitchen).catch(() => {});
    s.prices.list().then(setPrices).catch(() => {});
    s.yields.list().then(setYields).catch(() => {});
    // Opened from the library ("Scale this recipe →")? Pre-fill from the data layer.
    const slug = new URLSearchParams(window.location.search).get("recipe");
    if (slug) {
      fetch(`/api/recipes/${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            loadPreset(d.recipe as Preset);
            setRecipeStatus(typeof d.recipe.status === "string" ? d.recipe.status : "Draft");
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAddNote() {
    if (!newNote.trim()) return;
    try {
      setKitchen(await store().notes.add(newNote));
      setNewNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the note.");
    }
  }

  async function onAddPrice() {
    const v = Number(pPrice);
    if (!pName.trim() || !v) return;
    try {
      setPrices(await store().prices.add(pName, pUnit || "unit", v));
      setPName("");
      setPUnit("");
      setPPrice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the price.");
    }
  }

  async function onAddYield() {
    const pct = Number(yPct.replace("%", "").replace(",", "."));
    if (!yProduct.trim() || !(pct > 0) || pct > 400) {
      setError("A verified yield needs the product name and a percentage, e.g. pork shoulder · cook · 62.");
      return;
    }
    try {
      setYields(await store().yields.add({ product: yProduct, kind: yKind, pct, source: ySource }));
      setYProduct("");
      setYPct("");
      setYSource("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the yield.");
    }
  }

  function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const s = store();
        const res = await restoreBackup(s, String(reader.result));
        setSaved(await s.recipes.list());
        setHistory(await s.history.list());
        setKitchen(await s.notes.list());
        setPrices(await s.prices.list());
        setDataNote(
          `✓ Restored — ${res.recipes} recipes, ${res.prices} prices, ${res.yields} yields, ${res.kitchen} kitchen notes, ${res.history} sheets.`
        );
      } catch (err) {
        setDataNote(err instanceof Error ? err.message : "Couldn't read that backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // let the same file be picked again
  }

  function loadSample() {
    setRecipeStatus("Draft");
    setRecipeName("Mexican Rice");
    setRecipeText(SAMPLE.recipeText);
    setBasePortions(String(SAMPLE.basePortions));
    setTargetCovers(String(SAMPLE.targetCovers));
    setPortionSize(SAMPLE.portionSize);
    setEquipment(SAMPLE.equipment || "");
    setHoldingTime(SAMPLE.holdingTime || "");
    clearImage();
    setSheet(null);
    setError("");
  }

  function loadPreset(p: Preset) {
    setRecipeStatus("Draft");
    setRecipeName(p.name);
    setRecipeText(p.recipeText);
    setBasePortions(String(p.basePortions));
    setPortionSize(p.portionSize);
    setEquipment(p.equipment || "");
    setHoldingTime(p.holdingTime || "");
    clearImage();
    setSheet(null);
    setError("");
  }

  function clearImage() {
    setImageData("");
    setImageMediaType("");
    setImageName("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same photo be picked again
    if (!file) return;
    try {
      // Phone photos are far over the upload limit — shrink them here first.
      const { dataBase64, mediaType, bytes } = await downscaleImage(file);
      setImageData(dataBase64);
      setImageMediaType(mediaType);
      setImageName(`${file.name} · ${Math.max(1, Math.round(bytes / 1024))} KB`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that photo.");
    }
  }

  /** Check the inputs before calling the engine: highlight + focus what is missing, in plain words. */
  function checkInputs(required: Field[]): boolean {
    const isPositive = (s: string) => /^\s*\d+([.,]\d+)?\s*$/.test(s) && Number(s.replace(",", ".")) > 0;
    const missing = required.filter((f) =>
      f === "recipeName" ? !recipeName.trim()
        : f === "recipeText" ? !recipeText.trim() && !imageData
        : f === "basePortions" ? !isPositive(basePortions)
        : f === "targetCovers" ? !isPositive(targetCovers)
        : !portionSize.trim()
    );
    setFieldErrors(Object.fromEntries(missing.map((f) => [f, FIELD_HELP[f]])));
    if (missing.length === 0) return true;
    setError(`Fill in the highlighted field${missing.length > 1 ? "s" : ""}: ${missing.map((f) => FIELD_LABEL[f]).join(", ")}.`);
    const first = fieldRefs.current[missing[0]];
    first?.focus();
    first?.select(); // a wrong value is replaced by whatever they type next
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
    return false;
  }

  /** The server names the fields it rejected — highlight them the same way. */
  function showFieldErrors(fields: string[] | undefined) {
    const known = (fields || []).filter((f): f is Field => f in FIELD_HELP);
    if (known.length === 0) return;
    setFieldErrors(Object.fromEntries(known.map((f) => [f, FIELD_HELP[f]])));
    fieldRefs.current[known[0]]?.focus();
  }

  async function onSave() {
    if (!checkInputs(["recipeName", "recipeText", "basePortions", "portionSize"])) return;
    // Same name as a saved recipe = an update. Ask before replacing a card that differs.
    const existing = saved.find((r) => r.name.trim().toLowerCase() === recipeName.trim().toLowerCase());
    if (
      existing &&
      (existing.recipeText !== recipeText || existing.basePortions !== Number(basePortions) || existing.portionSize !== portionSize) &&
      !window.confirm(`"${existing.name}" is already in your library. Replace it with this version?\n\nThe saved card will be overwritten.`)
    ) {
      return;
    }
    setError("");
    try {
      setSaved(
        await store().recipes.save({
          name: recipeName.trim(),
          recipeText,
          basePortions: Number(basePortions),
          portionSize,
          equipment,
          holdingTime,
          lastCovers: Number(targetCovers) || undefined,
        })
      );
      setDataNote(
        storeKind === "supabase"
          ? `✓ Saved "${recipeName.trim()}" to your library.`
          : `✓ Saved "${recipeName.trim()}" on this device.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the recipe.");
    }
  }

  function loadSaved(r: SavedRecipe) {
    setRecipeStatus(r.status || "Draft");
    setRecipeName(r.name);
    setRecipeText(r.recipeText);
    setBasePortions(String(r.basePortions));
    setTargetCovers(r.lastCovers ? String(r.lastCovers) : "");
    setPortionSize(r.portionSize);
    setEquipment(r.equipment || "");
    setHoldingTime(r.holdingTime || "");
    clearImage();
    setSheet(null);
    setError("");
  }

  function onDelete(id: string) {
    store()
      .recipes.remove(id)
      .then(setSaved)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't delete the recipe."));
  }

  async function onScale() {
    if (!checkInputs(["recipeText", "basePortions", "targetCovers", "portionSize"])) return;
    setLoading(true);
    setError("");
    setSheet(null);
    try {
      const res = await fetch("/api/scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: recipeName,
          recipeText,
          basePortions: Number(basePortions),
          targetCovers: Number(targetCovers),
          portionSize,
          equipment,
          holdingTime,
          image: imageData ? { dataBase64: imageData, mediaType: imageMediaType } : undefined,
          kitchenNotes: kitchen.filter((n) => n.active !== false).map((n) => n.text),
          yields: yields.map(({ product, kind, pct, source, verifiedOn }) => ({ product, kind, pct, source, verifiedOn })),
          recipeStatus: recipeStatus !== "Draft" ? recipeStatus : undefined,
        }),
      });
      const data = await readJson(res);
      if (!data.ok) {
        showFieldErrors(data.fields);
        throw new Error(data.error || "Failed to scale.");
      }
      const s = data.sheet as ProductionSheet;
      setSheet(s);
      setDemo(!!data.demo);
      setEngineNote(typeof data.note === "string" ? data.note : "");
      setEngineMs(typeof data.ms === "number" ? data.ms : null);
      setEngineLabel(typeof data.engine === "string" ? data.engine : null);
      setKnowledgeUsed(Array.isArray(data.knowledge) ? data.knowledge : []);
      setYieldsUsed(Array.isArray(data.yieldsUsed) ? data.yieldsUsed : []);
      setRefineNote("");
      store().history.add(s.dish, s.targetYield.covers, s).then(setHistory).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function onRefine() {
    if (!sheet || !refineText.trim()) return;
    setRefining(true);
    setRefineNote("");
    setError("");
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet, instruction: refineText }),
      });
      const data = await readJson(res);
      if (!data.ok) throw new Error(data.error || "Failed to refine.");
      if (data.note) {
        setRefineNote(data.note);
      } else {
        const s = data.sheet as ProductionSheet;
        setSheet(s);
        setRefineText("");
        store().history.add(s.dish, s.targetYield.covers, s).then(setHistory).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRefining(false);
    }
  }

  function loadHistoryEntry(e: SheetHistoryEntry) {
    setSheet(e.sheet as ProductionSheet);
    setRefineNote("");
    setError("");
    setEngineMs(null);
    setEngineLabel(null);
    setKnowledgeUsed([]);
    setYieldsUsed([]);
  }

  async function onVariations() {
    if (!recipeName.trim() && !recipeText.trim()) {
      setError("Add a recipe name or recipe first (or Load sample), then get variations.");
      return;
    }
    setVarLoading(true);
    setError("");
    setVariations([]);
    try {
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish: recipeName, recipeText, portionSize, equipment }),
      });
      const data = await readJson(res);
      if (!data.ok) throw new Error(data.error || "Failed to get variations.");
      const vs = (data.result?.variations || []) as Variation[];
      setVariations(vs);
      if (vs.length === 0 && data.note) setError(data.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setVarLoading(false);
    }
  }

  function useVariation(v: Variation) {
    setRecipeStatus("Draft");
    setRecipeName(v.name);
    setRecipeText(v.recipeText);
    setBasePortions(String(v.basePortions));
    setPortionSize(v.portionSize);
    clearImage();
    setVariations([]);
    setSheet(null);
    setError("");
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="scaler" signOut={isSupabaseConfigured()} />

      <main className="mx-auto max-w-[100rem] px-4 py-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10 lg:px-8 print:block">
        {/* Left pane — the recipe. Stays put while the sheet on the right scrolls. */}
        <aside className="no-print lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:pb-6 lg:pr-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Production scaler</h1>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={loadSample} className={CHIP}>Load sample</button>
              <button onClick={onSave} className={CHIP}>{storeKind === "supabase" ? "Save to library" : "Save recipe"}</button>
              <button onClick={onVariations} disabled={varLoading} className={`${CHIP} disabled:opacity-50`}>
                {varLoading ? "Thinking…" : "Variations"}
              </button>
            </div>
          </div>
          {dataNote && <p className="mt-2 text-xs font-semibold text-ink-2">{dataNote}</p>}

          {storeKind !== "supabase" && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className={LABEL_INLINE}>His recipes</span>
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => loadPreset(p)} className={CHIP}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {saved.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className={LABEL_INLINE}>{storeKind === "supabase" ? "Your library" : "Saved"}</span>
              {saved.slice(0, 8).map((r) => (
                <span key={r.id} className="inline-flex items-center rounded-md border border-line-2 text-xs">
                  <button onClick={() => loadSaved(r)} className="py-1 pl-2.5 pr-1.5 font-semibold hover:bg-accent-soft">{r.name}</button>
                  <button onClick={() => onDelete(r.id)} className="px-1.5 py-1 text-ink-3 hover:text-danger" aria-label={`Delete ${r.name}`}>×</button>
                </span>
              ))}
              {saved.length > 8 && (
                <a href="/library" className="text-xs font-semibold underline underline-offset-2">
                  +{saved.length - 8} more in library →
                </a>
              )}
            </div>
          )}

          <div className="mt-4">
            <label className={LABEL}>Recipe name</label>
            <input ref={(el) => { fieldRefs.current.recipeName = el; }} className={`${fieldCls(!!fieldErrors.recipeName)} font-semibold`} placeholder={fieldErrors.recipeName || "Chicken Jambalaya"} value={recipeName} onChange={(e) => { setRecipeName(e.target.value); clearFieldError("recipeName"); }} />
          </div>
          <div className="mt-3">
            <label className={LABEL}>Recipe — as written on the card</label>
            <textarea ref={(el) => { fieldRefs.current.recipeText = el; }} className={`${fieldCls(!!fieldErrors.recipeText)} h-44 font-mono-ui text-sm`} placeholder={fieldErrors.recipeText || "Paste a standardized recipe here… (or add a photo below)"} value={recipeText} onChange={(e) => { setRecipeText(e.target.value); clearFieldError("recipeText"); setRecipeStatus("Draft"); }} />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <label className={`${CHIP} cursor-pointer`}>
              Add photo of a recipe
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            {imageName && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                {imageName}
                <button onClick={clearImage} className="px-1 text-ink-3 hover:text-ink" aria-label="Remove photo">×</button>
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Base portions</label>
              <input ref={(el) => { fieldRefs.current.basePortions = el; }} className={fieldCls(!!fieldErrors.basePortions)} inputMode="numeric" placeholder={fieldErrors.basePortions || "50"} value={basePortions} onChange={(e) => { setBasePortions(e.target.value); clearFieldError("basePortions"); setRecipeStatus("Draft"); }} />
            </div>
            <div>
              <label className={LABEL}>Target covers</label>
              <input ref={(el) => { fieldRefs.current.targetCovers = el; }} className={fieldCls(!!fieldErrors.targetCovers)} inputMode="numeric" placeholder={fieldErrors.targetCovers || "850"} value={targetCovers} onChange={(e) => { setTargetCovers(e.target.value); clearFieldError("targetCovers"); }} />
            </div>
            <div>
              <label className={LABEL}>Portion size</label>
              <input ref={(el) => { fieldRefs.current.portionSize = el; }} className={fieldCls(!!fieldErrors.portionSize)} placeholder={fieldErrors.portionSize || "10 oz"} value={portionSize} onChange={(e) => { setPortionSize(e.target.value); clearFieldError("portionSize"); setRecipeStatus("Draft"); }} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Equipment</label>
              <input className={FIELD} placeholder="tilt skillet, combi, 40-gal kettle" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Hold time</label>
              <input className={FIELD} placeholder="2 hours" value={holdingTime} onChange={(e) => setHoldingTime(e.target.value)} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={LABEL_INLINE}>Quick count</span>
            {[100, 200, 400, 800, 1200].map((c) => (
              <button key={c} onClick={() => { setTargetCovers(String(c)); clearFieldError("targetCovers"); }} className={chip(targetCovers === String(c))}>
                {c}
              </button>
            ))}
          </div>

          <button onClick={onScale} disabled={loading} className={`${PRIMARY} mt-4 w-full py-3.5 text-base`}>
            {loading ? "Scaling…" : "Scale recipe →"}
          </button>
          {error && <p className="mt-3 border-l-4 border-danger bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{error}</p>}

          {/* The small tools, under a rule: kitchen memory, prices, backup */}
          <div className="mt-6 border-t border-line-2 pt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
              <button onClick={() => setShowKitchen((s) => !s)} className={toolCls(showKitchen)}>Kitchen memory ({kitchen.filter((n) => n.active !== false).length})</button>
              <button onClick={() => setShowYields((s) => !s)} className={toolCls(showYields)}>Yields ({yields.length})</button>
              <button onClick={() => setShowPrices((s) => !s)} className={toolCls(showPrices)}>Prices ({prices.length})</button>
              <button onClick={() => downloadBackup(store()).catch(() => setDataNote("Couldn't build the backup."))} title="Save all your recipes, prices and notes to a file" className={toolCls(false)}>
                Backup
              </button>
              <label title="Restore from a backup file (merges — nothing is deleted)" className={`${toolCls(false)} cursor-pointer`}>
                Restore
                <input type="file" accept="application/json,.json" className="hidden" onChange={onRestoreFile} />
              </label>
            </div>

            {showKitchen && (
              <div className="mt-3">
                <div className="text-sm font-semibold">Kitchen memory — the learning loop</div>
                <p className="mt-0.5 text-xs text-ink-2">
                  Corrections about YOUR kitchen, sent with every scale and listed on the sheet they shaped. e.g. &quot;my combi yields 48%, not 45%&quot; · &quot;use 10 oz garlic at 800, not 12&quot;. Delete a note to stop applying it.
                </p>
                <div className="mt-2 flex gap-2">
                  <input className={FIELD} placeholder="Add a correction…" value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onAddNote(); }} />
                  <button onClick={onAddNote} className={`${PRIMARY} whitespace-nowrap px-4 py-2 text-sm`}>Add</button>
                </div>
                {kitchen.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {kitchen.map((n) => (
                      <li key={n.id} className={`flex items-start justify-between gap-2 border-b border-line py-1.5 ${n.active === false ? "text-ink-3" : ""}`}>
                        <span>
                          {n.text}
                          {n.active === false && <span className="ml-2 text-[11px] font-bold uppercase tracking-wider text-ink-3">paused</span>}
                          {n.addedAt && <span className="ml-2 whitespace-nowrap text-xs text-ink-3">{n.addedAt}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => store().notes.setActive(n.id, n.active === false).then(setKitchen).catch((e) => setError(e instanceof Error ? e.message : "Couldn't update the note."))}
                            className="px-1 text-xs font-semibold text-ink-2 underline-offset-2 hover:underline"
                          >
                            {n.active === false ? "resume" : "pause"}
                          </button>
                          <button onClick={() => store().notes.remove(n.id).then(setKitchen).catch(() => {})} className="px-1 text-ink-3 hover:text-danger" aria-label="Remove">×</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {showPrices && (
              <div className="mt-3">
                <div className="text-sm font-semibold">Price list — real food cost</div>
                <p className="mt-0.5 text-xs text-ink-2">Your supplier prices, used to estimate food cost on each sheet. (Approximate — verify units.)</p>
                <div className="mt-2 grid grid-cols-[1fr_4rem_4.5rem_auto] gap-2">
                  <input className={FIELD} placeholder="Ingredient" value={pName} onChange={(e) => setPName(e.target.value)} />
                  <input className={FIELD} placeholder="unit" value={pUnit} onChange={(e) => setPUnit(e.target.value)} />
                  <input className={FIELD} inputMode="decimal" placeholder="$/unit" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
                  <button onClick={onAddPrice} className={`${PRIMARY} px-4 py-2 text-sm`}>Add</button>
                </div>
                {prices.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {prices.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5">
                        <span><span className="font-semibold">{p.name}</span> — ${p.price.toFixed(2)} / {p.unit}</span>
                        <button onClick={() => store().prices.remove(p.id).then(setPrices).catch(() => {})} className="px-1 text-ink-3 hover:text-danger" aria-label="Remove">×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {showYields && (
              <div className="mt-3">
                <div className="text-sm font-semibold">Verified yields — your numbers outrank the standard tables</div>
                <p className="mt-0.5 text-xs text-ink-2">
                  From a test batch or a supplier spec. <span className="font-semibold text-ink-2">Trim</span> = usable ÷ as-purchased; <span className="font-semibold text-ink-2">cook</span> = cooked ÷ raw. Name the product as the card does (e.g. pork shoulder · cook · 62).
                </p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] gap-2">
                  <input className={FIELD} placeholder="Product, as on the card" value={yProduct} onChange={(e) => setYProduct(e.target.value)} />
                  <select className={FIELD} value={yKind} onChange={(e) => setYKind(e.target.value as "trim" | "cook")} aria-label="Kind">
                    <option value="cook">cook</option>
                    <option value="trim">trim</option>
                  </select>
                  <input className={FIELD} inputMode="decimal" placeholder="%" value={yPct} onChange={(e) => setYPct(e.target.value)} />
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input className={FIELD} placeholder="Source — test batch 9/20, Sysco spec…" value={ySource} onChange={(e) => setYSource(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onAddYield(); }} />
                  <button onClick={onAddYield} className={`${PRIMARY} px-4 py-2 text-sm`}>Add</button>
                </div>
                {store().kind === "supabase" && store().needsMigration && (
                  <p className={`${NOTE_WARN} mt-2 text-xs`}>To keep yields, run <span className="font-semibold">supabase/migrations/0003_yields_versions_pause.sql</span> in the Supabase SQL editor once, then reload.</p>
                )}
                {yields.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {yields.map((y) => (
                      <li key={y.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5">
                        <span>
                          <span className="font-semibold">{y.product}</span> · {y.kind} {y.pct}%
                          {y.source && <span className="text-ink-2"> · {y.source}</span>}
                          {y.verifiedOn && <span className="ml-2 whitespace-nowrap text-xs text-ink-3">{y.verifiedOn}</span>}
                        </span>
                        <button onClick={() => store().yields.remove(y.id).then(setYields).catch(() => {})} className="px-1 text-ink-3 hover:text-danger" aria-label="Remove">×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right pane — the production sheet, a ruled document */}
        <section className="mt-8 min-w-0 lg:mt-0 lg:border-l lg:border-ink lg:pl-10 print:mt-0 print:border-0 print:pl-0">
          {variations.length > 0 && (
            <div className="no-print mb-8">
              <h2 className={H2}>Variations — pick one to scale</h2>
              <ul className="mt-1 divide-y divide-line border-t border-ink">
                {variations.map((v, i) => (
                  <li key={i} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {v.name}
                        {v.tags && v.tags.length > 0 && <span className="ml-2 text-xs font-semibold text-warn">{v.tags.join(" · ")}</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-2">{v.summary}</p>
                    </div>
                    <button onClick={() => useVariation(v)} className={CHIP}>Use this →</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loading && <LoadingSkeleton />}

          {!loading && !sheet && (
            <EmptyState
              hasRecipe={!!recipeText.trim() || !!imageData}
              history={history}
              onOpen={loadHistoryEntry}
              onRemove={(id) => store().history.remove(id).then(setHistory).catch(() => {})}
            />
          )}

          {sheet && (demo || sheet.source === "estimate") && (
            <p className="no-print mb-6 border-l-4 border-warn bg-warn-soft px-3 py-2 text-sm">
              {engineNote ? (
                <>
                  <span className="font-bold">Built-in estimate</span> — {engineNote}
                </>
              ) : !demo ? (
                <>
                  <span className="font-bold">Built-in estimate</span> — this sheet was made by the built-in scaler while the chef-logic engine was unavailable (see Assumptions). Scale it again for the engine&apos;s version.
                </>
              ) : (
                <>
                  <span className="font-bold">Demo preview</span> — a rough linear+dampening estimate for{" "}
                  <span className="font-bold">{sheet.dish}</span> (no AI yet). Add the API key to unlock the full
                  chef-logic engine on <span className="font-bold">any</span> recipe.
                </>
              )}
            </p>
          )}

          {sheet && <Sheet sheet={sheet} prices={prices} engineMs={demo ? null : engineMs} engineLabel={demo ? null : engineLabel} knowledge={demo ? [] : knowledgeUsed} verified={demo ? [] : yieldsUsed} />}

          {sheet && (
            <section className="no-print mt-8 border-t border-ink pt-3">
              <h3 className={H2}>Refine this sheet</h3>
              <div className="mt-2 flex gap-2">
                <input className={FIELD} placeholder='e.g. "drop to 400 covers" · "make it vegetarian" · "less spicy"' value={refineText} onChange={(e) => setRefineText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onRefine(); }} />
                <button onClick={onRefine} disabled={refining || !refineText.trim()} className={`${PRIMARY} whitespace-nowrap px-5 py-2 text-sm`}>
                  {refining ? "Updating…" : "Update"}
                </button>
              </div>
              {refineNote && <p className="mt-2 border-l-4 border-warn bg-warn-soft px-3 py-2 text-sm">{refineNote}</p>}
            </section>
          )}

          {sheet && history.length > 0 && (
            <RecentSheets history={history} onOpen={loadHistoryEntry} onRemove={(id) => store().history.remove(id).then(setHistory).catch(() => {})} />
          )}
        </section>
      </main>
    </div>
  );
}

/** The inputs the engine needs, and what to tell a cook when one is missing. */
type Field = "recipeName" | "recipeText" | "basePortions" | "targetCovers" | "portionSize";
const FIELD_LABEL: Record<Field, string> = {
  recipeName: "Recipe name",
  recipeText: "Recipe",
  basePortions: "Base portions",
  targetCovers: "Target covers",
  portionSize: "Portion size",
};
/** Shown inside the field itself (as its placeholder) when it is missing. Short — the fields are narrow. */
const FIELD_HELP: Record<Field, string> = {
  recipeName: "Enter a recipe name",
  recipeText: "Paste the recipe here, or add a photo below",
  basePortions: "Enter a number, e.g. 50",
  targetCovers: "Enter a number, e.g. 400",
  portionSize: "e.g. 6 oz or 2 tacos",
};

const toolCls = (active: boolean) =>
  active ? "text-ink underline underline-offset-4" : "text-ink-2 underline-offset-4 hover:text-ink hover:underline";

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-1/3 rounded-md bg-accent-soft" />
      <div className="mt-2 h-3 w-1/2 rounded-md bg-accent-soft" />
      <div className="mt-6 space-y-2.5 border-t border-ink pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3 w-full rounded-md bg-accent-soft" />
        ))}
      </div>
      <p className="mt-4 text-xs font-semibold text-ink-3">Scaling with chef logic — batching &amp; holding included… (a long card can take up to a minute)</p>
    </div>
  );
}

function EmptyState({
  hasRecipe,
  history,
  onOpen,
  onRemove,
}: {
  hasRecipe: boolean;
  history: SheetHistoryEntry[];
  onOpen: (e: SheetHistoryEntry) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="no-print">
      <h2 className={H2}>Production sheet</h2>
      <p className="mt-2 border-t border-ink pt-3 text-sm text-ink-2">
        {hasRecipe ? (
          <>
            Set today&apos;s covers and tap <span className="font-bold text-ink">Scale recipe</span>. The sheet appears here — scaled amounts, batching, holding, pull list and accuracy checks.
          </>
        ) : (
          <>
            New here? Tap <span className="font-bold text-ink">Load sample</span>, then <span className="font-bold text-ink">Scale recipe</span> to see a full production sheet — scaled amounts, batching, hot-line holding, and a pull list.
          </>
        )}
      </p>
      {history.length > 0 && <RecentSheets history={history} onOpen={onOpen} onRemove={onRemove} />}
    </div>
  );
}

function RecentSheets({
  history,
  onOpen,
  onRemove,
}: {
  history: SheetHistoryEntry[];
  onOpen: (e: SheetHistoryEntry) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="no-print mt-8">
      <h2 className={H2}>Recent sheets</h2>
      <ul className="mt-1 divide-y divide-line border-t border-ink text-sm">
        {history.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 py-2">
            <button onClick={() => onOpen(h)} className="text-left underline-offset-2 hover:underline">
              <span className="font-semibold">{h.dish}</span> · {h.covers} covers <span className="text-ink-3">· {h.savedAt}</span>
            </button>
            <button onClick={() => onRemove(h.id)} className="px-1 text-ink-3 hover:text-danger" aria-label={`Delete ${h.dish}`}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sheet({
  sheet,
  prices,
  engineMs,
  engineLabel,
  knowledge,
  verified,
}: {
  sheet: ProductionSheet;
  prices: PriceItem[];
  engineMs: number | null;
  engineLabel: string | null;
  knowledge: string[];
  verified: string[];
}) {
  const [copied, setCopied] = useState(false);
  const costing = prices.length > 0 ? costSheet(sheet, prices) : null;
  const checks = validateSheet(sheet);
  const headline = checksHeadline(checks);
  const [showHaccp, setShowHaccp] = useState(false);
  const haccp = showHaccp ? buildHaccp(sheet) : null;
  const nutrition = estimateNutrition(sheet);
  const [showPrep, setShowPrep] = useState(false);
  const [showSop, setShowSop] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(sheetText(sheet));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="sheet-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-2xl font-semibold leading-tight">{sheet.dish}</h2>
        <span
          className="rounded-md border border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          title="Recipe lifecycle: a generated sheet is a draft until a kitchen test records its actual yield."
        >
          {sheet.status || "Draft"}
          {(sheet.status || "Draft") === "Draft" ? " · not yet tested" : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {sheet.baseYield.portions} portions → <span className="font-semibold text-ink">{sheet.targetYield.covers} covers</span> @ {sheet.targetYield.portionSize}
        {" · "}finished yield <span className="font-semibold text-ink">{sheet.targetYield.finishedYield}</span>
      </p>
      {(engineLabel || engineMs != null) && (
        <p
          className="no-print mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3"
          title={[knowledge.length ? `Knowledge Pack sections applied: ${knowledge.join(" · ")}` : "", verified.length ? `Verified yields used: ${verified.join(" · ")}` : ""].filter(Boolean).join(" — ") || undefined}
        >
          {engineLabel || "chef-logic engine"}
          {engineMs != null ? ` · ${(engineMs / 1000).toFixed(0)} s` : ""}
          {knowledge.length ? ` · knowledge pack: ${knowledge.length} sections` : ""}
          {verified.length ? ` · ${verified.length} verified yield${verified.length === 1 ? "" : "s"}` : ""}
        </p>
      )}

      <div className="no-print mt-3 flex flex-wrap gap-1.5">
        <button onClick={copyAll} className={CHIP}>{copied ? "✓ Copied" : "Copy"}</button>
        {sheet.pullList.length > 0 && (
          <button onClick={() => downloadText(`${safeFileName(sheet.dish)}-pull-list.csv`, pullListCsv(sheet), "text/csv;charset=utf-8")} className={CHIP}>
            Pull list (CSV)
          </button>
        )}
        <button onClick={() => window.print()} className={CHIP}>Print / PDF</button>
        <button onClick={() => setShowHaccp((s) => !s)} className={chip(showHaccp)}>HACCP summary</button>
        <button onClick={() => setShowPrep((s) => !s)} className={chip(showPrep)}>Prep list</button>
        <button onClick={() => setShowSop((s) => !s)} className={chip(showSop)}>SOP</button>
      </div>

      <Section
        title="Accuracy checks"
        aside={
          headline.status === "warn" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warn"><Dot cls="bg-warn" />{headline.warned} to review</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink"><Dot cls="bg-ink" />All checks passed</span>
          )
        }
      >
        <ul className="space-y-1.5 text-sm">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-[7px] flex shrink-0"><Dot cls={c.status === "pass" ? "bg-ink" : c.status === "warn" ? "bg-warn" : "bg-line-2"} /></span>
              <span>
                <span className="font-semibold">{c.label}</span> <span className="text-ink-2">— {c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {sheet.kitchenMemory && sheet.kitchenMemory.length > 0 && (
        <Section
          title="Kitchen memory in force"
          aside={<span className="text-xs text-ink-3">{sheet.kitchenMemory.length} correction{sheet.kitchenMemory.length === 1 ? "" : "s"} sent to the engine with this card</span>}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {sheet.kitchenMemory.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>
      )}

      {haccp && <HaccpPanel plan={haccp} />}

      <NutritionPanel est={nutrition} />

      {showPrep && <DocPanel doc={buildPrepList(sheet)} cls="prep-panel" />}
      {showSop && <DocPanel doc={buildSop(sheet)} cls="sop-panel" />}

      {costing && costing.priced > 0 && (
        <Section
          title="Estimated food cost"
          aside={
            <span className="text-xs text-ink-3">
              {costing.priced}/{sheet.pullList.length} priced{costing.mismatched > 0 ? ` · ${costing.mismatched} unit mismatch` : ""}
            </span>
          }
        >
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <div className="text-2xl font-bold">${costing.total.toFixed(2)}</div>
              <div className="text-xs text-ink-3">priced items total</div>
            </div>
            {costing.perCover != null ? (
              <div>
                <div className="text-2xl font-bold">${costing.perCover.toFixed(2)}</div>
                <div className="text-xs text-ink-3">per cover</div>
              </div>
            ) : (
              <div className="max-w-[14rem] text-xs text-ink-3">Per-cover hidden until ≥60% of the list is priced in matching units.</div>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Partial estimate — only unit-matched items counted{costing.mismatched > 0 ? "; unit mismatches excluded" : ""}. Add prices in matching units (lb/oz, gal/qt/cup, each) for a full cost.
          </p>
        </Section>
      )}

      <Section title="Scaled recipe">
        {/* Table — tablet & desktop */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[20%]" />
              <col className="w-[16%]" />
              <col className="w-[38%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-ink text-left text-[11px] font-bold uppercase tracking-wider text-ink-3">
                <th className="py-1.5 pr-3">Ingredient</th>
                <th className="py-1.5 pr-3">Scaled</th>
                <th className="py-1.5 pr-3">×</th>
                <th className="py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {sheet.ingredients.map((ing, i) => (
                <tr key={i} className="border-b border-line align-top">
                  <td className="break-words py-2 pr-3 font-semibold">{ing.item}</td>
                  <td className="break-words py-2 pr-3 font-semibold">{ing.scaledQty}</td>
                  <td className="break-words py-2 pr-3 text-ink-3">{ing.multiplier}</td>
                  <td className="break-words py-2 text-ink-2">{ing.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stacked rows — phone */}
        <ul className="divide-y divide-line border-b border-line sm:hidden">
          {sheet.ingredients.map((ing, i) => (
            <li key={i} className="py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{ing.item}</span>
                <span className="whitespace-nowrap font-bold">{ing.scaledQty}</span>
              </div>
              {(ing.multiplier || ing.note) && (
                <p className="mt-0.5 text-xs text-ink-3">
                  {ing.multiplier ? <span className="mr-2 font-semibold">{ing.multiplier}</span> : null}
                  {ing.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Block title="Batching" items={sheet.batching} />
      <Block title="Holding on the line" items={sheet.holding} />
      <PullList items={sheet.pullList} />
      <Block title="Assumptions" items={sheet.assumptions} muted />
      {sheet.allergenFlags.length > 0 && <Block title="Allergen flags" items={sheet.allergenFlags} />}
      {sheet.safetyFlags.length > 0 && <Block title="Safety & cooling" items={sheet.safetyFlags} />}

      <p className="mt-8 border-t border-line pt-3 text-[11px] text-ink-3">
        Digital Chef AI production sheet · {sheet.status || "Draft"} · Quantities, times, temperatures and allergen labels must be verified by the kitchen before service.{" "}
        <a href="/terms" className="underline underline-offset-2 hover:text-ink">Terms of use</a>
      </p>
    </article>
  );
}

function Block({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <Section title={title}>
      <ul className={`list-disc space-y-1 pl-5 text-sm ${muted ? "text-ink-3" : "text-ink-2"}`}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </Section>
  );
}

function HaccpPanel({ plan }: { plan: HaccpPlan }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(haccpText(plan));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  const kindCls: Record<ControlKind, string> = {
    CCP: "bg-ink text-card",
    CP: "border border-ink text-ink",
    QCP: "bg-warn-soft text-warn",
  };
  const count = (k: ControlKind) => plan.entries.filter((x) => x.kind === k).length;
  const fields: { k: string; get: (x: HaccpPlan["entries"][number]) => string }[] = [
    { k: "Hazard", get: (x) => x.hazard },
    { k: "Critical limit", get: (x) => x.limit },
    { k: "Monitoring", get: (x) => x.monitor },
    { k: "Corrective action", get: (x) => x.corrective },
    { k: "Verification", get: (x) => x.verify },
    { k: "Record", get: (x) => x.record },
  ];

  return (
    <Section
      title="HACCP / CCP summary"
      className="haccp-panel"
      aside={
        <button onClick={copy} className={`no-print ${CHIP}`}>
          {copied ? "✓ Copied" : "Copy plan"}
        </button>
      }
    >
      <div className="text-xs text-ink-3">
        {count("CCP")} critical control points · {count("CP")} control points · {count("QCP")} quality point
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        {(["CCP", "CP", "QCP"] as ControlKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`rounded-md px-2 py-0.5 font-bold ${kindCls[k]}`}>{k}</span>
            {KIND_MEANING[k].split(" — ")[0]}
          </span>
        ))}
      </div>

      <ol className="mt-3 divide-y divide-line border-t border-line">
        {plan.entries.map((x, i) => (
          <li key={i} className="py-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${kindCls[x.kind]}`}>{x.kind}</span>
              <span className="font-semibold">
                {i + 1}. {x.step}
              </span>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.k}>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{f.k}</dt>
                  <dd className="text-ink-2">{f.get(x)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-ink-3">{plan.notes.join(" ")}</p>
    </Section>
  );
}

function DocPanel({ doc, cls }: { doc: OpsDoc; cls: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(opsDocText(doc));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Section
      title={doc.title}
      className={cls}
      aside={
        <button onClick={copy} className={`no-print ${CHIP}`}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      }
    >
      <div className="text-xs text-ink-3">{doc.subtitle}</div>
      <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {doc.sections.map((s) => (
          <section key={s.heading} className="border-t border-line pt-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{s.heading}</h4>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-2">
              {s.lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-ink-3">·</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Section>
  );
}

function NutritionPanel({ est }: { est: NutritionEstimate }) {
  const sodiumCls: Record<NutritionEstimate["sodiumLevel"], string> = {
    low: "text-ink",
    moderate: "text-ink",
    high: "text-warn",
    "very high": "text-danger",
  };
  const p = est.perPortion;
  const r0 = (n: number) => String(Math.round(n));
  const notCounted = [...est.skipped, ...est.unmatched];
  const tiles: { k: string; v: string; sub?: string }[] = [
    { k: "Calories", v: r0(p.kcal), sub: "kcal" },
    { k: "Protein", v: r0(p.protein), sub: "g" },
    { k: "Carbs", v: r0(p.carbs), sub: "g" },
    { k: "Fat", v: r0(p.fat), sub: "g" },
    { k: "Fiber", v: r0(p.fiber), sub: "g" },
    { k: "Sodium", v: r0(p.sodiumMg), sub: "mg" },
  ];

  return (
    <Section
      title="Nutrition per portion (estimate)"
      className="nutrition-panel"
      aside={est.ok ? <span className={`text-xs font-bold ${sodiumCls[est.sodiumLevel]}`}>sodium: {est.sodiumLevel}</span> : undefined}
    >
      {est.ok ? (
        <>
          <div className="grid grid-cols-3 divide-x divide-line sm:grid-cols-6">
            {tiles.map((t) => (
              <div key={t.k} className="px-2 py-1 text-center">
                <div className="text-lg font-bold leading-tight">{t.v}</div>
                <div className="text-[11px] font-semibold text-ink-3">
                  {t.k}
                  {t.sub ? ` · ${t.sub}` : ""}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-2">
            Calories from protein {est.split.protein}% · carbs {est.split.carbs}% · fat {est.split.fat}%.
            {est.sodiumLevel === "high" || est.sodiumLevel === "very high"
              ? " Sodium is ≥20% of the 2,300 mg daily value per portion — consider a lower-sodium stock or soy sauce if this is a daily-menu item."
              : ""}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-2">
          Not enough recognizable ingredients to estimate ({est.matched} of {est.counted} matched by weight coverage {Math.round(est.coverageByWeight * 100)}%).
        </p>
      )}

      <p className="mt-2 text-xs text-ink-3">
        Based on {est.matched} of {est.counted} quantified ingredients ({Math.round(est.coverageByWeight * 100)}% by weight)
        {notCounted.length > 0 ? ` — not counted: ${notCounted.slice(0, 4).join(", ")}${notCounted.length > 4 ? "…" : ""}` : ""}.
        {est.saltToTaste ? " Salt added to taste isn't counted: 1 tsp table salt ≈ 2,300 mg sodium across the batch." : ""}{" "}
        Standard USDA-style averages on the scaled raw recipe; cooking losses not modeled. Verify against supplier nutrition facts before publishing.
      </p>
    </Section>
  );
}

function PullList({ items }: { items: ProductionSheet["pullList"] }) {
  if (!items || items.length === 0) return null;
  return (
    <Section title="Pull list — order from inventory">
      <table className="w-full text-sm">
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-1.5 pr-3 font-semibold">{it.item}</td>
              <td className="whitespace-nowrap py-1.5 pr-3 font-semibold">{it.apQty}</td>
              <td className="w-[45%] py-1.5 text-xs text-ink-3">{it.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
