"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductionSheet } from "./engine/schema";
import type { VerifiedYield } from "./engine/verified";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/client";
import { slugify } from "./data/slug";
import * as local from "./storage";
import * as localNotes from "./kitchen";
import * as localPrices from "./prices";
import * as localYields from "./yields";
import type { SavedRecipe, SheetHistoryEntry } from "./storage";
import type { KitchenNote } from "./kitchen";
import type { PriceItem } from "./prices";
import type { VerifiedYieldItem } from "./yields";

export type { SavedRecipe, SheetHistoryEntry, KitchenNote, PriceItem, VerifiedYieldItem };

/**
 * The scaler's working data — saved recipes, sheet history, kitchen memory,
 * price book, verified yields — behind ONE interface with two adapters:
 *   - local:    browser storage (no database connected; per device)
 *   - supabase: the chef's own rows, row-level-secured to his login (any device)
 * The page never knows which. getStore() decides from the environment.
 */

export interface KitchenStore {
  readonly kind: "local" | "supabase";
  /** True once the database turned out to be missing migration 0003 (yields, note pause, versions). */
  readonly needsMigration: boolean;
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
    /** Pause (keep, don't send) or resume a note. */
    setActive(id: string, active: boolean): Promise<KitchenNote[]>;
  };
  prices: {
    list(): Promise<PriceItem[]>;
    add(name: string, unit: string, price: number): Promise<PriceItem[]>;
    remove(id: string): Promise<PriceItem[]>;
  };
  yields: {
    list(): Promise<VerifiedYieldItem[]>;
    add(y: VerifiedYield): Promise<VerifiedYieldItem[]>;
    remove(id: string): Promise<VerifiedYieldItem[]>;
  };
}

const HISTORY_MAX = 20;

export const MIGRATION_MESSAGE =
  "This needs database migration 0003 — run supabase/migrations/0003_yields_versions_pause.sql in the Supabase SQL editor (two minutes, safe to re-run), then reload.";

/* ---------- local (browser storage) ---------- */

class LocalStore implements KitchenStore {
  readonly kind = "local" as const;
  readonly needsMigration = false;
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
    setActive: async (id, active) => localNotes.setKitchenNoteActive(id, active),
  };
  prices: KitchenStore["prices"] = {
    list: async () => localPrices.getPrices(),
    add: async (name, unit, price) => localPrices.addPrice(name, unit, price),
    remove: async (id) => localPrices.removePrice(id),
  };
  yields: KitchenStore["yields"] = {
    list: async () => localYields.getYields(),
    add: async (y) => localYields.addYield(y),
    remove: async (id) => localYields.removeYield(id),
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
  status?: string | null;
  version?: number | null;
  updated_at?: string | null;
};

type SheetRow = { id: string; dish: string; covers: number; sheet: unknown; created_at: string };
type NoteRow = { id: string; text: string; created_at: string; active?: boolean | null };
type PriceRow = { id: string; name: string; unit: string; price: number | string };
type YieldRow = { id: string; product: string; kind: "trim" | "cook"; yield_pct: number | string; source: string | null; verified_on: string | null };

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** A table or column that migration 0003 adds is not there yet. */
function missingSchema(error: { message: string; code?: string } | null): boolean {
  if (!error) return false;
  return /schema cache|does not exist|PGRST20[45]|42703|42P01/i.test(`${error.code ?? ""} ${error.message}`);
}

const dateOnly = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString() : "");

class SupabaseStore implements KitchenStore {
  readonly kind = "supabase" as const;
  needsMigration = false;

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
    // select * — the lifecycle columns arrive with migration 0003; before that they're simply absent.
    list: async () => {
      const { data, error } = await this.db.from("recipes").select("*").order("created_at", { ascending: false });
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
        status: r.status ?? "Draft",
        version: r.version ?? 1,
        savedAt: dateOnly(r.updated_at),
      }));
    },
    // Same name = same recipe (case-insensitive), like the local store: update it.
    // The database keeps the prior version itself (trigger recipes_keep_version, 0003).
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
      const { data, error } = await this.db.from("kitchen_notes").select("*").order("created_at", { ascending: false });
      fail(error);
      return ((data ?? []) as NoteRow[]).map((r) => ({
        id: r.id,
        text: r.text,
        addedAt: new Date(r.created_at).toLocaleDateString(),
        active: r.active ?? true,
      }));
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
    setActive: async (id, active) => {
      const { error } = await this.db.from("kitchen_notes").update({ active }).eq("id", id);
      if (error && missingSchema(error)) {
        this.needsMigration = true;
        throw new Error(MIGRATION_MESSAGE);
      }
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

  yields: KitchenStore["yields"] = {
    // Before migration 0003 the table doesn't exist: an empty list, and the panel says what to run.
    list: async () => {
      const { data, error } = await this.db.from("yields").select("*").order("created_at", { ascending: false });
      if (error && missingSchema(error)) {
        this.needsMigration = true;
        return [];
      }
      fail(error);
      return ((data ?? []) as YieldRow[]).map((r) => ({
        id: r.id,
        product: r.product,
        kind: r.kind,
        pct: Number(r.yield_pct),
        source: r.source ?? "",
        verifiedOn: dateOnly(r.verified_on),
      }));
    },
    // Same product + kind replaces the earlier number, like the local store.
    add: async (y) => {
      const row = {
        product: y.product.trim(),
        kind: y.kind,
        yield_pct: y.pct,
        source: (y.source ?? "").trim(),
        verified_on: new Date().toISOString().slice(0, 10),
      };
      const { data: existing, error: lookErr } = await this.db
        .from("yields")
        .select("id")
        .ilike("product", row.product)
        .eq("kind", row.kind)
        .limit(1)
        .maybeSingle();
      if (lookErr && missingSchema(lookErr)) {
        this.needsMigration = true;
        throw new Error(MIGRATION_MESSAGE);
      }
      fail(lookErr);
      const res = existing
        ? await this.db.from("yields").update(row).eq("id", (existing as { id: string }).id)
        : await this.db.from("yields").insert(row);
      fail(res.error);
      return this.yields.list();
    },
    remove: async (id) => {
      const { error } = await this.db.from("yields").delete().eq("id", id);
      fail(error);
      return this.yields.list();
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
