import type { ProductionSheet } from "./engine/schema";

/**
 * Cycle-menu planner helpers. Consolidate the pull lists of several scaled
 * dishes into one purchasing list — the daily/weekly operating layer.
 */

function parseQty(s: string): { num: number; unit: string } | null {
  const frac = s.match(/^\s*(\d+)\s*\/\s*(\d+)\s*([a-zA-Z#"]+)?/);
  if (frac) return { num: Number(frac[1]) / Number(frac[2]), unit: (frac[3] || "").toLowerCase() };
  const m = s.match(/^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z#"]+)?/);
  if (!m) return null;
  return { num: Number(m[1]), unit: (m[2] || "").toLowerCase() };
}

export type ConsolidatedLine = { item: string; qty: string };

/** Merge pull lists across sheets, summing quantities by item + unit. */
export function consolidatePullLists(sheets: ProductionSheet[]): ConsolidatedLine[] {
  // item(lower) -> { display, units: unit -> sum, raws: string[] }
  const groups = new Map<string, { display: string; units: Map<string, number>; raws: string[] }>();

  for (const sheet of sheets) {
    for (const it of sheet.pullList) {
      const key = it.item.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, { display: it.item.trim(), units: new Map(), raws: [] });
      const g = groups.get(key)!;
      const parsed = parseQty(it.apQty);
      if (parsed && parsed.unit) {
        g.units.set(parsed.unit, (g.units.get(parsed.unit) || 0) + parsed.num);
      } else {
        g.raws.push(it.apQty);
      }
    }
  }

  const round = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  const out: ConsolidatedLine[] = [];
  for (const g of groups.values()) {
    const parts: string[] = [];
    for (const [unit, sum] of g.units) parts.push(`${round(sum)} ${unit}`);
    parts.push(...g.raws);
    out.push({ item: g.display, qty: parts.join(" + ") || "—" });
  }
  out.sort((a, b) => a.item.localeCompare(b.item));
  return out;
}
