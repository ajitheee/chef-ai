import type { ProductionSheet } from "./engine/schema";
import type { EngineUsage } from "./engine/claude";

/**
 * What flows from /api/chat to the Kitchen Brain page: one JSON event per
 * line. Shared by the route and the page so neither can drift.
 */

export type ChatCard = {
  name: string;
  recipeText: string;
  basePortions: number;
  portionSize: string;
  equipment?: string;
  holdingTime?: string;
};

export type ToolPayload =
  | { kind: "library"; count: number; names: string[] }
  | { kind: "recipe"; name: string; status?: string }
  | { kind: "sheet"; sheet: ProductionSheet; covers: number; demo: boolean; note?: string; ms: number; card: ChatCard };

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; label: string }
  | { type: "tool_done"; id: string; name: string; label: string; ok: boolean; payload?: ToolPayload }
  | { type: "done"; usage?: EngineUsage; engine: string; model?: string; knowledge: string[]; demo: boolean; note?: string }
  | { type: "error"; message: string };
