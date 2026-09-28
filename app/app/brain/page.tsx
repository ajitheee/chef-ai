"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { H1, H2, FIELD, CHIP, PRIMARY, NOTE_WARN, NOTE_DANGER } from "@/components/paper";
import { getStore, type KitchenNote, type VerifiedYieldItem } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { plainText } from "@/lib/engine/plain";
import { splitCards, type RecipeCard } from "@/lib/recipe-card";
import { setHandoff } from "@/lib/handoff";
import type { EngineUsage } from "@/lib/engine/claude";

type Meta = {
  engine?: string;
  model?: string;
  usage?: EngineUsage;
  knowledge?: string[];
  demo?: boolean;
  note?: string;
  error?: string;
  stopped?: boolean;
};
type Msg = { id: string; role: "user" | "assistant"; text: string; meta?: Meta };

type Event =
  | { type: "text"; text: string }
  | { type: "done"; usage?: EngineUsage; engine: string; model?: string; knowledge: string[]; demo: boolean; note?: string }
  | { type: "error"; message: string };

const EXAMPLES = [
  "Build a card for chicken tinga: 50 portions, 4 oz cooked, tilt skillet and hotel pans.",
  "My Mexican rice came out gummy at 800 covers. What went wrong, and what do I change on the card?",
  "Make this card lower in sodium without losing the dish. Here is the card:",
];

// Two messages are created in the same millisecond on every send; a counter keeps their keys distinct.
let seq = 0;
const uid = () => `${Date.now()}-${++seq}`;
const fmt = (n: number) => n.toLocaleString();
const tokensOf = (u?: EngineUsage) => (u ? u.input + u.cacheRead + u.cacheWrite + u.output : 0);

