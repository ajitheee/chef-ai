"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductionSheet } from "./engine/schema";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/client";
import { slugify } from "./data/slug";
import * as local from "./storage";
import * as localNotes from "./kitchen";
import * as localPrices from "./prices";
import type { SavedRecipe, SheetHistoryEntry } from "./storage";
import type { KitchenNote } from "./kitchen";
import type { PriceItem } from "./prices";

export type { SavedRecipe, SheetHistoryEntry, KitchenNote, PriceItem };

/**
 * The scaler's working data — saved recipes, sheet history, kitchen memory,
 * price book — behind ONE interface with two adapters:
 *   - local:    browser storage (no database connected; per device)
 *   - supabase: the chef's own rows, row-level-secured to his login (any device)
 * The page never knows which. getStore() decides from the environment.
 */

export interface KitchenStore {
  readonly kind: "local" | "supabase";
  recipes: {
    list(): Promise<SavedRecipe[]>;
    save(r: Omit<SavedRecipe, "id">): Promise<SavedRecipe[]>;
    remove(id: string): Promise<SavedRecipe[]>;
  };
  history: {
    list(): Promise<SheetHistoryEntry[]>;
    add(dish: string, covers: number, sheet: ProductionSheet): Promise<SheetHistoryEntry[]>;
    remove(id: string): Promise<SheetHistoryEntry[]>;
  };
  notes: {
    list(): Promise<KitchenNote[]>;
    add(text: string): Promise<KitchenNote[]>;
    remove(id: string): Promise<KitchenNote[]>;
  };
  prices: {
    list(): Promise<PriceItem[]>;
    add(name: string, unit: string, price: number): Promise<PriceItem[]>;
    remove(id: string): Promise<PriceItem[]>;
  };
}

const HISTORY_MAX = 20;

/* ---------- local (browser storage) ---------- */

class LocalStore implements KitchenStore {
  readonly kind = "local" as const;
  recipes: KitchenStore["recipes"] = {
    list: async () => local.getRecipes(),
    save: async (r) => local.saveRecipe(r),
    remove: async (id) => local.deleteRecipe(id),
  };
  history: KitchenStore["history"] = {
    list: async () => local.getHistory(),
    add: async (dish, covers, sheet) => local.addToHistory(dish, covers, sheet),
    remove: async (id) => local.deleteFromHistory(id),
  };
  notes: KitchenStore["notes"] = {
    list: async () => localNotes.getKitchenNotes(),
    add: async (text) => localNotes.addKitchenNote(text),
    remove: async (id) => localNotes.removeKitchenNote(id),
  };
  prices: KitchenStore["prices"] = {
    list: async () => localPrices.getPrices(),
    add: async (name, unit, price) => localPrices.addPrice(name, unit, price),
    remove: async (id) => localPrices.removePrice(id),
  };
}

/* ---------- supabase (the chef's rows) ---------- */

type RecipeRow = {
  id: string;
  name: string;
  recipe_text: string;
  base_portions: number;
  portion_size: string;
  equipment: string | null;
  holding_time: string | null;
  last_covers: number | null;
};
const RECIPE_COLS = "id,name,recipe_text,base_portions,portion_size,equipment,holding_time,last_covers";

type SheetRow = { id: string; dish: string; covers: number; sheet: unknown; created_at: string };
type NoteRow = { id: string; text: string; created_at: string };
type PriceRow = { id: string; name: string; unit: string; price: number | string };

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

class SupabaseStore implements KitchenStore {
  readonly kind = "supabase" as const;

  constructor(private readonly db: SupabaseClient) {}

  private async uniqueSlug(base: string): Promise<string> {
    const { data } = await this.db.from("recipes").select("slug").like("slug", `${base}%`);
    const taken = new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
    let s = base;
    let i = 2;
    while (taken.has(s)) s = `${base}-${i++}`;
    return s;
  }

