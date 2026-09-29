import type { ProductionSheet } from "./engine/schema";
import type { EngineUsage } from "./engine/claude";

/**
 * What flows from /api/chat to the Kitchen Brain page (one JSON event per
 * line), and the shape a saved message keeps. Shared by the route, the page
 * and the store so none of them can drift.
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

/** What an answer was made of, in the order it arrived: text, a tool call, more text. */
export type ChatPart =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; label: string; done: boolean; ok?: boolean; payload?: ToolPayload };

export type ChatMeta = {
  engine?: string;
  model?: string;
  usage?: EngineUsage;
  knowledge?: string[];
  demo?: boolean;
  note?: string;
  error?: string;
  stopped?: boolean;
};

/** A message as the page shows it and the store keeps it. */
export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  parts: ChatPart[];
  meta?: ChatMeta;
  createdAt: string;
};

export type ConversationSummary = { id: string; title: string; updatedAt: string };
