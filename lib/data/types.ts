/**
 * Domain model — the shape the whole app speaks in, independent of where the
 * data actually lives. Today it comes from a seeded mock adapter; tomorrow from
 * Supabase. Nothing above the data layer changes when we swap.
 */

/** Recipe lifecycle (Master Prompt): Draft → Tested → Approved Master. Prior versions are Superseded. */
export const RECIPE_STATUSES = ["Draft", "Tested", "Approved Master"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export type Recipe = {
  id: string;
  slug: string; // url-safe, stable identifier
  name: string;
  recipeText: string;
  basePortions: number;
  portionSize: string;
  equipment?: string;
  holdingTime?: string;
  tags?: string[];
  status?: RecipeStatus;
  version?: number;
};

/** A prior version of a recipe, kept when its content changed. */
export type RecipeVersion = {
  version: number;
  name: string;
  recipeText: string;
  basePortions: number;
  portionSize: string;
  equipment?: string;
  holdingTime?: string;
  tags?: string[];
  savedAt: string;
  supersededAt: string;
};
