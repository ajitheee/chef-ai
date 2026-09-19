"use client";

import type { ProductionSheet } from "./engine/schema";
import type { KitchenStore, SavedRecipe, SheetHistoryEntry, KitchenNote, PriceItem } from "./store";

/**
 * Backup / restore of the scaler's working data, through the active store —
 * so it works the same whether the data lives in this browser or in the
 * chef's Supabase rows. Export is one JSON file the chef can keep or move;
 * restore MERGES (imported wins on a matching recipe/price name; nothing is
 * deleted).
 */

export type ChefBackup = {
  app: "digital-chef-ai";
  version: 1;
  exportedAt: string;
  recipes: SavedRecipe[];
  history: SheetHistoryEntry[];
  kitchen: KitchenNote[];
  prices: PriceItem[];
};

export async function buildBackup(store: KitchenStore): Promise<ChefBackup> {
  const [recipes, history, kitchen, prices] = await Promise.all([
    store.recipes.list(),
    store.history.list(),
    store.notes.list(),
    store.prices.list(),
  ]);
  return { app: "digital-chef-ai", version: 1, exportedAt: new Date().toISOString(), recipes, history, kitchen, prices };
}

export function backupFileName(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `chef-ai-backup-${stamp}.json`;
}

/** Download the current backup as a .json file. */
export async function downloadBackup(store: KitchenStore): Promise<void> {
  const blob = new Blob([JSON.stringify(await buildBackup(store), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type RestoreResult = { recipes: number; history: number; kitchen: number; prices: number };

/** Merge a backup file into the active store. Throws on a bad file. */
export async function restoreBackup(store: KitchenStore, raw: string): Promise<RestoreResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON — pick a Chef AI backup file.");
  }
  const b = parsed as Partial<ChefBackup>;
  if (!b || b.app !== "digital-chef-ai" || !Array.isArray(b.recipes)) {
    throw new Error("That doesn't look like a Chef AI backup file.");
  }

  const inRecipes = (b.recipes ?? []) as SavedRecipe[];
  const inHistory = (Array.isArray(b.history) ? b.history : []) as SheetHistoryEntry[];
  const inKitchen = (Array.isArray(b.kitchen) ? b.kitchen : []) as KitchenNote[];
  const inPrices = (Array.isArray(b.prices) ? b.prices : []) as PriceItem[];

  // Recipes and prices: same name replaces (imported wins), via the store's own rule.
  for (const r of inRecipes) {
    if (!r?.name || !r.recipeText) continue;
    await store.recipes.save({
      name: r.name,
      recipeText: r.recipeText,
      basePortions: Number(r.basePortions) || 1,
      portionSize: r.portionSize || "1 portion",
      equipment: r.equipment,
      holdingTime: r.holdingTime,
      lastCovers: r.lastCovers,
    });
  }
  for (const p of inPrices) {
    if (p?.name && Number.isFinite(Number(p.price))) await store.prices.add(p.name, p.unit || "unit", Number(p.price));
  }

  // Notes: skip exact duplicates.
  const haveNotes = new Set((await store.notes.list()).map((n) => n.text.trim().toLowerCase()));
  for (const n of inKitchen) {
    const key = (n?.text ?? "").trim().toLowerCase();
    if (!key || haveNotes.has(key)) continue;
    await store.notes.add(n.text);
    haveNotes.add(key);
  }

  // Sheets: skip entries already present (same dish, covers and timestamp).
  const keyOf = (h: SheetHistoryEntry) => `${h.dish}|${h.covers}|${h.savedAt}`;
  const haveHistory = new Set((await store.history.list()).map(keyOf));
  for (const h of inHistory) {
    if (!h?.sheet || !h.dish || haveHistory.has(keyOf(h))) continue;
    await store.history.add(h.dish, Number(h.covers) || 0, h.sheet as ProductionSheet);
    haveHistory.add(keyOf(h));
  }

  const [recipes, history, kitchen, prices] = await Promise.all([
    store.recipes.list(),
    store.history.list(),
    store.notes.list(),
    store.prices.list(),
  ]);
  return { recipes: recipes.length, history: history.length, kitchen: kitchen.length, prices: prices.length };
}
