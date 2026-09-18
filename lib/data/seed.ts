import type { Recipe } from "./types";
import data from "./recipes.seed.json";

/**
 * Seed recipes = the chef's real test library (50 recipes), extracted from his
 * Word docs into the Recipe domain shape and stored as JSON so the data is
 * versioned separately from code. These stand in until the live database is
 * wired — swapping to Supabase changes the repository, not this shape.
 */
export const SEED_RECIPES: Recipe[] = data as Recipe[];
