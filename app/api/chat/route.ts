import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, ENGINE_TIMEOUT_MS, engineFailure, friendlyEngineError, usageOf, type EngineUsage } from "@/lib/engine/claude";
import { VerifiedYieldSchema } from "@/lib/engine/schema";
import { isDemoMode } from "@/lib/engine/demo";
import { CHAT_ENGINE_VERSION, CHAT_HISTORY_MAX, chatSystemBlocks, chunk, demoReplyText } from "@/lib/engine/chat";
import { CHAT_TOOLS, runTool, toolLabel } from "@/lib/engine/chat-tools";
import { getRecipeRepository } from "@/lib/data/recipes";
import type { ChatEvent } from "@/lib/chat-events";
import { usageDb, budgetGate, recordUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Tool rounds per turn. Each scale is 30 to 60 s, and the function has 300. */
const MAX_TOOL_ROUNDS = 4;

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Type a message first.").max(24_000, "That message is too long. Keep it under about 6,000 words."),
});

const ChatRequestSchema = z
  .object({
    messages: z.array(TurnSchema).min(1, "Type a message first.").max(400, "This conversation is too long. Start a new one."),
    kitchenNotes: z.array(z.string()).optional().default([]),
    yields: z.array(VerifiedYieldSchema).optional().default([]),
  })
  .refine((v) => v.messages[v.messages.length - 1].role === "user", { message: "The last message must be yours.", path: ["messages"] });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Newline-delimited JSON, one event per line, streamed as the answer is produced. */
function ndjson(run: (emit: (ev: ChatEvent) => void, signal: AbortSignal) => Promise<void>): Response {
  const enc = new TextEncoder();
  const ac = new AbortController();
  let state: "open" | "cancelled" | "closed" = "open";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: ChatEvent) => {
        if (state === "open") controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      };
      try {
        await run(emit, ac.signal);
      } catch (e) {
        emit({ type: "error", message: friendlyEngineError(e, "Kitchen Brain could not answer just now. Try again.") });
      }
      if (state === "open") {
        state = "closed";
        controller.close();
      }
    },
    cancel() {
      // The reader went away (Stop, or the page closed): stop paying for tokens.
      state = "cancelled";
      ac.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: NextRequest) {
  let input: z.infer<typeof ChatRequestSchema>;
  try {
    input = ChatRequestSchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "That request could not be read.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // The model sees the recent turns, starting on one of the chef's (the API requires it).
  let turns = input.messages.slice(-CHAT_HISTORY_MAX);
  while (turns.length > 0 && turns[0].role !== "user") turns = turns.slice(1);

  if (isDemoMode()) {
    return ndjson(async (emit) => {
      for (const piece of chunk(demoReplyText())) {
        emit({ type: "text", text: piece });
        await sleep(8);
      }
      emit({ type: "done", engine: CHAT_ENGINE_VERSION, knowledge: [], demo: true, note: "Demo reply: the AI key is not set on this server, so Kitchen Brain cannot think yet." });
    });
  }

  // The month's spend against the budget, then the library, both resolved inside the request before the stream starts.
  const db = await usageDb();
  const blocked = await budgetGate(db);
  if (blocked) return NextResponse.json({ ok: false, error: blocked }, { status: 429 });

  const { blocks, knowledge } = chatSystemBlocks({ messages: turns, kitchenNotes: input.kitchenNotes, yields: input.yields });
  // The chef's library, for the tools. Resolved here, inside the request, before the stream starts.
  const repo = await getRecipeRepository();
  const ctx = { repo, kitchenNotes: input.kitchenNotes, yields: input.yields };

  return ndjson(async (emit, signal) => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
    const convo: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }));
    const total: EngineUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        // Sonnet 5 thinks by default on a plain message, and the thinking counts
        // against max_tokens: under the Master Prompt it used the whole budget and
        // wrote nothing. The scaler never sees this because forced tool choice
        // disables thinking. Conversation is text: thinking off, answer directly.
        // (The SDK's types predate the parameter; the API accepts it.)
        const params = { model: MODEL, max_tokens: 2000, system: blocks, messages: convo, tools: CHAT_TOOLS, thinking: { type: "disabled" as const } };
        const stream = client.messages.stream(params as unknown as Parameters<typeof client.messages.stream>[0], { timeout: ENGINE_TIMEOUT_MS, signal });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") emit({ type: "text", text: event.delta.text });
        }
        const final = await stream.finalMessage();
        const u = usageOf(final);
        total.input += u.input;
        total.output += u.output;
        total.cacheRead += u.cacheRead;
        total.cacheWrite += u.cacheWrite;

        const uses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (final.stop_reason !== "tool_use" || uses.length === 0) {
          emit({ type: "done", usage: total, engine: CHAT_ENGINE_VERSION, model: MODEL, knowledge, demo: false });
          return;
        }

        // Run what it asked for, show the chef, and hand the results back.
        convo.push({ role: "assistant", content: final.content as Anthropic.MessageParam["content"] });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const use of uses) {
          emit({ type: "tool", id: use.id, name: use.name, label: toolLabel(use.name, use.input) });
          const out = await runTool(use.name, use.input, ctx);
          emit({ type: "tool_done", id: use.id, name: use.name, label: out.label, ok: out.ok, payload: out.payload });
          results.push({ type: "tool_result", tool_use_id: use.id, content: out.forModel, is_error: !out.ok });
        }
        convo.push({ role: "user", content: results });
      }
      emit({
        type: "done",
        usage: total,
        engine: CHAT_ENGINE_VERSION,
        model: MODEL,
        knowledge,
        demo: false,
        note: "Kitchen Brain stopped after several tool calls in one turn. Ask again to continue.",
      });
    } catch (e) {
      if (signal.aborted) return;
      const reason = engineFailure(e);
      console.error("[chat] engine failed:", reason ?? "", e instanceof Error ? e.message : e);
      emit({ type: "error", message: reason ?? friendlyEngineError(e, "Kitchen Brain could not answer just now. Try again.") });
    } finally {
      // Every token spent counts, even when the chef stopped early or a round failed.
      if (total.input + total.output + total.cacheRead + total.cacheWrite > 0) await recordUsage(db, "chat", total);
    }
  });
}