export default function BrainPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<KitchenNote[]>([]);
  const [yields, setYields] = useState<VerifiedYieldItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const s = getStore();
    s.notes.list().then(setNotes).catch(() => {});
    s.yields.list().then(setYields).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const patch = (id: string, fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const user: Msg = { id: uid(), role: "user", text: content };
    const history = [...messages, user];
    const assistantId = uid();
    setMessages([...history, { id: assistantId, role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;

    const handle = (ev: Event) => {
      if (ev.type === "text") patch(assistantId, (m) => ({ ...m, text: m.text + ev.text }));
      else if (ev.type === "done")
        patch(assistantId, (m) => ({ ...m, meta: { ...m.meta, usage: ev.usage, engine: ev.engine, model: ev.model, knowledge: ev.knowledge, demo: ev.demo, note: ev.note } }));
      else if (ev.type === "error") patch(assistantId, (m) => ({ ...m, meta: { ...m.meta, error: ev.message } }));
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.text })),
          kitchenNotes: notes.filter((n) => n.active !== false).map((n) => n.text),
          yields: yields.map(({ product, kind, pct, source, verifiedOn }) => ({ product, kind, pct, source, verifiedOn })),
        }),
      });
      if (!res.ok || !res.body) {
        let message = res.status === 401 ? "Your session has ended. Sign in again." : `The server returned an unexpected response (${res.status}). Try again.`;
        try {
          const d = (await res.json()) as { error?: string };
          if (d?.error) message = d.error;
        } catch {
          // not JSON; keep the sentence above
        }
        patch(assistantId, (m) => ({ ...m, meta: { ...m.meta, error: message } }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const feed = (line: string) => {
        if (!line.trim()) return;
        try {
          handle(JSON.parse(line) as Event);
        } catch {
          // a torn line; ignore it
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          feed(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
      }
      feed(buf);
    } catch (e) {
      if (ac.signal.aborted) patch(assistantId, (m) => ({ ...m, meta: { ...m.meta, stopped: true } }));
      else patch(assistantId, (m) => ({ ...m, meta: { ...m.meta, error: e instanceof Error ? e.message : "Something went wrong." } }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    if (busy) stop();
    setMessages([]);
    setInput("");
    boxRef.current?.focus();
  }

  function openInScaler(card: RecipeCard) {
    setHandoff({ ...card, recipeText: plainText(card.recipeText) });
    router.push("/app");
  }

  const total = messages.reduce((n, m) => n + tokensOf(m.meta?.usage), 0);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="brain" signOut={isSupabaseConfigured()} />
      <main className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className={H1}>Kitchen Brain</h1>
          {messages.length > 0 && (
            <button onClick={clear} className={CHIP}>
              New conversation
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-2">
          Build, repair or question a recipe with the brain that scales it. It asks when a detail matters, proposes a card for you to approve, and hands the card to the scaler.
        </p>

        {messages.length === 0 ? (
          <section className="mt-6 border-t border-ink pt-3">
            <h2 className={H2}>Try one</h2>
            <ul className="mt-2 space-y-2">
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button
                    onClick={() => {
                      setInput(ex);
                      boxRef.current?.focus();
                    }}
                    className="text-left text-sm text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <ol className="mt-6 space-y-6">
            {messages.map((m) => (
              <li key={m.id} className="border-t border-ink pt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className={H2}>{m.role === "user" ? "You" : "Kitchen Brain"}</span>
                  {m.role === "assistant" && m.meta?.usage && (
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider text-ink-3"
                      title={[
                        m.meta.model ? `Model: ${m.meta.model}` : "",
                        `In ${fmt(m.meta.usage.input + m.meta.usage.cacheRead + m.meta.usage.cacheWrite)} (${fmt(m.meta.usage.cacheRead)} from cache), out ${fmt(m.meta.usage.output)}`,
                        m.meta.knowledge?.length ? `Knowledge Pack sections: ${m.meta.knowledge.join(" · ")}` : "",
                      ]
                        .filter(Boolean)
                        .join("; ")}
                    >
                      {m.meta.engine} · {fmt(tokensOf(m.meta.usage))} tokens
                    </span>
                  )}
                </div>

                {m.role === "user" ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{m.text}</p>
                ) : (
                  <div className="mt-2 text-sm">
                    {splitCards(m.text).map((seg, i) =>
                      seg.kind === "text" ? (
                        <p key={i} className="whitespace-pre-wrap">
                          {plainText(seg.text)}
                        </p>
                      ) : (
                        <div key={i} className="my-3">
                          <pre className="font-mono-ui whitespace-pre-wrap border-b border-ink bg-card px-3 py-3 text-sm text-ink">{plainText(seg.raw)}</pre>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button onClick={() => openInScaler(seg.card)} className={`${PRIMARY} px-4 py-2 text-sm`}>
                              Open in scaler
                            </button>
                            <span className="text-xs text-ink-3">
                              {seg.card.name}
                              {seg.card.basePortions ? ` · base ${seg.card.basePortions}` : ""}
                              {seg.card.portionSize ? ` · ${seg.card.portionSize}` : ""}
                              {" · Draft until you approve it"}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                    {busy && !m.text && !m.meta?.error && messages[messages.length - 1]?.id === m.id && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Kitchen Brain is writing</p>
                    )}
                    {m.meta?.stopped && <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Stopped</p>}
                    {m.meta?.note && <p className={`${NOTE_WARN} mt-2`}>{m.meta.note}</p>}
                    {m.meta?.error && <p className={`${NOTE_DANGER} mt-2`}>{m.meta.error}</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />

        <section className="mt-8 border-t border-ink pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={H2}>Your message</h2>
            <span className="text-[11px] text-ink-3">
              {total > 0 ? `This conversation: ${fmt(total)} tokens. ` : ""}
              {notes.filter((n) => n.active !== false).length} kitchen notes and {yields.length} verified yields go with every message.
            </span>
          </div>
          <textarea
            ref={boxRef}
            className={`${FIELD} mt-2 h-28 text-sm`}
            placeholder="Describe the dish, paste a card, or ask a kitchen question."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {busy ? (
              <button onClick={stop} className={CHIP}>
                Stop
              </button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} className={`${PRIMARY} px-5 py-2.5 text-sm`}>
                Send
              </button>
            )}
            <span className="text-xs text-ink-3">Enter sends; Shift+Enter starts a new line.</span>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Conversations are kept on this screen only. Hand a card to the scaler and save it to keep it. A card from Kitchen Brain is a Draft until you test it.
          </p>
        </section>
      </main>
    </div>
  );
}
