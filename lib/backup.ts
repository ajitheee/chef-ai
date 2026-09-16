"use client";

import { getRecipes, getHistory, type SavedRecipe, type SheetHistoryEntry } from "./storage";
import { getKitchenNotes, type KitchenNote } from "./kitchen";
import { getPrices, type PriceItem } from "./prices";

/**
 * Local data backup/restore. localStorage lives in ONE browser — a cleared
 * cache or a new laptop loses the whole recipe library. This exports everything
 * (recipes, sheet history, kitchen memory, price book) to a single JSON file
 * the chef can keep, email, or move to another machine, and imports it back.
 *
 * No account needed. When Supabase is connected this stays the export/offline
 * path; until then it's the safety net.
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

const KEYS = {
  recipes: "chefai.recipes.v1",
  history: "chefai.sheets.v1",
  kitchen: "chefai.kitchen.v1",
  prices: "chefai.prices.v1",
} as const;

const HISTORY_MAX = 20; // must match storage.ts

/** Snapshot everything currently in localStorage. */
export function buildBackup(): ChefBackup {
  return {
    app: "digital-chef-ai",
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes: getRecipes(),
    history: getHistory(),
    kitchen: getKitchenNotes(),
    prices: getPrices(),
  };
}

export function backupFileName(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `chef-ai-backup-${stamp}.json`;
}

/** Download the current backup as a .json file. */
export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type RestoreMode = "merge" | "replace";
export type RestoreResult = { recipes: number; history: number; kitchen: number; prices: number };

function writeKey(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

/** Dedupe by id, keeping the first occurrence (imported items come first). */
function byId<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (!item || typeof item.id !== "string" || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** Dedupe by id, then collapse duplicate names (case-insensitive), first wins. */
function collapseByName<T extends { id: string; name: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of byId(list)) {
    const key = (item.name || "").trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Restore a backup file. `merge` (default) layers imported data on top of what's
 * already there — imported wins on a matching id/name, nothing is deleted.
 * `replace` overwrites everything with the file. Throws on a bad file.
 */
export function restoreBackup(raw: string, mode: RestoreMode = "merge"): RestoreResult {
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

  let recipes: SavedRecipe[];
  let history: SheetHistoryEntry[];
  let kitchen: KitchenNote[];
  let prices: PriceItem[];

  if (mode === "replace") {
    recipes = collapseByName(inRecipes);
    history = byId(inHistory);
    kitchen = byId(inKitchen);
    prices = collapseByName(inPrices);
  } else {
    // Imported first so it wins on a matching id/name.
    recipes = collapseByName([...inRecipes, ...getRecipes()]);
    history = byId([...inHistory, ...getHistory()]);
    kitchen = byId([...inKitchen, ...getKitchenNotes()]);
    prices = collapseByName([...inPrices, ...getPrices()]);
  }

  history = history.slice(0, HISTORY_MAX);

  writeKey(KEYS.recipes, recipes);
  writeKey(KEYS.history, history);
  writeKey(KEYS.kitchen, kitchen);
  writeKey(KEYS.prices, prices);

  return {
    recipes: recipes.length,
    history: history.length,
    kitchen: kitchen.length,
    prices: prices.length,
  };
}
