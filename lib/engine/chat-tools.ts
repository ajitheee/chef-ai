import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { RecipeRepository } from "../data/recipes";
import type { Recipe } from "../data/types";
import type { ToolPayload, ChatCard } from "../chat-events";
import { ScaleInputSchema, type ProductionSheet, type VerifiedYieldInput } from "./schema";
import { runScale } from "./scale-job";
import { validateSheet } from "./validate";

/**
 * The tools Kitchen Brain may call in conversation: read the library, read
 * one card, run the real scaler. Saving is deliberately not a tool: the chef
 * saves a card with a button under it, which is the approval gate.
 */
export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_library",
    description:
      "List the recipes in this kitchen's library: name, base portions, portion size and lifecycle status. Use it when the chef names a recipe, asks what is in the library, or before reading a card. Never guess what a library card contains.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Optional word to filter recipe names by." } },
    } as unknown as Anthropic.Tool.InputSchema,
  },
  {
    name: "read_recipe",
    description:
      "Read one library recipe by name: the full card (ingredients and method), base portions, portion size, equipment, hold time and lifecycle status. Use it before discussing, changing or scaling a library recipe.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "The recipe name as listed in the library." } },
      required: ["name"],
    } as unknown as Anthropic.Tool.InputSchema,
  },
  {
    name: "scale_recipe",
    description:
      "Run the production scaler on a recipe card for a cover count. It returns the checked production sheet: scaled quantities with multipliers, batching, holding, pull list and the accuracy checks. Use it only when the chef asks for quantities at a cover count and the card is complete; for a card built or changed in this conversation, only after the chef has approved it (pressed Scale it for N covers, or said so). Give libraryName to scale a library recipe unchanged, or give the card fields. It takes 30 to 60 seconds; never call it twice for the same card and count.",
    input_schema: {
      type: "object",
      properties: {
        libraryName: { type: "string", description: "Scale this library recipe as it is saved." },
        name: { type: "string", description: "Dish name (when not scaling a library recipe)." },
        recipeText: { type: "string", description: "The full card: ingredients in order of use, then the method." },
        basePortions: { type: "number", description: "Portions the card makes." },
        portionSize: { type: "string", description: "One portion, for example 4 oz cooked or 2 tacos." },
        equipment: { type: "string" },
        holdingTime: { type: "string" },
        targetCovers: { type: "number", description: "Covers to scale to." },
      },
      required: ["targetCovers"],
    } as unknown as Anthropic.Tool.InputSchema,
  },
];

export type ToolContext = { repo: RecipeRepository; kitchenNotes: string[]; yields: VerifiedYieldInput[] };

export type ToolOutcome = { ok: boolean; label: string; forModel: string; payload?: ToolPayload };

const ListInput = z.object({ query: z.string().optional().default("") });
const ReadInput = z.object({ name: z.string().min(1) });
const ScaleToolInput = z.object({
  libraryName: z.string().optional(),
  name: z.string().optional(),
  recipeText: z.string().optional(),
  basePortions: z.number().positive().optional(),
  portionSize: z.string().optional(),
  equipment: z.string().optional(),
  holdingTime: z.string().optional(),
  targetCovers: z.number().positive(),
});

