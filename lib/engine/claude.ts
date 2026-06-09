import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserContent, buildRefineMessage } from "./prompt";
import {
  PRODUCTION_SHEET_JSON_SCHEMA,
  ProductionSheetSchema,
  type ScaleInput,
  type ProductionSheet,
} from "./schema";

// Default model — override with ANTHROPIC_MODEL in .env.local if your key
// has access to a different Claude version.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

/**
 * Calls Claude with the v3.3 dining-hall engine and returns a validated
 * production sheet. The Anthropic client is created lazily so the app builds
 * and imports fine even before an API key exists.
 */
export async function scaleRecipe(input: ScaleInput): Promise<ProductionSheet> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Copy .env.local.example to .env.local and add your key to run the engine."
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    // NOTE: prompt caching (a ~90% cost saver on the large system prompt) is a
    // Week-2 optimization — re-add via the SDK's caching API once the model/SDK
    // version is locked. Trivial cost at design-partner volume without it.
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "emit_production_sheet",
        description: "Return the scaled dining-hall production sheet as structured data.",
        input_schema: PRODUCTION_SHEET_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_production_sheet" },
    messages: [{ role: "user", content: buildUserContent(input) }],
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("The engine did not return a production sheet. Try again.");
  }

  const parsed = ProductionSheetSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error("Engine output failed validation: " + parsed.error.message);
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

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
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
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("The engine did not return an updated sheet. Try again.");
  }

  const parsed = ProductionSheetSchema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error("Engine output failed validation: " + parsed.error.message);
  }
  return parsed.data;
}
