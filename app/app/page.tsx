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

  useEffect(() => {
    setSaved(getRecipes());
    setHistory(getHistory());
  }, []);

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
      })
    );
  }

  function loadSaved(r: SavedRecipe) {
    setRecipeName(r.name);
    setRecipeText(r.recipeText);
    setBasePortions(String(r.basePortions));
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

  const label = "block text-sm font-medium text-slate-600 mb-1";
  // text-base (16px) prevents the zoom-on-focus jump on iOS; py-2.5 = bigger tap target.
  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const chipBtn =
    "rounded-md border px-3 py-1.5 text-xs font-medium";

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <header className="mb-6 no-print">
        <a href="/" className="mb-2 inline-block text-xs font-medium text-slate-400 hover:text-slate-700">
          ← Home
        </a>
        <h1 className="text-2xl font-bold text-slate-900">
          Digital Chef AI <span className="text-blue-600">· Production Scaler</span>
        </h1>
        <p className="text-sm text-slate-500">
          Scale a standardized recipe to today&apos;s covers — the way a chef would.
        </p>
      </header>

      {/* Input card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm no-print">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Recipe</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onVariations}
              disabled={varLoading}
              className={`${chipBtn} border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50`}
            >
              {varLoading ? "Thinking…" : "💡 Variations"}
            </button>
            <button
              onClick={onSave}
              className={`${chipBtn} border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100`}
            >
              Save recipe
            </button>
            <button
              onClick={loadSample}
              className={`${chipBtn} border-slate-300 text-slate-600 hover:bg-slate-50`}
            >
              Load sample
            </button>
          </div>
        </div>

        {saved.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {saved.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-xs text-slate-700"
              >
                <button onClick={() => loadSaved(r)} className="font-medium hover:text-blue-700">
                  {r.name}
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={`Delete ${r.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          className={`${inputCls} mb-2`}
          placeholder="Recipe name (e.g. Chicken Jambalaya)"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
        />

        <textarea
          className={`${inputCls} h-40 font-mono`}
          placeholder="Paste a standardized recipe here... (or add a photo below)"
          value={recipeText}
          onChange={(e) => setRecipeText(e.target.value)}
        />

        <div className="mt-2 flex items-center gap-3">
          <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            📷 Add photo of a recipe
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onFile}
            />
          </label>
          {imageName && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
              {imageName}
              <button
                onClick={clearImage}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label="Remove photo"
              >
                ×
              </button>
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

        <button
          onClick={onScale}
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Scaling…" : "Scale recipe →"}
        </button>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </section>

      {variations.length > 0 && (
        <section className="no-print mt-4 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-violet-700">💡 Variations — pick one to scale</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {variations.map((v, i) => (
              <div key={i} className="flex flex-col rounded-xl border border-slate-200 p-3">
                <div className="font-medium text-slate-800">{v.name}</div>
                {v.tags && v.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {v.tags.map((t, j) => (
                      <span key={j} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 flex-1 text-xs text-slate-500">{v.summary}</p>
                <button
                  onClick={() => useVariation(v)}
                  className="mt-3 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  Use this →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && !loading && (
        <section className="no-print mt-4">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent sheets
          </h3>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <span
                key={h.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-xs text-slate-600"
              >
                <button onClick={() => loadHistoryEntry(h)} className="hover:text-blue-700">
                  <span className="font-medium">{h.dish}</span> · {h.covers} covers ·{" "}
                  <span className="text-slate-400">{h.savedAt}</span>
                </button>
                <button
                  onClick={() => setHistory(deleteFromHistory(h.id))}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={`Delete ${h.dish}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      {loading && <LoadingSkeleton />}
      {!loading && !sheet && !recipeText.trim() && !imageData && <FirstRunHint />}

      {sheet && demo && (
        <p className="no-print mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          🧪 <span className="font-semibold">Demo preview</span> — scaling the sample recipe
          (Mexican Rice) to your cover count, with dampening. Add the API key to scale{" "}
          <span className="font-semibold">any</span> recipe with the live engine.
        </p>
      )}

      {sheet && <Sheet sheet={sheet} />}

      {sheet && (
        <section className="no-print mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Refine this sheet
          </label>
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder='e.g. "drop to 400 covers" · "make it vegetarian" · "less spicy"'
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRefine();
              }}
            />
            <button
              onClick={onRefine}
              disabled={refining || !refineText.trim()}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {refining ? "Updating…" : "Update"}
            </button>
          </div>
          {refineNote && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {refineNote}
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-1/3 rounded bg-slate-200" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-full rounded bg-slate-100" />
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Scaling with chef logic — batching &amp; holding included…
      </p>
    </section>
  );
}

function FirstRunHint() {
  return (
    <section className="no-print mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
      👋 New here? Tap <span className="font-medium text-slate-700">Load sample</span>, then{" "}
      <span className="font-medium text-slate-700">Scale recipe</span> to see a full production
      sheet — scaled amounts, batching, hot-line holding, and a pull list.
    </section>
  );
}

function Sheet({ sheet }: { sheet: ProductionSheet }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(sheetText(sheet));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const sheetBtn =
    "rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50";

  return (
    <section className="sheet-card mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{sheet.dish}</h2>
          <p className="text-sm text-slate-500">
            {sheet.baseYield.portions} portions → {sheet.targetYield.covers} covers @ {sheet.targetYield.portionSize}
            {"  ·  "}finished yield:{" "}
            <span className="font-medium text-slate-700">{sheet.targetYield.finishedYield}</span>
          </p>
        </div>
        <div className="no-print flex flex-wrap justify-end gap-2">
          <button onClick={copyAll} className={sheetBtn}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          {sheet.pullList.length > 0 && (
            <button
              onClick={() =>
                downloadText(
                  `${safeFileName(sheet.dish)}-pull-list.csv`,
                  pullListCsv(sheet),
                  "text/csv;charset=utf-8"
                )
              }
              className={sheetBtn}
            >
              ⬇ Pull list (CSV)
            </button>
          )}
          <button onClick={() => window.print()} className={sheetBtn}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-700">Scaled recipe</h3>

      {/* Table — tablet & desktop */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-1.5 pr-3">Ingredient</th>
              <th className="py-1.5 pr-3">Scaled</th>
              <th className="py-1.5 pr-3">x</th>
              <th className="py-1.5">Note</th>
            </tr>
          </thead>
          <tbody>
            {sheet.ingredients.map((ing, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="py-1.5 pr-3 font-medium text-slate-800">{ing.item}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap text-slate-700">{ing.scaledQty}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{ing.multiplier}</td>
                <td className="py-1.5 text-slate-500">{ing.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — phone */}
      <ul className="space-y-2 sm:hidden">
        {sheet.ingredients.map((ing, i) => (
          <li key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-slate-800">{ing.item}</span>
              <span className="whitespace-nowrap font-semibold text-slate-700">{ing.scaledQty}</span>
            </div>
            {(ing.multiplier || ing.note) && (
              <p className="mt-1 text-xs text-slate-500">
                {ing.multiplier ? <span className="mr-2 font-medium">{ing.multiplier}</span> : null}
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
      <h3 className="mb-1.5 text-sm font-semibold text-slate-700">{title}</h3>
      <ul className={`list-disc space-y-1 pl-5 text-sm ${muted ? "text-slate-400" : "text-slate-600"}`}>
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
      <h3 className="mb-1.5 text-sm font-semibold text-slate-700">📋 Pull list (order from inventory)</h3>
      <ul className="space-y-1 text-sm text-slate-600">
        {items.map((it, i) => (
          <li key={i}>
            <span className="font-medium text-slate-800">{it.item}</span> — {it.apQty}
            {it.note ? <span className="text-slate-400"> · {it.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
