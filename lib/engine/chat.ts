import type Anthropic from "@anthropic-ai/sdk";
import { MASTER_PROMPT, MASTER_PROMPT_VERSION } from "./brain/master-prompt";
import { CHAT_CONTRACT } from "./brain/chat-contract";
import { retrieveKnowledge, KNOWLEDGE_PACK_VERSION, type KnowledgeSection } from "./brain/retrieve";
import { verifiedYieldsText, type VerifiedYield } from "./verified";
import { SAMPLE } from "./sample";

/**
 * Kitchen Brain in conversation. The same Master Prompt and Knowledge Pack as
 * the scaler, under the conversation contract: it may ask, it proposes recipe
 * cards for approval, and it hands finished cards to the scaler rather than
 * producing sheets itself.
 */

export const CHAT_ENGINE_VERSION = `Kitchen Brain v${MASTER_PROMPT_VERSION}`;

/** How many recent turns the model sees. The page keeps the whole conversation. */
export const CHAT_HISTORY_MAX = 30;

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatInput = { messages: ChatTurn[]; kitchenNotes: string[]; yields: VerifiedYield[] };

/** The always-on core of the Knowledge Pack (what retrieval returns for an empty job). */
const CORE: KnowledgeSection[] = retrieveKnowledge({}).sections;
const CORE_IDS = new Set(CORE.map((s) => s.id));

const sectionText = (s: KnowledgeSection) => `## ${s.title}\n${s.body}`;

/** Identical on every call (Master Prompt, contract, core knowledge), so it is served from the prompt cache after the first turn. */
export const CHAT_SYSTEM = [
  MASTER_PROMPT,
  CHAT_CONTRACT,
  `KNOWLEDGE PACK v${KNOWLEDGE_PACK_VERSION}, core sections (always in force):\n\n${CORE.map(sectionText).join("\n\n")}`,
].join("\n\n");

/**
 * The system blocks for one turn: the cached block, then this kitchen's facts
 * and the pack sections that match the recent conversation.
 */
export function chatSystemBlocks(input: ChatInput): { blocks: Anthropic.TextBlockParam[]; knowledge: string[] } {
  const recent = input.messages.slice(-4).map((m) => m.content).join("\n");
  const retrieved = retrieveKnowledge({ recipeText: recent, kitchenNotes: input.kitchenNotes });
  const extra = retrieved.sections.filter((s) => !CORE_IDS.has(s.id));

  const lines: string[] = [];
  if (input.kitchenNotes.length > 0) {
    lines.push("KITCHEN MEMORY, this kitchen's verified corrections. They outrank the Knowledge Pack:");
    for (const n of input.kitchenNotes) lines.push(`- ${n}`);
    lines.push("");
  }
  const verified = verifiedYieldsText(input.yields);
  if (verified) lines.push(verified, "");
  if (extra.length > 0) {
    lines.push(`KNOWLEDGE PACK v${KNOWLEDGE_PACK_VERSION}, sections retrieved for this conversation (generic numbers stay working assumptions):`, "");
    lines.push(extra.map(sectionText).join("\n\n"));
  }

  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: CHAT_SYSTEM, cache_control: { type: "ephemeral" } } as Anthropic.TextBlockParam,
  ];
  const context = lines.join("\n").trim();
  if (context) blocks.push({ type: "text", text: context });
  return { blocks, knowledge: [...CORE, ...extra].map((s) => s.title) };
}

/** What Kitchen Brain says when no AI key is configured: honest, and it carries a card so the handoff can be tried. */
export function demoReplyText(): string {
  const [name, ...rest] = SAMPLE.recipeText.trim().split("\n");
  return [
    "Demo reply. The AI key is not set on this server, so Kitchen Brain cannot think yet. Once it is, it answers under the Master Prompt v3.0 and the Knowledge Pack: it asks when a detail changes yield or safety, proposes a recipe card for you to approve, and hands the card to the scaler.",
    "",
    "Here is a card so you can try the handoff now:",
    "",
    "RECIPE CARD",
    `Name: ${name}`,
    `Base portions: ${SAMPLE.basePortions}`,
    `Portion size: ${SAMPLE.portionSize}`,
    ...(SAMPLE.equipment ? [`Equipment: ${SAMPLE.equipment}`] : []),
    ...(SAMPLE.holdingTime ? [`Hold time: ${SAMPLE.holdingTime}`] : []),
    ...rest,
    "END CARD",
    "",
    "Tap Open in scaler under the card, set today's covers, and scale it.",
  ].join("\n");
}

/** Split text into pieces for a streamed demo reply. */
export function chunk(text: string, size = 24): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
