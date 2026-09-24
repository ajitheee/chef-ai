"use client";

import type { VerifiedYield } from "./engine/verified";

/**
 * Verified yields, local adapter (browser storage). The kitchen's own measured
 * numbers — a test batch, a supplier spec — which outrank the standard tables
 * in every scale. Same product + kind replaces the earlier entry.
 */

export type VerifiedYieldItem = VerifiedYield & { id: string };

const KEY = "chefai.yields.v1";

export function getYields(): VerifiedYieldItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as VerifiedYieldItem[]) : [];
  } catch {
    return [];
  }
}

export function addYield(y: VerifiedYield): VerifiedYieldItem[] {
  const item: VerifiedYieldItem = {
    id: `${Date.now()}-${Math.round(performance.now())}`,
    product: y.product.trim(),
    kind: y.kind,
    pct: y.pct,
    source: (y.source ?? "").trim(),
    verifiedOn: y.verifiedOn || new Date().toLocaleDateString(),
  };
  const rest = getYields().filter((x) => !(x.product.toLowerCase() === item.product.toLowerCase() && x.kind === item.kind));
  const next = [item, ...rest];
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeYield(id: string): VerifiedYieldItem[] {
  const next = getYields().filter((y) => y.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
