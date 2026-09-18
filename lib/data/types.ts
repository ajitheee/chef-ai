/**
 * Domain model — the shape the whole app speaks in, independent of where the
 * data actually lives. Today it comes from a seeded mock adapter; tomorrow from
 * Supabase. Nothing above the data layer changes when we swap.
 */

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
};
