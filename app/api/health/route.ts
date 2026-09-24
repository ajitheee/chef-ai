import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MODEL } from "@/lib/engine/claude";
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { MASTER_PROMPT_VERSION } from "@/lib/engine/brain/master-prompt";
import { KNOWLEDGE_PACK_VERSION, KNOWLEDGE_SECTIONS } from "@/lib/engine/brain/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, secret-free status: is the live engine's key accepted, is the
 * database really answering, which brain and build are deployed. Uses
 * Anthropic's free /v1/models endpoint (no tokens spent) and caches both
 * checks for a minute.
 *
 * The daily cron in vercel.json calls this too: the database query counts as
 * activity, which keeps a free-tier Supabase project from being paused.
 */
type Engine = "live" | "no_key" | "invalid_key" | "key_no_access" | "unreachable";
type Database = "connected" | "unreachable" | "not_configured";
type DbCheck = { status: Database; latencyMs: number; error?: string };
type Cached = { engineAt: number; engine?: Engine; dbAt: number; database?: DbCheck };
const g = globalThis as unknown as { __chefaiHealth?: Cached };
const cache = () => (g.__chefaiHealth ??= { engineAt: 0, dbAt: 0 });
const TTL = 60_000;

async function engineStatus(): Promise<Engine> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "no_key";
  const c = cache();
  if (c.engine && Date.now() - c.engineAt < TTL) return c.engine;
  let engine: Engine;
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      cache: "no-store",
    });
    engine = r.status === 401 ? "invalid_key" : r.status === 403 ? "key_no_access" : r.ok ? "live" : "unreachable";
  } catch {
    engine = "unreachable";
  }
  c.engine = engine;
  c.engineAt = Date.now();
  return engine;
}

/** A real one-row query with the public anon key. RLS returns no rows, which is fine — an answer proves the database is up. */
async function databaseStatus(): Promise<DbCheck> {
  if (!isSupabaseConfigured()) return { status: "not_configured", latencyMs: 0 };
  const c = cache();
  if (c.database && Date.now() - c.dbAt < TTL) return c.database;
  const t0 = Date.now();
  let result: DbCheck;
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error } = await db.from("recipes").select("id").limit(1);
    result = error
      ? { status: "unreachable", latencyMs: Date.now() - t0, error: error.message }
      : { status: "connected", latencyMs: Date.now() - t0 };
  } catch (e) {
    result = { status: "unreachable", latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
  if (result.status !== "connected") console.error("[health] database", result);
  c.database = result;
  c.dbAt = Date.now();
  return result;
}

export async function GET() {
  const [engine, database] = await Promise.all([engineStatus(), databaseStatus()]);
  return NextResponse.json({
    ok: engine === "live" && database.status !== "unreachable",
    engine,
    model: MODEL,
    brain: { masterPrompt: MASTER_PROMPT_VERSION, knowledgePack: KNOWLEDGE_PACK_VERSION, sections: KNOWLEDGE_SECTIONS.length },
    database: database.status,
    databaseMs: database.latencyMs,
    access: isSupabaseConfigured() ? "supabase-login" : process.env.APP_PASSWORD ? "password-gate" : "open",
    build: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
  });
}
