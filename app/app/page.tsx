"use client";

import { useEffect, useState } from "react";
import { SAMPLE } from "@/lib/engine/sample";
import type { ProductionSheet, Variation } from "@/lib/engine/schema";
import {
  getRecipes,
  saveRecipe,
  deleteRecipe,
  getHistory,
  addToHistory,
  deleteFromHistory,
  type SavedRecipe,
  type SheetHistoryEntry,
} from "@/lib/storage";
import { pullListCsv, sheetText, downloadText, safeFileName } from "@/lib/export";
import { getKitchenNotes, addKitchenNote, removeKitchenNote, type KitchenNote } from "@/lib/kitchen";
import { getPrices, addPrice, removePrice, costSheet, type PriceItem } from "@/lib/prices";

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
  const [sheet, setSheet] = useState<ProductionSheet | null>(null);
  const [demo, setDemo] = useState(false);

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

  useEffect(() => {
    setSaved(getRecipes());
    setHistory(getHistory());
    setKitchen(getKitchenNotes());
    setPrices(getPrices());
  }, []);

  function onAddNote() {
    if (!newNote.trim()) return;
    setKitchen(addKitchenNote(newNote));
    setNewNote("");
  }

  function onAddPrice() {
    const v = Number(pPrice);
    if (!pName.trim() || !v) return;
    setPrices(addPrice(pName, pUnit || "unit", v));
    setPName("");
    setPUnit("");
    setPPrice("");
  }

  function loadSample() {
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

  function clearImage() {
    setImageData("");
    setImageMediaType("");
    setImageName("");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:image/jpeg;base64,XXXX
      const comma = result.indexOf(",");
      const meta = result.slice(0, comma);
      const data = result.slice(comma + 1);
      const mt = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
      setImageData(data);
      setImageMediaType(mt);
      setImageName(file.name);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function onSave() {
    if (!recipeName.trim() || !recipeText.trim() || !basePortions || !portionSize) {
      setError("To save: add a recipe name, the recipe, base portions, and portion size.");
      return;
    }
    setError("");
    setSaved(
      saveRecipe({
        name: recipeName.trim(),
        recipeText,
        basePortions: Number(basePortions),
        portionSize,
        equipment,
        holdingTime,
        lastCovers: Number(targetCovers) || undefined,
      })
    );
  }

  function loadSaved(r: SavedRecipe) {
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
    setSaved(deleteRecipe(id));
  }

  async function onScale() {
    if (!recipeText.trim() && !imageData) {
      setError("Paste a recipe or add a photo of one.");
      return;
    }
    setLoading(true);
    setError("");
    setSheet(null);
    try {
      const res = await fetch("/api/scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeText,
          basePortions: Number(basePortions),
          targetCovers: Number(targetCovers),
          portionSize,
          equipment,
          holdingTime,
          image: imageData ? { dataBase64: imageData, mediaType: imageMediaType } : undefined,
          kitchenNotes: kitchen.map((n) => n.text),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to scale.");
      const s = data.sheet as ProductionSheet;
      setSheet(s);
      setDemo(!!data.demo);
      setRefineNote("");
      setHistory(addToHistory(s.dish, s.targetYield.covers, s));
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
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to refine.");
      if (data.note) {
        setRefineNote(data.note);
      } else {
        const s = data.sheet as ProductionSheet;
        setSheet(s);
        setRefineText("");
        setHistory(addToHistory(s.dish, s.targetYield.covers, s));
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
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to get variations.");
      setVariations((data.result?.variations || []) as Variation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setVarLoading(false);
    }
  }

  function useVariation(v: Variation) {
    setRecipeName(v.name);
    setRecipeText(v.recipeText);
    setBasePortions(String(v.basePortions));
    setPortionSize(v.portionSize);
    clearImage();
    setVariations([]);
    setSheet(null);
    setError("");
  }

  const label = "block text-sm font-semibold text-[#3A2A1E]/70 mb-1";
  const inputCls =
    "w-full rounded-xl border-2 border-[#3A2A1E]/20 bg-[#FFFBF2] px-3 py-2.5 text-base text-[#3A2A1E] placeholder:text-[#3A2A1E]/35 focus:border-[#C24E33] focus:outline-none";
  const chipBtn = "rounded-full border-2 px-3.5 py-1.5 text-xs font-bold";

  return (
    <div className="font-techno relative min-h-screen bg-[#FCF3E3] text-[#3A2A1E]">
      <div className="noise pointer-events-none fixed inset-0 z-[60] opacity-[0.04] mix-blend-multiply no-print" aria-hidden />

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 no-print">
          <div className="mb-2 flex items-center gap-4">
            <a href="/" className="text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45 hover:text-[#C24E33]">← Home</a>
            <a href="/app/planner" className="text-xs font-bold uppercase tracking-wide text-[#51613A] hover:text-[#3f4d2d]">Cycle-menu planner →</a>
          </div>
          <h1 className="font-display text-3xl font-semibold">
            Digital Chef AI <span className="text-[#C24E33]">· Production Scaler</span>
          </h1>
          <p className="mt-1 text-sm text-[#3A2A1E]/65">
            Scale a standardized recipe to today&apos;s covers — the way a chef would.
          </p>
        </header>

        {/* Kitchen memory + Prices toolbar */}
        <div className="no-print mb-4 flex flex-wrap gap-2">
          <button onClick={() => setShowKitchen((s) => !s)} className={`${chipBtn} border-[#51613A] ${showKitchen ? "bg-[#51613A]/20" : ""} text-[#51613A] hover:bg-[#51613A]/15`}>
            🧠 Kitchen memory ({kitchen.length})
          </button>
          <button onClick={() => setShowPrices((s) => !s)} className={`${chipBtn} border-[#E9A93C] ${showPrices ? "bg-[#E9A93C]/30" : ""} text-[#8a5a12] hover:bg-[#E9A93C]/25`}>
            💲 Prices ({prices.length})
          </button>
        </div>

        {showKitchen && (
          <section className="no-print mb-4 rounded-3xl border-2 border-[#51613A] bg-[#FFFBF2] p-4 shadow-[0_6px_0_0_#3A2A1E]">
            <h3 className="font-display text-base font-semibold text-[#51613A]">🧠 Kitchen memory — the learning loop</h3>
            <p className="mt-0.5 text-xs text-[#3A2A1E]/60">
              Corrections about YOUR kitchen, applied to every scale. e.g. &quot;my combi yields 48%, not 45%&quot; · &quot;use 10 oz garlic at 800, not 12&quot;.
            </p>
            <div className="mt-3 flex gap-2">
              <input className={inputCls} placeholder="Add a correction…" value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onAddNote(); }} />
              <button onClick={onAddNote} className="whitespace-nowrap rounded-full bg-[#51613A] px-4 py-2.5 text-sm font-bold text-[#FCF3E3] hover:bg-[#3f4d2d]">Add</button>
            </div>
            {kitchen.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {kitchen.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2 rounded-xl border-2 border-[#3A2A1E]/12 bg-[#FCF3E3] px-3 py-2 text-sm">
                    <span>{n.text}</span>
                    <button onClick={() => setKitchen(removeKitchenNote(n.id))} className="shrink-0 text-[#3A2A1E]/40 hover:text-[#B0392A]" aria-label="Remove">×</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {showPrices && (
          <section className="no-print mb-4 rounded-3xl border-2 border-[#E9A93C] bg-[#FFFBF2] p-4 shadow-[0_6px_0_0_#3A2A1E]">
            <h3 className="font-display text-base font-semibold text-[#8a5a12]">💲 Price list — real food cost</h3>
            <p className="mt-0.5 text-xs text-[#3A2A1E]/60">Your supplier prices, used to estimate food cost on each sheet. (Approximate — verify units.)</p>
            <div className="mt-3 grid grid-cols-[1fr_4rem_4.5rem_auto] gap-2">
              <input className={inputCls} placeholder="Ingredient" value={pName} onChange={(e) => setPName(e.target.value)} />
              <input className={inputCls} placeholder="unit" value={pUnit} onChange={(e) => setPUnit(e.target.value)} />
              <input className={inputCls} inputMode="decimal" placeholder="$/unit" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
              <button onClick={onAddPrice} className="rounded-full bg-[#E9A93C] px-4 text-sm font-bold text-[#3A2A1E] hover:bg-[#d99a2d]">Add</button>
            </div>
            {prices.length > 0 && (
              <ul className="mt-3 space-y-1">
                {prices.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl border-2 border-[#3A2A1E]/12 bg-[#FCF3E3] px-3 py-1.5 text-sm">
                    <span><span className="font-semibold">{p.name}</span> — ${p.price.toFixed(2)} / {p.unit}</span>
                    <button onClick={() => setPrices(removePrice(p.id))} className="text-[#3A2A1E]/40 hover:text-[#B0392A]" aria-label="Remove">×</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Input card */}
        <section className="no-print rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_10px_0_0_#3A2A1E]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Recipe</h2>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={onVariations} disabled={varLoading} className={`${chipBtn} border-[#E9A93C] bg-[#E9A93C]/30 text-[#8a5a12] hover:bg-[#E9A93C]/50 disabled:opacity-50`}>
                {varLoading ? "Thinking…" : "💡 Variations"}
              </button>
              <button onClick={onSave} className={`${chipBtn} border-[#51613A] bg-[#51613A]/12 text-[#51613A] hover:bg-[#51613A]/20`}>
                Save recipe
              </button>
              <button onClick={loadSample} className={`${chipBtn} border-[#3A2A1E]/25 text-[#3A2A1E]/70 hover:bg-[#3A2A1E]/5`}>
                Load sample
              </button>
            </div>
          </div>

          {saved.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {saved.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1 rounded-full border-2 border-[#3A2A1E]/15 bg-[#FCF3E3] py-1 pl-3 pr-1 text-xs">
                  <button onClick={() => loadSaved(r)} className="font-semibold hover:text-[#C24E33]">{r.name}</button>
                  <button onClick={() => onDelete(r.id)} className="flex h-4 w-4 items-center justify-center rounded-full text-[#3A2A1E]/40 hover:bg-[#3A2A1E]/10 hover:text-[#3A2A1E]" aria-label={`Delete ${r.name}`}>×</button>
                </span>
              ))}
            </div>
          )}

          <input className={`${inputCls} mb-2`} placeholder="Recipe name (e.g. Chicken Jambalaya)" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} />

          <textarea className={`${inputCls} h-40 font-mono-ui`} placeholder="Paste a standardized recipe here... (or add a photo below)" value={recipeText} onChange={(e) => setRecipeText(e.target.value)} />

          <div className="mt-2 flex items-center gap-3">
            <label className="cursor-pointer rounded-full border-2 border-[#3A2A1E]/25 px-3.5 py-1.5 text-xs font-bold text-[#3A2A1E]/70 hover:bg-[#3A2A1E]/5">
              📷 Add photo of a recipe
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
            </label>
            {imageName && (
              <span className="inline-flex items-center gap-1 text-xs text-[#3A2A1E]/70">
                {imageName}
                <button onClick={clearImage} className="flex h-4 w-4 items-center justify-center rounded-full text-[#3A2A1E]/40 hover:bg-[#3A2A1E]/10 hover:text-[#3A2A1E]" aria-label="Remove photo">×</button>
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>Base portions</label>
              <input className={inputCls} inputMode="numeric" placeholder="50" value={basePortions} onChange={(e) => setBasePortions(e.target.value)} />
            </div>
            <div>
              <label className={label}>Target covers</label>
              <input className={inputCls} inputMode="numeric" placeholder="850" value={targetCovers} onChange={(e) => setTargetCovers(e.target.value)} />
            </div>
            <div>
              <label className={label}>Portion size</label>
              <input className={inputCls} placeholder="10 oz" value={portionSize} onChange={(e) => setPortionSize(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={label}>Equipment (optional)</label>
              <input className={inputCls} placeholder="tilt skillet, combi, 40-gal kettle" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
            </div>
            <div>
              <label className={label}>Hold time (optional)</label>
              <input className={inputCls} placeholder="2 hours" value={holdingTime} onChange={(e) => setHoldingTime(e.target.value)} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#3A2A1E]/50">Quick count:</span>
            {[100, 200, 400, 800, 1200].map((c) => (
              <button
                key={c}
                onClick={() => setTargetCovers(String(c))}
                className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${targetCovers === String(c) ? "border-[#C24E33] bg-[#C24E33]/15 text-[#C24E33]" : "border-[#3A2A1E]/20 text-[#3A2A1E]/60 hover:bg-[#3A2A1E]/5"}`}
              >
                {c}
              </button>
            ))}
          </div>

          <button onClick={onScale} disabled={loading} className="mt-4 w-full rounded-full bg-[#C24E33] px-4 py-3.5 text-sm font-bold text-[#FCF3E3] shadow-[0_6px_0_0_#A33E27] transition hover:translate-y-0.5 hover:shadow-[0_3px_0_0_#A33E27] disabled:opacity-50 disabled:shadow-none">
            {loading ? "Scaling…" : "Scale recipe →"}
          </button>

          {error && <p className="mt-3 rounded-xl border-2 border-[#B0392A]/30 bg-[#B0392A]/10 px-3 py-2 text-sm font-semibold text-[#B0392A]">{error}</p>}
        </section>

        {variations.length > 0 && (
          <section className="no-print mt-4 rounded-3xl border-2 border-[#E9A93C] bg-[#FFFBF2] p-5 shadow-[0_8px_0_0_#3A2A1E]">
            <h3 className="font-display mb-3 text-lg font-semibold text-[#8a5a12]">💡 Variations — pick one to scale</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {variations.map((v, i) => (
                <div key={i} className="flex flex-col rounded-2xl border-2 border-[#3A2A1E]/15 bg-[#FCF3E3] p-3">
                  <div className="font-display font-semibold">{v.name}</div>
                  {v.tags && v.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {v.tags.map((t, j) => (
                        <span key={j} className="rounded-full bg-[#E9A93C]/30 px-2 py-0.5 text-[11px] font-semibold text-[#8a5a12]">{t}</span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 flex-1 text-xs text-[#3A2A1E]/65">{v.summary}</p>
                  <button onClick={() => useVariation(v)} className="mt-3 rounded-full bg-[#51613A] px-3 py-1.5 text-xs font-bold text-[#FCF3E3] hover:bg-[#3f4d2d]">
                    Use this →
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {history.length > 0 && !loading && (
          <section className="no-print mt-4">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45">Recent sheets</h3>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <span key={h.id} className="inline-flex items-center gap-1 rounded-full border-2 border-[#3A2A1E]/15 bg-[#FFFBF2] py-1 pl-3 pr-1 text-xs">
                  <button onClick={() => loadHistoryEntry(h)} className="hover:text-[#C24E33]">
                    <span className="font-semibold">{h.dish}</span> · {h.covers} covers · <span className="text-[#3A2A1E]/45">{h.savedAt}</span>
                  </button>
                  <button onClick={() => setHistory(deleteFromHistory(h.id))} className="flex h-4 w-4 items-center justify-center rounded-full text-[#3A2A1E]/40 hover:bg-[#3A2A1E]/10 hover:text-[#3A2A1E]" aria-label={`Delete ${h.dish}`}>×</button>
                </span>
              ))}
            </div>
          </section>
        )}

        {loading && <LoadingSkeleton />}
        {!loading && !sheet && !recipeText.trim() && !imageData && <FirstRunHint />}

        {sheet && demo && (
          <p className="no-print mt-6 rounded-2xl border-2 border-[#E9A93C] bg-[#E9A93C]/15 px-4 py-3 text-sm text-[#3A2A1E]">
            🧪 <span className="font-bold">Demo preview</span> — a rough linear+dampening estimate for{" "}
            <span className="font-bold">{sheet.dish}</span> (no AI yet). Add the API key to unlock the full
            chef-logic engine on <span className="font-bold">any</span> recipe.
          </p>
        )}

        {sheet && <Sheet sheet={sheet} prices={prices} />}

        {sheet && (
          <section className="no-print mt-3 rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-4 shadow-[0_8px_0_0_#3A2A1E]">
            <label className="font-display mb-1.5 block text-base font-semibold">Refine this sheet</label>
            <div className="flex gap-2">
              <input className={inputCls} placeholder='e.g. "drop to 400 covers" · "make it vegetarian" · "less spicy"' value={refineText} onChange={(e) => setRefineText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onRefine(); }} />
              <button onClick={onRefine} disabled={refining || !refineText.trim()} className="whitespace-nowrap rounded-full bg-[#51613A] px-5 py-2.5 text-sm font-bold text-[#FCF3E3] hover:bg-[#3f4d2d] disabled:opacity-50">
                {refining ? "Updating…" : "Update"}
              </button>
            </div>
            {refineNote && <p className="mt-2 rounded-xl bg-[#E9A93C]/20 px-3 py-2 text-sm text-[#3A2A1E]">{refineNote}</p>}
          </section>
        )}
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <section className="mt-6 rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_8px_0_0_#3A2A1E]">
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-1/3 rounded-full bg-[#C24E33]/20" />
        <div className="h-3 w-2/3 rounded-full bg-[#3A2A1E]/10" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-full rounded-full bg-[#3A2A1E]/10" />
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-[#3A2A1E]/50">Scaling with chef logic — batching &amp; holding included…</p>
    </section>
  );
}

function FirstRunHint() {
  return (
    <section className="no-print mt-6 rounded-3xl border-2 border-dashed border-[#3A2A1E]/30 bg-[#FFFBF2] p-5 text-sm text-[#3A2A1E]/65">
      👋 New here? Tap <span className="font-bold text-[#C24E33]">Load sample</span>, then <span className="font-bold text-[#C24E33]">Scale recipe</span> to see a full production sheet — scaled amounts, batching, hot-line holding, and a pull list.
    </section>
  );
}

function Sheet({ sheet, prices }: { sheet: ProductionSheet; prices: PriceItem[] }) {
  const [copied, setCopied] = useState(false);
  const costing = prices.length > 0 ? costSheet(sheet, prices) : null;

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(sheetText(sheet));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const sheetBtn = "rounded-full border-2 border-[#3A2A1E]/25 px-3 py-1.5 text-xs font-bold text-[#3A2A1E]/70 hover:bg-[#3A2A1E]/5";

  return (
    <section className="sheet-card mt-6 rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_10px_0_0_#3A2A1E]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-semibold">{sheet.dish}</h2>
          <p className="text-sm text-[#3A2A1E]/65">
            {sheet.baseYield.portions} portions → {sheet.targetYield.covers} covers @ {sheet.targetYield.portionSize}
            {"  ·  "}finished yield: <span className="font-semibold text-[#51613A]">{sheet.targetYield.finishedYield}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap justify-end gap-2">
          <button onClick={copyAll} className={sheetBtn}>{copied ? "✓ Copied" : "📋 Copy"}</button>
          {sheet.pullList.length > 0 && (
            <button onClick={() => downloadText(`${safeFileName(sheet.dish)}-pull-list.csv`, pullListCsv(sheet), "text/csv;charset=utf-8")} className={sheetBtn}>
              ⬇ Pull list (CSV)
            </button>
          )}
          <button onClick={() => window.print()} className={sheetBtn}>🖨 Print / PDF</button>
        </div>
      </div>

      {costing && costing.priced > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-[#51613A] bg-[#51613A]/8 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-base font-semibold text-[#51613A]">💲 Estimated food cost</span>
            <span className="text-xs text-[#3A2A1E]/55">
              {costing.priced}/{sheet.pullList.length} priced{costing.mismatched > 0 ? ` · ${costing.mismatched} unit mismatch` : ""}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-8">
            <div>
              <div className="font-display text-2xl font-bold">${costing.total.toFixed(2)}</div>
              <div className="text-xs text-[#3A2A1E]/55">priced items total</div>
            </div>
            {costing.perCover != null ? (
              <div>
                <div className="font-display text-2xl font-bold">${costing.perCover.toFixed(2)}</div>
                <div className="text-xs text-[#3A2A1E]/55">per cover</div>
              </div>
            ) : (
              <div className="max-w-[14rem] text-xs text-[#3A2A1E]/55">Per-cover hidden until ≥60% of the list is priced in matching units.</div>
            )}
          </div>
          <p className="mt-2 text-xs text-[#3A2A1E]/45">
            Partial estimate — only unit-matched items counted{costing.mismatched > 0 ? "; unit mismatches excluded" : ""}. Add prices in matching units (lb/oz, gal/qt/cup, each) for a full cost.
          </p>
        </div>
      )}

      <h3 className="font-display mt-5 mb-2 text-base font-semibold">Scaled recipe</h3>

      {/* Table — tablet & desktop */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#3A2A1E]/15 text-left text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45">
              <th className="py-2 pr-3">Ingredient</th>
              <th className="py-2 pr-3">Scaled</th>
              <th className="py-2 pr-3">×</th>
              <th className="py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {sheet.ingredients.map((ing, i) => (
              <tr key={i} className="border-b border-[#3A2A1E]/8 align-top">
                <td className="py-2 pr-3 font-semibold">{ing.item}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-[#C24E33]">{ing.scaledQty}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-[#3A2A1E]/55">{ing.multiplier}</td>
                <td className="py-2 text-[#3A2A1E]/60">{ing.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — phone */}
      <ul className="space-y-2 sm:hidden">
        {sheet.ingredients.map((ing, i) => (
          <li key={i} className="rounded-2xl border-2 border-[#3A2A1E]/12 bg-[#FCF3E3] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{ing.item}</span>
              <span className="whitespace-nowrap font-bold text-[#C24E33]">{ing.scaledQty}</span>
            </div>
            {(ing.multiplier || ing.note) && (
              <p className="mt-1 text-xs text-[#3A2A1E]/55">
                {ing.multiplier ? <span className="mr-2 font-semibold">{ing.multiplier}</span> : null}
                {ing.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      <Block title="⚠ Batching" items={sheet.batching} />
      <Block title="🔥 Holding on the line" items={sheet.holding} />
      <PullList items={sheet.pullList} />
      <Block title="Assumptions" items={sheet.assumptions} muted />
      {sheet.allergenFlags.length > 0 && <Block title="⚠ Allergen flags" items={sheet.allergenFlags} />}
      {sheet.safetyFlags.length > 0 && <Block title="🛡 Safety & cooling" items={sheet.safetyFlags} />}
    </section>
  );
}

function Block({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="font-display mb-1.5 text-base font-semibold">{title}</h3>
      <ul className={`list-disc space-y-1 pl-5 text-sm ${muted ? "text-[#3A2A1E]/45" : "text-[#3A2A1E]/75"}`}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function PullList({ items }: { items: ProductionSheet["pullList"] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="font-display mb-1.5 text-base font-semibold">📋 Pull list (order from inventory)</h3>
      <ul className="space-y-1 text-sm text-[#3A2A1E]/75">
        {items.map((it, i) => (
          <li key={i}>
            <span className="font-semibold">{it.item}</span> — {it.apQty}
            {it.note ? <span className="text-[#3A2A1E]/45"> · {it.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
