"use client";

/**
 * Local recipe storage (browser localStorage).
 * Lets the chef save and reuse his standard recipes with zero backend.
 * Swap this module for Supabase later — the rest of the app won't care.
 */

export type SavedRecipeVersion = {
  version: number;
  name: string;
  recipeText: string;
  basePortions: number;
  portionSize: string;
  equipment?: string;
  holdingTime?: string;
  savedAt: string;
  supersededAt: string;
};

export type SavedRecipe = {
  id: string;
  name: string;
  recipeText: string;
  basePortions: number;
  portionSize: string;
  equipment?: string;
  holdingTime?: string;
  lastCovers?: number;
  /** Lifecycle: Draft | Tested | Approved Master (Draft when absent). */
  status?: string;
  version?: number;
  savedAt?: string;
  /** Prior versions, newest first (kept when the content changed). */
  versions?: SavedRecipeVersion[];
};

const KEY = "chefai.recipes.v1";
const VERSIONS_MAX = 10;

export function getRecipes(): SavedRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedRecipe[]) : [];
  } catch {
    return [];
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Save a recipe. Same name (case-insensitive) = the same recipe: a content change keeps the prior version and goes back to Draft. */
export function saveRecipe(r: Omit<SavedRecipe, "id">): SavedRecipe[] {
  const all = getRecipes();
  const old = all.find((x) => same(x.name, r.name));
  const now = new Date().toLocaleString();
  let next: SavedRecipe;
  if (!old) {
    next = { ...r, id: `${Date.now()}-${Math.round(performance.now())}`, status: r.status ?? "Draft", version: 1, savedAt: now, versions: [] };
  } else {
    const changed =
      old.recipeText !== r.recipeText ||
      old.basePortions !== r.basePortions ||
      old.portionSize !== r.portionSize ||
      (old.equipment ?? "") !== (r.equipment ?? "") ||
      (old.holdingTime ?? "") !== (r.holdingTime ?? "");
    if (changed) {
      const prior: SavedRecipeVersion = {
        version: old.version ?? 1,
        name: old.name,
        recipeText: old.recipeText,
        basePortions: old.basePortions,
        portionSize: old.portionSize,
        equipment: old.equipment,
        holdingTime: old.holdingTime,
        savedAt: old.savedAt ?? "",
        supersededAt: now,
      };
      next = {
        ...old,
        ...r,
        id: old.id,
        status: "Draft",
        version: (old.version ?? 1) + 1,
        savedAt: now,
        versions: [prior, ...(old.versions ?? [])].slice(0, VERSIONS_MAX),
      };
    } else {
      next = { ...old, ...r, id: old.id, status: old.status ?? "Draft", version: old.version ?? 1, versions: old.versions ?? [] };
    }
  }
  const rest = all.filter((x) => !same(x.name, r.name));
  const list = [next, ...rest];
  window.localStorage.setItem(KEY, JSON.stringify(list));
  return list;
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
