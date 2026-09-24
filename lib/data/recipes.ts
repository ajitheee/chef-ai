import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recipe, RecipeStatus, RecipeVersion } from "./types";
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
  /** Lifecycle: Draft | Tested | Approved Master. */
  setStatus(id: string, status: RecipeStatus): Promise<void>;
  /** Prior versions, newest first (empty until the database has migration 0003). */
  versions(recipeId: string): Promise<RecipeVersion[]>;
  /** Put a prior version's content back; the current content is kept as a version and the recipe returns to Draft. */
  restoreVersion(recipeId: string, version: number): Promise<void>;
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let s = base;
  let i = 2;
  while (taken.has(s)) s = `${base}-${i++}`;
  return s;
}

const stamp = () => new Date().toLocaleString();

/* ---------- mock adapter ---------- */

class MockRecipeRepository implements RecipeRepository {
  readonly kind = "mock" as const;
  private data: Recipe[];
  private history = new Map<string, RecipeVersion[]>();

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
    const recipe: Recipe = { ...input, id: `local-${Date.now()}`, slug, status: input.status ?? "Draft", version: 1 };
    this.data = [recipe, ...this.data];
    return recipe;
  }

  async remove(id: string): Promise<void> {
    this.data = this.data.filter((r) => r.id !== id);
    this.history.delete(id);
  }

  async importMany(recipes: Recipe[]): Promise<number> {
    const taken = new Set(this.data.map((r) => r.slug));
    let n = 0;
    for (const r of recipes) {
      if (taken.has(r.slug)) continue;
      this.data.push({ ...r, status: r.status ?? "Draft", version: r.version ?? 1 });
      taken.add(r.slug);
      n++;
    }
    return n;
  }

  async setStatus(id: string, status: RecipeStatus): Promise<void> {
    this.data = this.data.map((r) => (r.id === id ? { ...r, status } : r));
  }

  async versions(recipeId: string): Promise<RecipeVersion[]> {
    return this.history.get(recipeId) ?? [];
  }

  async restoreVersion(recipeId: string, version: number): Promise<void> {
    const current = this.data.find((r) => r.id === recipeId);
    const target = (this.history.get(recipeId) ?? []).find((v) => v.version === version);
    if (!current || !target) return;
    const prior: RecipeVersion = {
      version: current.version ?? 1,
      name: current.name,
      recipeText: current.recipeText,
      basePortions: current.basePortions,
      portionSize: current.portionSize,
      equipment: current.equipment,
      holdingTime: current.holdingTime,
      tags: current.tags,
      savedAt: "",
      supersededAt: stamp(),
    };
    this.history.set(recipeId, [prior, ...(this.history.get(recipeId) ?? [])]);
    this.data = this.data.map((r) =>
      r.id === recipeId
        ? {
            ...r,
            name: target.name,
            recipeText: target.recipeText,
            basePortions: target.basePortions,
            portionSize: target.portionSize,
            equipment: target.equipment,
            holdingTime: target.holdingTime,
            tags: target.tags,
            status: "Draft",
            version: (r.version ?? 1) + 1,
          }
        : r
    );
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
  status?: string | null;
  version?: number | null;
};

type VersionRow = {
  version: number;
  name: string;
  recipe_text: string;
  base_portions: number;
  portion_size: string;
  equipment: string | null;
  holding_time: string | null;
  tags: string[] | null;
  saved_at: string;
  superseded_at: string;
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
  status: (r.status as RecipeStatus | null | undefined) ?? "Draft",
  version: r.version ?? 1,
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

/** A table or column that migration 0003 adds is not there yet. */
const missingSchema = (e: { message: string; code?: string }) => /schema cache|does not exist|PGRST20[45]|42703|42P01/i.test(`${e.code ?? ""} ${e.message}`);

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

  async setStatus(id: string, status: RecipeStatus): Promise<void> {
    const { error } = await this.db.from("recipes").update({ status }).eq("id", id);
    if (error) throw new Error(missingSchema(error) ? "Recipe status needs database migration 0003 (supabase/migrations/0003_yields_versions_pause.sql)." : error.message);
  }

  async versions(recipeId: string): Promise<RecipeVersion[]> {
    const { data, error } = await this.db
      .from("recipe_versions")
      .select("version,name,recipe_text,base_portions,portion_size,equipment,holding_time,tags,saved_at,superseded_at")
      .eq("recipe_id", recipeId)
      .order("version", { ascending: false });
    if (error) {
      if (missingSchema(error)) return []; // before migration 0003
      throw new Error(error.message);
    }
    return ((data ?? []) as VersionRow[]).map((v) => ({
      version: v.version,
      name: v.name,
      recipeText: v.recipe_text,
      basePortions: v.base_portions,
      portionSize: v.portion_size,
      equipment: v.equipment ?? undefined,
      holdingTime: v.holding_time ?? undefined,
      tags: v.tags ?? [],
      savedAt: new Date(v.saved_at).toLocaleDateString(),
      supersededAt: new Date(v.superseded_at).toLocaleDateString(),
    }));
  }

  // The update trigger (0003) keeps the current content as a version and resets the status to Draft.
  async restoreVersion(recipeId: string, version: number): Promise<void> {
    const { data, error } = await this.db
      .from("recipe_versions")
      .select("name,recipe_text,base_portions,portion_size,equipment,holding_time,tags")
      .eq("recipe_id", recipeId)
      .eq("version", version)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("That version is no longer there.");
    const v = data as Omit<VersionRow, "version" | "saved_at" | "superseded_at">;
    const { error: upErr } = await this.db
      .from("recipes")
      .update({
        name: v.name,
        recipe_text: v.recipe_text,
        base_portions: v.base_portions,
        portion_size: v.portion_size,
        equipment: v.equipment,
        holding_time: v.holding_time,
        tags: v.tags ?? [],
      })
      .eq("id", recipeId);
    if (upErr) throw new Error(upErr.message);
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
