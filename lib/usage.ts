import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import type { EngineUsage } from "./engine/claude";

/**
 * AI spend per kitchen. Every engine call records its tokens; the month is
 * summed, priced at the configured rates, and compared with the budget. Chat
 * and scaling stop at the budget and start again on the first of the month.
 * Without a database (the local demo) the count lives in memory and nothing
 * is capped, because there is no kitchen to cap.
 *
 * The prices are an estimate: set the four AI_PRICE_* variables to the
 * model's actual rate from the Anthropic console. Tokens are what is stored,
 * so a rate change re-prices the month correctly.
 */

const rate = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** Dollars per kitchen per month. Set to 0 for no cap. */
export const MONTHLY_AI_BUDGET_USD = (() => {
  const raw = process.env.MONTHLY_AI_BUDGET_USD;
  if (raw === undefined || raw.trim() === "") return 50;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : 50;
})();

/** Dollars per million tokens. Defaults are Sonnet-class list prices. */
export const RATES = {
  input: rate("AI_PRICE_INPUT_PER_M", 3),
  output: rate("AI_PRICE_OUTPUT_PER_M", 15),
  cacheRead: rate("AI_PRICE_CACHE_READ_PER_M", 0.3),
  cacheWrite: rate("AI_PRICE_CACHE_WRITE_PER_M", 3.75),
};

export type UsageKind = "chat" | "scale" | "refine" | "variations";
export type UsageDb = SupabaseClient | null;
export type MonthUsage = {
  usd: number;
  tokens: number;
  budgetUsd: number;
  resetsOn: string;
  scope: "month" | "session";
  needsMigration?: boolean;
};

export const estimateUsd = (u: EngineUsage) =>
  (u.input * RATES.input + u.output * RATES.output + u.cacheRead * RATES.cacheRead + u.cacheWrite * RATES.cacheWrite) / 1_000_000;
const tokensOf = (u: EngineUsage) => u.input + u.output + u.cacheRead + u.cacheWrite;

const g = globalThis as unknown as { __chefaiUsage?: EngineUsage };
const session = () => (g.__chefaiUsage ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

const missingSchema = (e: { message: string; code?: string }) => /schema cache|does not exist|PGRST20[45]|42703|42P01/i.test(`${e.code ?? ""} ${e.message}`);

/** Resolve the database inside the request, before any streaming starts. */
export const usageDb = (): Promise<UsageDb> => createClient();

function monthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function nextMonthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

type Row = { tokens_in: number; tokens_out: number; cache_read: number; cache_write: number };

export async function monthUsage(db: UsageDb): Promise<MonthUsage> {
  const resetsOn = nextMonthStart().toISOString().slice(0, 10);
  if (!db) {
    const u = session();
    return { usd: estimateUsd(u), tokens: tokensOf(u), budgetUsd: MONTHLY_AI_BUDGET_USD, resetsOn, scope: "session" };
  }
  const { data, error } = await db
    .from("usage_events")
    .select("tokens_in,tokens_out,cache_read,cache_write")
    .gte("created_at", monthStart().toISOString());
  if (error) {
    if (missingSchema(error)) return { usd: 0, tokens: 0, budgetUsd: MONTHLY_AI_BUDGET_USD, resetsOn, scope: "month", needsMigration: true };
    throw new Error(error.message);
  }
  const u: EngineUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const r of (data ?? []) as Row[]) {
    u.input += r.tokens_in;
    u.output += r.tokens_out;
    u.cacheRead += r.cache_read;
    u.cacheWrite += r.cache_write;
  }
  return { usd: estimateUsd(u), tokens: tokensOf(u), budgetUsd: MONTHLY_AI_BUDGET_USD, resetsOn, scope: "month" };
}

/** Null when the kitchen may spend; otherwise the sentence to show. A failed check never blocks. */
export async function budgetGate(db: UsageDb): Promise<string | null> {
  try {
    const u = await monthUsage(db);
    if (u.scope === "month" && u.budgetUsd > 0 && u.usd >= u.budgetUsd) {
      return `This kitchen has used its monthly AI budget ($${u.budgetUsd.toFixed(0)}). It resets on ${u.resetsOn}. Ask your admin to raise it.`;
    }
    return null;
  } catch (e) {
    console.error("[usage] budget check failed:", e);
    return null;
  }
}

export async function recordUsage(db: UsageDb, kind: UsageKind, usage: EngineUsage): Promise<void> {
  try {
    if (!db) {
      const s = session();
      s.input += usage.input;
      s.output += usage.output;
      s.cacheRead += usage.cacheRead;
      s.cacheWrite += usage.cacheWrite;
      return;
    }
    const { error } = await db.from("usage_events").insert({
      kind,
      tokens_in: usage.input,
      tokens_out: usage.output,
      cache_read: usage.cacheRead,
      cache_write: usage.cacheWrite,
    });
    if (error && !missingSchema(error)) console.error("[usage] record failed:", error.message);
  } catch (e) {
    console.error("[usage] record failed:", e);
  }
}
