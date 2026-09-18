import type { Recipe } from "./types";
import { SEED_RECIPES } from "./seed";

/**
 * The single door to recipe data. Every page and route goes through this
 * interface and never touches a storage engine directly. Slice 1 ships the
 * in-memory mock adapter; Slice 2+ adds a SupabaseRecipeRepository that
 * implements the same interface — swapping it is one line in the factory,
 * with no change anywhere above.
 *
 * All methods are async on purpose: the real database calls will be, so the
 * app is already written for it.
 */
export interface RecipeRepository {
  list(): Promise<Recipe[]>;
  getBySlug(slug: string): Promise<Recipe | null>;
}

/** In-memory adapter over the seed. No browser storage, no persistence yet. */
class MockRecipeRepository implements RecipeRepository {
  constructor(private readonly data: Recipe[]) {}

  async list(): Promise<Recipe[]> {
    return this.data;
  }

  async getBySlug(slug: string): Promise<Recipe | null> {
    return this.data.find((r) => r.slug === slug) ?? null;
  }
}

let repo: RecipeRepository | null = null;

/**
 * Returns the active recipe repository. Today: mock/seed. When Supabase is
 * wired (Slice 2), this factory returns the Supabase adapter when configured
 * and falls back to mock otherwise — the only place that decision is made.
 */
export function getRecipeRepository(): RecipeRepository {
  if (!repo) {
    repo = new MockRecipeRepository(SEED_RECIPES);
  }
  return repo;
}
