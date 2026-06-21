"use client";

import { useEffect, useState } from "react";
import { getRecipes, type SavedRecipe } from "@/lib/storage";
import { getPrices, costSheet, type PriceItem } from "@/lib/prices";
import { getKitchenNotes } from "@/lib/kitchen";
import { consolidatePullLists, type ConsolidatedLine } from "@/lib/planner";
import { downloadText } from "@/lib/export";
import type { ProductionSheet } from "@/lib/engine/schema";

type PlanRow = { id: string; recipeId: string; covers: number };
type Built = { dish: string; covers: number; cost: number; sheet: ProductionSheet };

export default function Planner() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [pick, setPick] = useState("");
  const [covers, setCovers] = useState("400");

  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState<Built[] | null>(null);
  const [consolidated, setConsolidated] = useState<ConsolidatedLine[]>([]);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const r = getRecipes();
    setRecipes(r);
    setPrices(getPrices());
    if (r[0]) setPick(r[0].id);
  }, []);

  function addRow() {
    if (!pick || !Number(covers)) return;
    setRows((rs) => [...rs, { id: `${Date.now()}-${rs.length}`, recipeId: pick, covers: Number(covers) }]);
    setBuilt(null);
  }
  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setBuilt(null);
  }

  async function build() {
    if (rows.length === 0) return;
    setBuilding(true);
    setError("");
    setBuilt(null);
    try {
      const notes = getKitchenNotes().map((n) => n.text);
      const out: Built[] = [];
      let isDemo = false;
      for (const row of rows) {
        const rec = recipes.find((r) => r.id === row.recipeId);
        if (!rec) continue;
        const res = await fetch("/api/scale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipeText: rec.recipeText,
            basePortions: rec.basePortions,
            targetCovers: row.covers,
            portionSize: rec.portionSize,
            equipment: rec.equipment || "",
            holdingTime: rec.holdingTime || "",
            kitchenNotes: notes,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to scale " + rec.name);
        if (data.demo) isDemo = true;
        const sheet = data.sheet as ProductionSheet;
        const cost = prices.length ? costSheet(sheet, prices).total : 0;
        out.push({ dish: rec.name, covers: row.covers, cost, sheet });
      }
      setBuilt(out);
      setConsolidated(consolidatePullLists(out.map((b) => b.sheet)));
      setDemo(isDemo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBuilding(false);
    }
  }

  const totalCost = built ? Math.round(built.reduce((s, b) => s + b.cost, 0) * 100) / 100 : 0;
  const inputCls =
    "rounded-xl border-2 border-[#3A2A1E]/20 bg-[#FFFBF2] px-3 py-2.5 text-base text-[#3A2A1E] focus:border-[#C24E33] focus:outline-none";

  function exportCsv() {
    const rowsCsv = [["Item", "Quantity"], ...consolidated.map((c) => [c.item, c.qty])];
    const csv = rowsCsv
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\r\n");
    downloadText("purchasing-plan.csv", csv, "text/csv;charset=utf-8");
  }

  return (
    <div className="font-techno relative min-h-screen bg-[#FCF3E3] text-[#3A2A1E]">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <a href="/app" className="mb-2 inline-block text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45 hover:text-[#C24E33]">← Scaler</a>
        <h1 className="font-display text-3xl font-semibold">
          Cycle-Menu <span className="text-[#C24E33]">Planner</span>
        </h1>
        <p className="mt-1 text-sm text-[#3A2A1E]/65">
          Plan a service across dishes → one consolidated purchasing list + total food cost.
        </p>

        {recipes.length === 0 ? (
          <p className="mt-6 rounded-2xl border-2 border-dashed border-[#3A2A1E]/30 bg-[#FFFBF2] p-5 text-sm text-[#3A2A1E]/65">
            No saved recipes yet. Go to the <a href="/app" className="font-bold text-[#C24E33]">Scaler</a>, load &amp; <b>Save</b> a few recipes, then come back to plan a menu.
          </p>
        ) : (
          <section className="mt-6 rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_10px_0_0_#3A2A1E]">
            <div className="flex flex-wrap items-end gap-2">
              <select className={`${inputCls} flex-1`} value={pick} onChange={(e) => setPick(e.target.value)}>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <input className={`${inputCls} w-28`} inputMode="numeric" placeholder="covers" value={covers} onChange={(e) => setCovers(e.target.value)} />
              <button onClick={addRow} className="rounded-full bg-[#51613A] px-5 py-2.5 text-sm font-bold text-[#FCF3E3] hover:bg-[#3f4d2d]">+ Add</button>
            </div>

            {rows.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {rows.map((row) => {
                  const rec = recipes.find((r) => r.id === row.recipeId);
                  return (
                    <li key={row.id} className="flex items-center justify-between rounded-xl border-2 border-[#3A2A1E]/12 bg-[#FCF3E3] px-3 py-2 text-sm">
                      <span><span className="font-semibold">{rec?.name}</span> · {row.covers} covers</span>
                      <button onClick={() => removeRow(row.id)} className="text-[#3A2A1E]/40 hover:text-[#B0392A]" aria-label="Remove">×</button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button onClick={build} disabled={building || rows.length === 0} className="mt-5 w-full rounded-full bg-[#C24E33] px-4 py-3.5 text-sm font-bold text-[#FCF3E3] shadow-[0_6px_0_0_#A33E27] transition hover:translate-y-0.5 hover:shadow-[0_3px_0_0_#A33E27] disabled:opacity-50 disabled:shadow-none">
              {building ? "Building plan…" : "Build production plan →"}
            </button>
            {error && <p className="mt-3 rounded-xl border-2 border-[#B0392A]/30 bg-[#B0392A]/10 px-3 py-2 text-sm font-semibold text-[#B0392A]">{error}</p>}
          </section>
        )}

        {built && (
          <section className="mt-4 rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_10px_0_0_#3A2A1E]">
            {demo && (
              <p className="mb-3 rounded-2xl border-2 border-[#E9A93C] bg-[#E9A93C]/15 px-3 py-2 text-xs text-[#3A2A1E]">
                🧪 Demo scales each dish to the sample recipe. Add the API key for true per-recipe planning.
              </p>
            )}
            <h2 className="font-display text-xl font-semibold">Service plan</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {built.map((b, i) => (
                <span key={i} className="rounded-full border-2 border-[#3A2A1E]/15 bg-[#FCF3E3] px-3 py-1 text-sm">
                  <span className="font-semibold">{b.dish}</span> · {b.covers}{b.cost > 0 ? ` · $${b.cost.toFixed(0)}` : ""}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">📋 Consolidated purchasing</h3>
              <button onClick={exportCsv} className="rounded-full border-2 border-[#3A2A1E]/25 px-3 py-1.5 text-xs font-bold text-[#3A2A1E]/70 hover:bg-[#3A2A1E]/5">⬇ CSV</button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {consolidated.map((c, i) => (
                <li key={i} className="flex justify-between border-b border-[#3A2A1E]/8 py-1">
                  <span className="font-semibold">{c.item}</span>
                  <span className="text-[#C24E33]">{c.qty}</span>
                </li>
              ))}
            </ul>

            {totalCost > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-[#51613A] bg-[#51613A]/8 p-4">
                <div className="font-display text-2xl font-bold">${totalCost.toFixed(2)}</div>
                <div className="text-xs text-[#3A2A1E]/55">estimated total food cost across the service</div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
