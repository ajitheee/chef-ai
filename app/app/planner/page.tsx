"use client";

import { useEffect, useState } from "react";
import { costSheet, type PriceItem } from "@/lib/prices";
import { getStore, type SavedRecipe } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { TopBar } from "@/components/TopBar";
import { TWO_PANE, PANE_LEFT, PANE_RIGHT, H1, H2, LABEL, FIELD, CHIP, PRIMARY, TH, TD, NOTE_WARN, NOTE_DANGER, Section } from "@/components/paper";
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
  // Which plan rows are done / in flight while the plan builds (row ids).
  const [progress, setProgress] = useState<{ done: string[]; active: string[] } | null>(null);
  const [built, setBuilt] = useState<Built[] | null>(null);
  const [consolidated, setConsolidated] = useState<ConsolidatedLine[]>([]);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getStore();
    s.recipes
      .list()
      .then((r) => {
        setRecipes(r);
        if (r[0]) setPick(r[0].id);
      })
      .catch(() => {});
    s.prices.list().then(setPrices).catch(() => {});
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
    setProgress({ done: [], active: [] });
    try {
      const notes = (await getStore().notes.list()).filter((n) => n.active !== false).map((n) => n.text);
      const yields = (await getStore().yields.list()).map(({ product, kind, pct, source, verifiedOn }) => ({ product, kind, pct, source, verifiedOn }));
      const out: (Built | undefined)[] = new Array(rows.length);
      const failed: string[] = [];
      let isDemo = false;

      const scaleOne = async (i: number) => {
        const row = rows[i];
        const rec = recipes.find((r) => r.id === row.recipeId);
        if (!rec) return;
        setProgress((p) => p && { ...p, active: [...p.active, row.id] });
        try {
          const res = await fetch("/api/scale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dish: rec.name,
              recipeText: rec.recipeText,
              basePortions: rec.basePortions,
              targetCovers: row.covers,
              portionSize: rec.portionSize,
              equipment: rec.equipment || "",
              holdingTime: rec.holdingTime || "",
              kitchenNotes: notes,
              yields,
              recipeStatus: rec.status && rec.status !== "Draft" ? rec.status : undefined,
            }),
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "the engine returned an error");
          if (data.demo) isDemo = true;
          const sheet = data.sheet as ProductionSheet;
          const cost = prices.length ? costSheet(sheet, prices).total : 0;
          out[i] = { dish: rec.name, covers: row.covers, cost, sheet };
        } catch (e) {
          failed.push(`${rec.name} (${e instanceof Error ? e.message : "failed"})`);
        } finally {
          setProgress((p) => p && { done: [...p.done, row.id], active: p.active.filter((id) => id !== row.id) });
        }
      };

      // Two dishes at a time: each is its own engine call (~40 s), so this
      // halves the wait without leaning on the API.
      let next = 0;
      const worker = async () => {
        while (next < rows.length) await scaleOne(next++);
      };
      await Promise.all([worker(), worker()]);

      const ok = out.filter((b): b is Built => !!b);
      if (failed.length > 0) setError(`Couldn't scale ${failed.length === 1 ? "one dish" : `${failed.length} dishes`}: ${failed.join("; ")}. The plan below covers the rest.`);
      if (ok.length > 0) {
        setBuilt(ok);
        setConsolidated(consolidatePullLists(ok.map((b) => b.sheet)));
        setDemo(isDemo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBuilding(false);
      setProgress(null);
    }
  }

  const totalCost = built ? Math.round(built.reduce((s, b) => s + b.cost, 0) * 100) / 100 : 0;
  const totalCovers = built ? built.reduce((s, b) => s + b.covers, 0) : 0;

  function exportCsv() {
    const rowsCsv = [["Item", "Quantity"], ...consolidated.map((c) => [c.item, c.qty])];
    const csv = rowsCsv
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\r\n");
    downloadText("purchasing-plan.csv", csv, "text/csv;charset=utf-8");
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="planner" signOut={isSupabaseConfigured()} />
      <main className={TWO_PANE}>
        {/* Left pane — build the service */}
        <aside className={PANE_LEFT}>
          <h1 className={H1}>Cycle-menu planner</h1>
          <p className="mt-1 text-sm text-ink-2">
            Plan a service across dishes → one consolidated purchasing list and the total food cost.
          </p>

          {recipes.length === 0 ? (
            <p className="mt-6 border-t border-ink pt-3 text-sm text-ink-2">
              No saved recipes yet. Go to the{" "}
              <a href="/app" className="font-semibold text-ink underline underline-offset-2">Scaler</a>, load and{" "}
              <span className="font-semibold text-ink">Save</span> a few recipes, then come back to plan a menu.
            </p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-2">
                <div className="min-w-0">
                  <label className={LABEL} htmlFor="plan-dish">Dish</label>
                  <select id="plan-dish" className={FIELD} value={pick} onChange={(e) => setPick(e.target.value)}>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor="plan-covers">Covers</label>
                  <input id="plan-covers" className={FIELD} inputMode="numeric" placeholder="400" value={covers} onChange={(e) => setCovers(e.target.value)} />
                </div>
                <button onClick={addRow} className={`${PRIMARY} px-4 py-2.5 text-sm`}>Add</button>
              </div>

              {rows.length > 0 && (
                <ul className="mt-4 divide-y divide-line border-t border-ink text-sm">
                  {rows.map((row) => {
                    const rec = recipes.find((r) => r.id === row.recipeId);
                    return (
                      <li key={row.id} className="flex items-center justify-between gap-2 py-2">
                        <span>
                          <span className="font-semibold">{rec?.name}</span> · {row.covers} covers
                        </span>
                        {progress ? (
                          <span className="text-xs font-semibold text-ink-3">
                            {progress.done.includes(row.id) ? "done" : progress.active.includes(row.id) ? "scaling…" : "queued"}
                          </span>
                        ) : (
                          <button onClick={() => removeRow(row.id)} className="px-1 text-ink-3 hover:text-danger" aria-label="Remove">×</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <button onClick={build} disabled={building || rows.length === 0} className={`${PRIMARY} mt-5 w-full py-3.5 text-base`}>
                {building && progress ? `Scaling ${Math.min(progress.done.length + 1, rows.length)} of ${rows.length}…` : "Build production plan →"}
              </button>
              {building && (
                <p className="mt-2 text-xs text-ink-3">Each dish is one engine call of about 40 seconds; two run at a time. Keep this page open.</p>
              )}
              {error && <p className={`${NOTE_DANGER} mt-3`}>{error}</p>}
            </>
          )}
        </aside>

        {/* Right pane — the plan, a ruled document */}
        <section className={PANE_RIGHT}>
          {!built ? (
            <div className="no-print">
              <h2 className={H2}>Production plan</h2>
              <p className="mt-2 border-t border-ink pt-3 text-sm text-ink-2">
                {building && progress
                  ? `Scaling ${progress.done.length} of ${rows.length} dishes done…`
                  : <>Add dishes with today&apos;s covers and tap <span className="font-semibold text-ink">Build production plan</span>. The consolidated purchasing list and the food cost appear here.</>}
              </p>
            </div>
          ) : (
            <article>
              {demo && (
                <p className={`no-print mb-6 ${NOTE_WARN}`}>
                  Demo scales each dish to the sample recipe. Add the API key for true per-recipe planning.
                </p>
              )}
              <h2 className="text-2xl font-semibold leading-tight">Service plan</h2>
              <p className="mt-1 text-sm text-ink-2">
                {built.length} {built.length === 1 ? "dish" : "dishes"} · {totalCovers} covers
              </p>

              <Section title="Dishes">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH}>Dish</th>
                      <th className={`${TH} text-right`}>Covers</th>
                      {prices.length > 0 && <th className={`${TH} pr-0 text-right`}>Cost</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {built.map((b, i) => (
                      <tr key={i}>
                        <td className={`${TD} font-semibold`}>{b.dish}</td>
                        <td className={`${TD} text-right`}>{b.covers}</td>
                        {prices.length > 0 && <td className={`${TD} pr-0 text-right`}>{b.cost > 0 ? `$${b.cost.toFixed(0)}` : "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section
                title="Consolidated purchasing"
                aside={
                  <button onClick={exportCsv} className={`no-print ${CHIP}`}>
                    CSV
                  </button>
                }
              >
                <table className="w-full text-sm">
                  <tbody>
                    {consolidated.map((c, i) => (
                      <tr key={i}>
                        <td className={`${TD} font-semibold`}>{c.item}</td>
                        <td className={`${TD} whitespace-nowrap pr-0 text-right font-semibold`}>{c.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {totalCost > 0 && (
                <Section title="Estimated total food cost">
                  <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
                  <div className="text-xs text-ink-3">across the service · priced items only</div>
                </Section>
              )}
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
