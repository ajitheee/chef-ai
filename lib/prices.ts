"use client";

import type { ProductionSheet } from "./engine/schema";

/**
 * His price list + real food costing. A generic AI can't cost a batch — it
 * doesn't have his supplier prices. We do. Costing is approximate (best-effort
 * name match + leading-number parse); units should be verified by the chef.
 */

export type PriceItem = { id: string; name: string; unit: string; price: number };

const KEY = "chefai.prices.v1";

export function getPrices(): PriceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PriceItem[]) : [];
  } catch {
    return [];
  }
}

export function addPrice(name: string, unit: string, price: number): PriceItem[] {
  const item: PriceItem = {
    id: `${Date.now()}-${Math.round(performance.now())}`,
    name: name.trim(),
    unit: unit.trim(),
    price,
  };
  // replace any existing with same name (case-insensitive)
  const existing = getPrices().filter((p) => p.name.toLowerCase() !== item.name.toLowerCase());
  const next = [item, ...existing];
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removePrice(id: string): PriceItem[] {
  const next = getPrices().filter((p) => p.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export type CostLine = { item: string; qty: string; unitPrice: number | null; cost: number | null };
export type Costing = {
  lines: CostLine[];
  matched: number;
  total: number;
  perCover: number | null;
};

function leadingNumber(s: string): number | null {
  // parse "52 lb", "16 cans", "1.5 lb", "3/4 qt" (fractions -> approx)
  const frac = s.match(/^\s*(\d+)\s*\/\s*(\d+)/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const m = s.match(/^\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** Estimate food cost for a sheet's pull list against the price list. */
export function costSheet(sheet: ProductionSheet, prices: PriceItem[]): Costing {
  const lines: CostLine[] = sheet.pullList.map((it) => {
    const p = prices.find(
      (pr) =>
        it.item.toLowerCase().includes(pr.name.toLowerCase()) ||
        pr.name.toLowerCase().includes(it.item.toLowerCase())
    );
    const qty = leadingNumber(it.apQty);
    const cost = p && qty !== null ? Math.round(qty * p.price * 100) / 100 : null;
    return { item: it.item, qty: it.apQty, unitPrice: p ? p.price : null, cost };
  });
  const matched = lines.filter((l) => l.cost !== null).length;
  const total = Math.round(lines.reduce((s, l) => s + (l.cost || 0), 0) * 100) / 100;
  const covers = sheet.targetYield.covers;
  const perCover = covers > 0 && total > 0 ? Math.round((total / covers) * 100) / 100 : null;
  return { lines, matched, total, perCover };
}
