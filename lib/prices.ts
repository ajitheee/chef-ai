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

export type CostStatus = "priced" | "unit-mismatch" | "no-price" | "no-qty";
export type CostLine = {
  item: string;
  qty: string;
  unitPrice: number | null;
  cost: number | null;
  status: CostStatus;
};
export type Costing = {
  lines: CostLine[];
  priced: number; // lines with a real cost
  mismatched: number; // matched a price but units don't reconcile
  total: number;
  perCover: number | null;
  coverage: number; // priced / pullList length, 0..1
};

/** Unit -> {family, toBase} so we can convert before multiplying. */
function unitInfo(raw: string): { family: "weight" | "volume" | "count"; toBase: number } | null {
  const u = raw.trim().toLowerCase().replace(/\.$/, "");
  const W: Record<string, number> = { oz: 1, ounce: 1, ounces: 1, lb: 16, lbs: 16, pound: 16, pounds: 16, g: 0.035274, gram: 0.035274, grams: 0.035274, kg: 35.274 };
  const V: Record<string, number> = { floz: 1, "fl oz": 1, cup: 8, cups: 8, c: 8, pt: 16, pint: 16, qt: 32, quart: 32, quarts: 32, gal: 128, gallon: 128, gallons: 128, tbsp: 0.5, tsp: 1 / 6, ml: 0.033814, l: 33.814, liter: 33.814 };
  const C: Record<string, number> = { each: 1, ea: 1, unit: 1, piece: 1, pieces: 1, ct: 1, count: 1, can: 1, cans: 1, bunch: 1, bunches: 1, head: 1, heads: 1, dozen: 12, dz: 12, "#10": 1, case: 1, cs: 1, bag: 1, bags: 1 };
  if (u in W) return { family: "weight", toBase: W[u] };
  if (u in V) return { family: "volume", toBase: V[u] };
  if (u in C) return { family: "count", toBase: C[u] };
  return null;
}

/** Parse "52 lb", "16 cans", "3/4 qt", "~2 qt", "12 oz" -> {num, unit}. */
function parseQty(s: string): { num: number; unit: string } | null {
  const cleaned = s.replace(/[~()]/g, " ");
  const frac = cleaned.match(/(\d+)\s*\/\s*(\d+)\s*([a-zA-Z#"]+)?/);
  const dec = cleaned.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z#"]+)?/);
  let num: number | null = null;
  let unit = "";
  if (frac) {
    num = Number(frac[1]) / Number(frac[2]);
    unit = (frac[3] || "").toLowerCase();
  } else if (dec) {
    num = Number(dec[1]);
    unit = (dec[2] || "").toLowerCase();
  }
  if (num === null || Number.isNaN(num)) return null;
  return { num, unit };
}

/** Estimate food cost for a sheet's pull list against the price list — UNIT-AWARE. */
export function costSheet(sheet: ProductionSheet, prices: PriceItem[]): Costing {
  const lines: CostLine[] = sheet.pullList.map((it) => {
    const p = prices.find(
      (pr) =>
        it.item.toLowerCase().includes(pr.name.toLowerCase()) ||
        pr.name.toLowerCase().includes(it.item.toLowerCase())
    );
    if (!p) return { item: it.item, qty: it.apQty, unitPrice: null, cost: null, status: "no-price" as const };

    const q = parseQty(it.apQty);
    if (!q) return { item: it.item, qty: it.apQty, unitPrice: p.price, cost: null, status: "no-qty" as const };

    const qInfo = unitInfo(q.unit);
    const pInfo = unitInfo(p.unit);
    // Reconcile: same family -> convert qty into the price's unit, then multiply.
    if (qInfo && pInfo && qInfo.family === pInfo.family) {
      const qtyInPriceUnit = (q.num * qInfo.toBase) / pInfo.toBase;
      const cost = Math.round(qtyInPriceUnit * p.price * 100) / 100;
      return { item: it.item, qty: it.apQty, unitPrice: p.price, cost, status: "priced" as const };
    }
    // If neither has a recognizable unit, assume the price is per-quantity (best effort).
    if (!qInfo && !pInfo) {
      const cost = Math.round(q.num * p.price * 100) / 100;
      return { item: it.item, qty: it.apQty, unitPrice: p.price, cost, status: "priced" as const };
    }
    return { item: it.item, qty: it.apQty, unitPrice: p.price, cost: null, status: "unit-mismatch" as const };
  });

  const priced = lines.filter((l) => l.status === "priced").length;
  const mismatched = lines.filter((l) => l.status === "unit-mismatch").length;
  const total = Math.round(lines.reduce((s, l) => s + (l.cost || 0), 0) * 100) / 100;
  const covers = sheet.targetYield.covers;
  const coverage = sheet.pullList.length > 0 ? priced / sheet.pullList.length : 0;
  // Only surface a per-cover figure once enough of the list is actually priced.
  const perCover = covers > 0 && total > 0 && coverage >= 0.6 ? Math.round((total / covers) * 100) / 100 : null;
  return { lines, priced, mismatched, total, perCover, coverage };
}