  recipes: KitchenStore["recipes"] = {
    list: async () => {
      const { data, error } = await this.db.from("recipes").select(RECIPE_COLS).order("created_at", { ascending: false });
      fail(error);
      return ((data ?? []) as RecipeRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        recipeText: r.recipe_text,
        basePortions: r.base_portions,
        portionSize: r.portion_size,
        equipment: r.equipment ?? undefined,
        holdingTime: r.holding_time ?? undefined,
        lastCovers: r.last_covers ?? undefined,
      }));
    },
    // Same name = same recipe (case-insensitive), like the local store: update it.
    save: async (r) => {
      const row = {
        name: r.name.trim(),
        recipe_text: r.recipeText,
        base_portions: r.basePortions,
        portion_size: r.portionSize,
        equipment: r.equipment || null,
        holding_time: r.holdingTime || null,
        last_covers: r.lastCovers ?? null,
      };
      const { data: existing } = await this.db.from("recipes").select("id").ilike("name", row.name).limit(1).maybeSingle();
      const res = existing
        ? await this.db.from("recipes").update({ ...row, updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id)
        : await this.db.from("recipes").insert({ ...row, slug: await this.uniqueSlug(slugify(row.name)) });
      fail(res.error);
      return this.recipes.list();
    },
    remove: async (id) => {
      const { error } = await this.db.from("recipes").delete().eq("id", id);
      fail(error);
      return this.recipes.list();
    },
  };

  history: KitchenStore["history"] = {
    list: async () => {
      const { data, error } = await this.db
        .from("sheets")
        .select("id,dish,covers,sheet,created_at")
        .order("created_at", { ascending: false })
        .limit(HISTORY_MAX);
      fail(error);
      return ((data ?? []) as SheetRow[]).map((r) => ({
        id: r.id,
        dish: r.dish,
        covers: r.covers,
        savedAt: new Date(r.created_at).toLocaleString(),
        sheet: r.sheet,
      }));
    },
    add: async (dish, covers, sheet) => {
      const { error } = await this.db.from("sheets").insert({ dish, covers, sheet });
      fail(error);
      // Keep only the newest HISTORY_MAX, same as the local store.
      const { data } = await this.db.from("sheets").select("id").order("created_at", { ascending: false });
      const extra = ((data ?? []) as { id: string }[]).slice(HISTORY_MAX).map((r) => r.id);
      if (extra.length) await this.db.from("sheets").delete().in("id", extra);
      return this.history.list();
    },
    remove: async (id) => {
      const { error } = await this.db.from("sheets").delete().eq("id", id);
      fail(error);
      return this.history.list();
    },
  };

  notes: KitchenStore["notes"] = {
    list: async () => {
      const { data, error } = await this.db.from("kitchen_notes").select("id,text,created_at").order("created_at", { ascending: false });
      fail(error);
      return ((data ?? []) as NoteRow[]).map((r) => ({ id: r.id, text: r.text, addedAt: new Date(r.created_at).toLocaleDateString() }));
    },
    add: async (text) => {
      const { error } = await this.db.from("kitchen_notes").insert({ text: text.trim() });
      fail(error);
      return this.notes.list();
    },
    remove: async (id) => {
      const { error } = await this.db.from("kitchen_notes").delete().eq("id", id);
      fail(error);
      return this.notes.list();
    },
  };

  prices: KitchenStore["prices"] = {
    list: async () => {
      const { data, error } = await this.db.from("prices").select("id,name,unit,price").order("created_at", { ascending: false });
      fail(error);
      return ((data ?? []) as PriceRow[]).map((r) => ({ id: r.id, name: r.name, unit: r.unit, price: Number(r.price) }));
    },
    // Same ingredient name replaces the old price, like the local store.
    add: async (name, unit, price) => {
      const clean = { name: name.trim(), unit: unit.trim() || "unit", price };
      const { data: existing } = await this.db.from("prices").select("id").ilike("name", clean.name).limit(1).maybeSingle();
      const res = existing
        ? await this.db.from("prices").update(clean).eq("id", (existing as { id: string }).id)
        : await this.db.from("prices").insert(clean);
      fail(res.error);
      return this.prices.list();
    },
    remove: async (id) => {
      const { error } = await this.db.from("prices").delete().eq("id", id);
      fail(error);
      return this.prices.list();
    },
  };
}

/* ---------- factory ---------- */

let cached: KitchenStore | null = null;

/** The active store for this browser: Supabase when connected, otherwise browser storage. */
export function getStore(): KitchenStore {
  if (cached) return cached;
  const db = isSupabaseConfigured() ? createClient() : null;
  cached = db ? new SupabaseStore(db) : new LocalStore();
  return cached;
}
