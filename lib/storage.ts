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
