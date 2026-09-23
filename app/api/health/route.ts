import { NextResponse } from "next/server";
import { MODEL } from "@/lib/engine/claude";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { MASTER_PROMPT_VERSION } from "@/lib/engine/brain/master-prompt";
import { KNOWLEDGE_PACK_VERSION, KNOWLEDGE_SECTIONS } from "@/lib/engine/brain/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, secret-free status: is the live engine's key accepted, is the
 * database connected, which build is deployed. Uses Anthropic's free
 * /v1/models endpoint (no tokens spent) and caches the answer for a minute.
 */
type Engine = "live" | "no_key" | "invalid_key" | "key_no_access" | "unreachable";
const g = globalThis as unknown as { __chefaiHealth?: { at: number; engine: Engine } };

async function engineStatus(): Promise<Engine> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "no_key";
  const cached = g.__chefaiHealth;
  if (cached && Date.now() - cached.at < 60_000) return cached.engine;
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
  g.__chefaiHealth = { at: Date.now(), engine };
  return engine;
}

export async function GET() {
  const engine = await engineStatus();
  return NextResponse.json({
    ok: true,
    engine,
    model: MODEL,
    brain: { masterPrompt: MASTER_PROMPT_VERSION, knowledgePack: KNOWLEDGE_PACK_VERSION, sections: KNOWLEDGE_SECTIONS.length },
    database: isSupabaseConfigured() ? "connected" : "not_configured",
    access: isSupabaseConfigured() ? "supabase-login" : process.env.APP_PASSWORD ? "password-gate" : "open",
    build: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
  });
}