/** The line the chef sees while a call runs. */
export function toolLabel(name: string, input: unknown): string {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (name === "list_library") return i.query ? `Reading your library for "${String(i.query)}"` : "Reading your library";
  if (name === "read_recipe") return `Reading ${String(i.name ?? "a recipe")} from your library`;
  if (name === "scale_recipe") return `Scaling ${String(i.libraryName ?? i.name ?? "the card")} for ${String(i.targetCovers ?? "?")} covers`;
  return `Running ${name}`;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function findRecipe(repo: RecipeRepository, name: string): Promise<Recipe | null> {
  const all = await repo.list();
  const want = name.trim().toLowerCase();
  return all.find((r) => same(r.name, name)) ?? all.find((r) => r.name.toLowerCase().includes(want)) ?? null;
}

const cardOf = (r: Recipe): ChatCard => ({
  name: r.name,
  recipeText: r.recipeText,
  basePortions: r.basePortions,
  portionSize: r.portionSize,
  equipment: r.equipment,
  holdingTime: r.holdingTime,
});

const cardForModel = (r: Recipe) =>
  [
    `Name: ${r.name}`,
    `Base portions: ${r.basePortions}`,
    `Portion size: ${r.portionSize}`,
    ...(r.equipment ? [`Equipment: ${r.equipment}`] : []),
    ...(r.holdingTime ? [`Hold time: ${r.holdingTime}`] : []),
    `Status: ${r.status ?? "Draft"}`,
    "",
    r.recipeText,
  ].join("\n");

export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const label = toolLabel(name, rawInput);
  try {
    if (name === "list_library") {
      const { query } = ListInput.parse(rawInput);
      const all = await ctx.repo.list();
      const hits = query ? all.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())) : all;
      const shown = hits.slice(0, 80);
      const forModel =
        hits.length === 0
          ? query
            ? `No library recipe matches "${query}". The library has ${all.length} recipes.`
            : "The library is empty."
          : `${hits.length} recipe${hits.length === 1 ? "" : "s"}${query ? ` matching "${query}"` : ""}:\n` +
            shown.map((r) => `- ${r.name}: base ${r.basePortions}, portion ${r.portionSize}, ${r.status ?? "Draft"}`).join("\n") +
            (hits.length > shown.length ? `\n(and ${hits.length - shown.length} more)` : "");
      return {
        ok: true,
        label: query ? `Read your library for "${query}": ${hits.length} match${hits.length === 1 ? "" : "es"}` : `Read your library: ${all.length} recipes`,
        forModel,
        payload: { kind: "library", count: hits.length, names: shown.map((r) => r.name) },
      };
    }

    if (name === "read_recipe") {
      const { name: want } = ReadInput.parse(rawInput);
      const r = await findRecipe(ctx.repo, want);
      if (!r) return { ok: false, label: `No library recipe named ${want}`, forModel: `There is no library recipe named "${want}". Call list_library to see the names.` };
      return { ok: true, label: `Read ${r.name} from your library`, forModel: cardForModel(r), payload: { kind: "recipe", name: r.name, status: r.status } };
    }

    if (name === "scale_recipe") {
      const t = ScaleToolInput.parse(rawInput);
      let card: ChatCard;
      let status: string | undefined;
      if (t.libraryName) {
        const r = await findRecipe(ctx.repo, t.libraryName);
        if (!r) {
          return {
            ok: false,
            label: `No library recipe named ${t.libraryName}`,
            forModel: `There is no library recipe named "${t.libraryName}". Call list_library to see the names, or pass the card fields.`,
          };
        }
        card = cardOf(r);
        status = r.status;
      } else {
        if (!t.name || !t.recipeText || !t.basePortions || !t.portionSize) {
          return {
            ok: false,
            label: "The card is incomplete",
            forModel: "To scale a card give name, recipeText, basePortions and portionSize, or libraryName for a saved recipe.",
          };
        }
        card = { name: t.name, recipeText: t.recipeText, basePortions: t.basePortions, portionSize: t.portionSize, equipment: t.equipment, holdingTime: t.holdingTime };
      }
      const input = ScaleInputSchema.parse({
        dish: card.name,
        recipeText: card.recipeText,
        basePortions: card.basePortions,
        targetCovers: t.targetCovers,
        portionSize: card.portionSize,
        equipment: card.equipment ?? "",
        holdingTime: card.holdingTime ?? "",
        kitchenNotes: ctx.kitchenNotes,
        yields: ctx.yields,
        // A library card scaled as saved keeps its lifecycle status; anything else is a Draft.
        recipeStatus: status && status !== "Draft" ? status : undefined,
      });
      const r = await runScale(input);
      return {
        ok: true,
        label: `Scaled ${card.name} for ${t.targetCovers} covers${r.demo ? " (built-in estimate)" : ""}`,
        forModel: sheetForModel(r.sheet, r.note),
        payload: { kind: "sheet", sheet: r.sheet, covers: t.targetCovers, demo: r.demo, note: r.note, ms: r.ms, card },
      };
    }

    return { ok: false, label: `Unknown tool ${name}`, forModel: `Unknown tool "${name}".` };
  } catch (e) {
    const message =
      e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") : e instanceof Error ? e.message : String(e);
    return { ok: false, label: `${label}: failed`, forModel: `The tool failed: ${message}` };
  }
}

/** A compact rendering of a sheet for the model. The chef gets the whole sheet in the conversation. */
export function sheetForModel(s: ProductionSheet, note?: string): string {
  const checks = validateSheet(s);
  return [
    `PRODUCTION SHEET: ${s.dish}, ${s.targetYield.covers} covers at ${s.targetYield.portionSize}. Finished yield: ${s.targetYield.finishedYield}. Status: ${s.status ?? "Draft"}. Source: ${s.source === "estimate" ? "built-in estimate, not the chef-logic engine" : "chef-logic engine"}.`,
    ...(note ? [`Note: ${note}`] : []),
    `Accuracy checks: ${checks.map((c) => `${c.label} ${c.status}${c.status !== "pass" ? ` (${c.detail})` : ""}`).join("; ")}.`,
    `Ingredients: ${s.ingredients.map((i) => `${i.item}: ${i.scaledQty}${i.multiplier ? ` (${i.multiplier})` : ""}`).join("; ")}.`,
    ...(s.batching.length ? [`Batching: ${s.batching.join(" ")}`] : []),
    ...(s.holding.length ? [`Holding: ${s.holding.join(" ")}`] : []),
    ...(s.pullList.length ? [`Pull list: ${s.pullList.map((p) => `${p.item}: ${p.apQty}`).join("; ")}.`] : []),
    ...(s.allergenFlags.length ? [`Allergens: ${s.allergenFlags.join(" ")}`] : []),
    ...(s.safetyFlags.length ? [`Safety: ${s.safetyFlags.slice(0, 4).join(" ")}`] : []),
    ...(s.assumptions.length ? [`Assumptions: ${s.assumptions.slice(0, 4).join(" ")}`] : []),
    "The chef sees the full sheet in the conversation and can open it in the scaler; do not retype it. Report the checks and anything that needs attention, briefly.",
  ].join("\n");
}
