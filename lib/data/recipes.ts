import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recipe } from "./types";
import { SEED_RECIPES } from "./seed";
import { slugify } from "./slug";
import { PRESETS } from "@/lib/engine/sample";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * The single door to recipe data. Pages, routes and server actions go through
 * this interface and never touch a storage engine directly. Two adapters:
 *   - mock: in-memory over the seed (no database connected)
 *   - supabase: the chef's own rows, row-level-secured to his login
 * The factory picks one from the environment — the only place that decision
 * is made. Server-only (the Supabase adapter reads the session from cookies).
 */

export type NewRecipe = Omit<Recipe, "id" | "slug"> & { slug?: string };

export interface RecipeRepository {
  readonly kind: "mock" | "supabase";
  list(): Promise<Recipe[]>;
  getBySlug(slug: string): Promise<Recipe | null>;
  create(input: NewRecipe): Promise<Recipe>;
  remove(id: string): Promise<void>;
  /** Insert recipes that aren't there yet (by slug); returns how many landed. */
  importMany(recipes: Recipe[]): Promise<number>;
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let s = base;
  let i = 2;
  while (taken.has(s)) s = `${base}-${i++}`;
  return s;
}

/* ---------- mock adapter ---------- */

class MockRecipeRepository implements RecipeRepository {
  readonly kind = "mock" as const;
  private data: Recipe[];

  constructor(seed: Recipe[]) {
    this.data = [...seed];
  }

  async list(): Promise<Recipe[]> {
    return this.data;
  }

  async getBySlug(slug: string): Promise<Recipe | null> {
    return this.data.find((r) => r.slug === slug) ?? null;
  }

  async create(input: NewRecipe): Promise<Recipe> {
    const slug = uniqueSlug(input.slug ?? slugify(input.name), new Set(this.data.map((r) => r.slug)));
    const recipe: Recipe = { ...input, id: `local-${Date.now()}`, slug };
    this.data = [recipe, ...this.data];
    return recipe;
  }

  async remove(id: string): Promise<void> {
    this.data = this.data.filter((r) => r.id !== id);
  }

  async importMany(recipes: Recipe[]): Promise<number> {
    const taken = new Set(this.data.map((r) => r.slug));
    let n = 0;
    for (const r of recipes) {
      if (taken.has(r.slug)) continue;
      this.data.push(r);
      taken.add(r.slug);
      n++;
    }
    return n;
  }
}

/* ---------- supabase adapter ---------- */

type Row = {
  id: string;
  slug: string;
  name: string;
  recipe_text: string;
  base_portions: number;
  portion_size: string;
  equipment: string | null;
  holding_time: string | null;
  tags: string[] | null;
};

const fromRow = (r: Row): Recipe => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  recipeText: r.recipe_text,
  basePortions: r.base_portions,
  portionSize: r.portion_size,
  equipment: r.equipment ?? undefined,
  holdingTime: r.holding_time ?? undefined,
  tags: r.tags ?? [],
});

const toRow = (r: NewRecipe & { slug: string }) => ({
  slug: r.slug,
  name: r.name,
  recipe_text: r.recipeText,
  base_portions: r.basePortions,
  portion_size: r.portionSize,
  equipment: r.equipment ?? null,
  holding_time: r.holdingTime ?? null,
  tags: r.tags ?? [],
});

class SupabaseRecipeRepository implements RecipeRepository {
  readonly kind = "supabase" as const;

  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<Recipe[]> {
    const { data, error } = await this.db.from("recipes").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Row[]).map(fromRow);
  }

  async getBySlug(slug: string): Promise<Recipe | null> {
    const { data, error } = await this.db.from("recipes").select("*").eq("slug", slug).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as Row) : null;
  }

  async create(input: NewRecipe): Promise<Recipe> {
    const base = input.slug ?? slugify(input.name);
    const { data: existing } = await this.db.from("recipes").select("slug").like("slug", `${base}%`);
    const slug = uniqueSlug(base, new Set(((existing ?? []) as { slug: string }[]).map((e) => e.slug)));
    const { data, error } = await this.db.from("recipes").insert(toRow({ ...input, slug })).select("*").single();
    if (error) throw new Error(error.message);
    return fromRow(data as Row);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from("recipes").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async importMany(recipes: Recipe[]): Promise<number> {
    const rows = recipes.map((r) => toRow(r));
    const { data, error } = await this.db
      .from("recipes")
      .upsert(rows, { onConflict: "user_id,slug", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  }
}

/* ---------- factory ---------- */

// One mock store per server process. It lives on globalThis because Next
// compiles server actions and pages into separate module graphs — a plain
// module-level singleton would give each bundle its own copy.
const g = globalThis as unknown as { __chefaiMockRecipes?: MockRecipeRepository };

/** The active repository: Supabase when connected (and the user is signed in), otherwise the mock seed. */
export async function getRecipeRepository(): Promise<RecipeRepository> {
  if (isSupabaseConfigured()) {
    const db = await createClient();
    if (db) return new SupabaseRecipeRepository(db);
  }
  if (!g.__chefaiMockRecipes) g.__chefaiMockRecipes = new MockRecipeRepository(SEED_RECIPES);
  return g.__chefaiMockRecipes;
}

/** The 50 test recipes — importable into a fresh database with one click. */
export const STARTER_RECIPES: Recipe[] = SEED_RECIPES;

/** The chef's own four Centerpointe recipes — what his library should start with. */
export const CHEF_RECIPES: Recipe[] = PRESETS.map((p) => ({
  id: `chef-${slugify(p.name)}`,
  slug: slugify(p.name),
  name: p.name,
  recipeText: p.recipeText,
  basePortions: p.basePortions,
  portionSize: p.portionSize,
  equipment: p.equipment,
  holdingTime: p.holdingTime,
  tags: ["centerpointe"],
}));
