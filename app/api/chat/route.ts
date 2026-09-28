import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, ENGINE_TIMEOUT_MS, engineFailure, friendlyEngineError, usageOf, type EngineUsage } from "@/lib/engine/claude";
import { VerifiedYieldSchema } from "@/lib/engine/schema";
import { isDemoMode } from "@/lib/engine/demo";
import { CHAT_ENGINE_VERSION, CHAT_HISTORY_MAX, chatSystemBlocks, chunk, demoReplyText } from "@/lib/engine/chat";

export const runtime = "nodejs";
export const maxDuration = 300;

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

/** One event per line (newline-delimited JSON), streamed as the answer is produced. */
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "done"; usage?: EngineUsage; engine: string; model?: string; knowledge: string[]; demo: boolean; note?: string }
  | { type: "error"; message: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const { blocks, knowledge } = chatSystemBlocks({ messages: turns, kitchenNotes: input.kitchenNotes, yields: input.yields });

  return ndjson(async (emit, signal) => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
    try {
      // Sonnet 5 thinks by default on a plain message, and the thinking counts
      // against max_tokens: under the Master Prompt it used the whole budget and
      // wrote nothing. The scaler never sees this because forced tool choice
      // disables thinking. Conversation is text: thinking off, answer directly.
      // (The SDK's types predate the parameter; the API accepts it.)
      const params = { model: MODEL, max_tokens: 2000, system: blocks, messages: turns, thinking: { type: "disabled" as const } };
      const stream = client.messages.stream(
        params as unknown as Parameters<typeof client.messages.stream>[0],
        { timeout: ENGINE_TIMEOUT_MS, signal }
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") emit({ type: "text", text: event.delta.text });
      }
      const final = await stream.finalMessage();
      emit({ type: "done", usage: usageOf(final), engine: CHAT_ENGINE_VERSION, model: MODEL, knowledge, demo: false });
    } catch (e) {
      if (signal.aborted) return;
      const reason = engineFailure(e);
      console.error("[chat] engine failed:", reason ?? "", e instanceof Error ? e.message : e);
      emit({ type: "error", message: reason ?? friendlyEngineError(e, "Kitchen Brain could not answer just now. Try again.") });
    }
  });
}
