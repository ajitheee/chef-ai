import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  ENGINE_VERSION,
  buildUserContent,
  buildRefineMessage,
  buildVariationsMessage,
} from "./prompt";
import {
  PRODUCTION_SHEET_JSON_SCHEMA,
  ProductionSheetSchema,
  VARIATIONS_JSON_SCHEMA,
  VariationsResultSchema,
  type ScaleInput,
  type ProductionSheet,
  type VariationsInput,
  type VariationsResult,
} from "./schema";
import { retrieveKnowledge, KNOWLEDGE_PACK_VERSION } from "./brain/retrieve";

// Default model — override with ANTHROPIC_MODEL in .env.local if your key
// has access to a different Claude version.
// Sonnet 5 measured 31 s vs 52 s for Sonnet 4.5 on the same 20-ingredient
// card with the same output size (2026-09-21). Override with ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Per-call engine timeout. A long card can take 60-90 s to generate; the
// routes allow 300 s (maxDuration), and with one retry the worst case stays
// under that — so a slow call falls back to the built-in estimate instead of
// the platform killing the function mid-response.
export const ENGINE_TIMEOUT_MS = Number(process.env.ENGINE_TIMEOUT_MS) || 140_000;

// The system prompt (+ the tool schema that precedes it in the request) is
// identical on every call, so it's marked as a prompt-cache breakpoint:
// after the first call it's read from cache at ~10% of the input price.
const CACHED_SYSTEM = [
  { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } } as Anthropic.TextBlockParam,
];

export type EngineUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

function usageOf(response: Anthropic.Message): EngineUsage {
  const u = response.usage as unknown as {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
  return {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Calls Claude with the Kitchen Brain engine (Master Prompt + application
 * contract, plus the Knowledge Pack sections retrieved for this job) and
 * returns a validated production sheet. The Anthropic client is created lazily so the app builds
 * and imports fine even before an API key exists.
 */
export async function scaleRecipe(
  input: ScaleInput
): Promise<{ sheet: ProductionSheet; usage: EngineUsage; knowledge: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Copy .env.local.example to .env.local and add your key to run the engine."
    );
  }

  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const knowledge = retrieveKnowledge(input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: CACHED_SYSTEM,
    tools: [
      {
        name: "emit_production_sheet",
        description: "Return the scaled dining-hall production sheet as structured data.",
        input_schema: PRODUCTION_SHEET_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_production_sheet" },
    messages: [{ role: "user", content: buildUserContent(input, knowledge.sections) }],
  }, { timeout: ENGINE_TIMEOUT_MS });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("The engine did not return a production sheet. Try again.");
  }

  const parsed = ProductionSheetSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error("Engine output failed validation: " + parsed.error.message);
  }
  const sheet = parsed.data;
  sheet.status = sheet.status || "Draft"; // recipe lifecycle: generated, not yet tested
  sheet.assumptions = [
    ...sheet.assumptions,
    `Engine: ${ENGINE_VERSION} (${MODEL}) · Knowledge Pack v${KNOWLEDGE_PACK_VERSION}: ${knowledge.titles.join("; ")}.`,
  ];
  return { sheet, usage: usageOf(response), knowledge: knowledge.titles };
}

/**
 * If the error means the LIVE engine can't be used right now (bad key, rate
 * limit, outage, network), return a plain-English reason; otherwise null.
 * Routes use it to fall back to the built-in scaler instead of failing — a
 * chef must never see raw JSON.
 */
export function engineFailure(e: unknown): string | null {
  const status = e instanceof Anthropic.APIError ? e.status : undefined;
  const msg = e instanceof Error ? e.message : String(e);
  if (e instanceof Anthropic.APIConnectionTimeoutError || /timed out|timeout/i.test(msg)) {
    return "The AI engine took too long on this recipe.";
  }
  if (status === 401 || /authentication_error|api key is invalid|invalid x-api-key|Missing ANTHROPIC_API_KEY/i.test(msg)) {
    return "The AI engine's API key is invalid or missing on the server.";
  }
  if (status === 403 || /permission_error/i.test(msg)) return "The AI engine's API key doesn't have access to this model.";
  if (status === 404 || /not_found_error/i.test(msg)) return "The configured AI model isn't available to this key (check ANTHROPIC_MODEL).";
  if (status === 429 || /rate_limit/i.test(msg)) return "The AI engine is rate-limited right now — try again in a minute.";
  if ((status !== undefined && status >= 500) || /overloaded|api_error|internal server/i.test(msg)) {
    return "The AI engine is temporarily unavailable.";
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(msg)) return "The AI engine couldn't be reached.";
  return null;
}

/** A readable message for any engine error a route can't recover from (never the raw JSON blob). */
export function friendlyEngineError(e: unknown, fallback: string): string {
  if (e instanceof Anthropic.APIError) {
    const raw = e.message || "";
    const m = raw.match(/"message"\s*:\s*"([^"]+)"/);
    return `The AI engine rejected the request: ${m ? m[1] : raw.slice(0, 160)}`;
  }
  return e instanceof Error ? e.message : fallback;
}

/**
 * Variations / options: propose 2-3 distinct versions of a dish or recipe.
 */
export async function suggestVariations(input: VariationsInput): Promise<VariationsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Copy .env.local.example to .env.local and add your key to run the engine."
    );
  }

  const client = new Anthropic({ apiKey, maxRetries: 1 });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: CACHED_SYSTEM,
    tools: [
      {
        name: "emit_variations",
        description: "Return 2-3 practical recipe variations as structured data.",
        input_schema: VARIATIONS_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_variations" },
    messages: [{ role: "user", content: buildVariationsMessage(input) }],
  }, { timeout: ENGINE_TIMEOUT_MS });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("The engine did not return variations. Try again.");
  }
  const parsed = VariationsResultSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error("Variations failed validation: " + parsed.error.message);
  }
  return parsed.data;
}

/**
 * Multi-turn refinement: transforms the active production sheet per the
 * chef's instruction. The sheet object is the single source of truth.
 */
export async function refineSheet(
  sheet: ProductionSheet,
  instruction: string
): Promise<ProductionSheet> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Copy .env.local.example to .env.local and add your key to run the engine."
    );
  }

  const client = new Anthropic({ apiKey, maxRetries: 1 });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: CACHED_SYSTEM,
    tools: [
      {
        name: "emit_production_sheet",
        description: "Return the updated dining-hall production sheet as structured data.",
        input_schema: PRODUCTION_SHEET_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_production_sheet" },
    messages: [
      { role: "user", content: buildRefineMessage(JSON.stringify(sheet), instruction) },
    ],
  }, { timeout: ENGINE_TIMEOUT_MS });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("The engine did not return an updated sheet. Try again.");
  }

  const parsed = ProductionSheetSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error("Engine output failed validation: " + parsed.error.message);
  }
  const updated = parsed.data;
  // Preserve safety/allergen flags the model may have silently dropped — empty
  // defaults must never wipe a hazard flagged on the prior sheet.
  return {
    ...updated,
    status: "Draft",
    safetyFlags: updated.safetyFlags.length ? updated.safetyFlags : sheet.safetyFlags,
    allergenFlags: updated.allergenFlags.length ? updated.allergenFlags : sheet.allergenFlags,
    assumptions: [...updated.assumptions, `Engine: ${ENGINE_VERSION} (${MODEL}) · refined.`],
  };
}
