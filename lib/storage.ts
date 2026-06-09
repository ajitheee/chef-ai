"use client";

/**
 * Local recipe storage (browser localStorage).
 * Lets the chef save and reuse his standard recipes with zero backend.
 * Swap this module for Supabase later — the rest of the app won't care.
 */

export type SavedRecipe = {
  id: string;
  name: string;
  recipeText: string;
  basePortions: number;
  portionSize: string;
  equipment?: string;
  holdingTime?: string;
};

const KEY = "chefai.recipes.v1";

export function getRecipes(): SavedRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedRecipe[]) : [];
  } catch {
    return [];
  }
}

export function saveRecipe(r: Omit<SavedRecipe, "id">): SavedRecipe[] {
  const id = `${Date.now()}-${Math.round(performance.now())}`;
  // Replace any existing recipe with the same name (case-insensitive).
  const existing = getRecipes().filter(
    (x) => x.name.trim().toLowerCase() !== r.name.trim().toLowerCase()
  );
  const next = [{ ...r, id }, ...existing];
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteRecipe(id: string): SavedRecipe[] {
  const next = getRecipes().filter((r) => r.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/* ---------- Production-sheet history (most recent first, capped) ---------- */

export type SheetHistoryEntry = {
  id: string;
  dish: string;
  covers: number;
  savedAt: string; // human-readable timestamp
  sheet: unknown; // ProductionSheet (kept loose here; validated on use)
};

const HISTORY_KEY = "chefai.sheets.v1";
const HISTORY_MAX = 20;

export function getHistory(): SheetHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SheetHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addToHistory(dish: string, covers: number, sheet: unknown): SheetHistoryEntry[] {
  const entry: SheetHistoryEntry = {
    id: `${Date.now()}-${Math.round(performance.now())}`,
    dish,
    covers,
    savedAt: new Date().toLocaleString(),
    sheet,
  };
  const next = [entry, ...getHistory()].slice(0, HISTORY_MAX);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function deleteFromHistory(id: string): SheetHistoryEntry[] {
  const next = getHistory().filter((e) => e.id !== id);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
