"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { H1, H2, FIELD, CHIP, PRIMARY, TD, NOTE_WARN, NOTE_DANGER } from "@/components/paper";
import { getStore, type KitchenNote, type VerifiedYieldItem } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { plainText } from "@/lib/engine/plain";
import { validateSheet, checksHeadline } from "@/lib/engine/validate";
import { splitCards, type RecipeCard } from "@/lib/recipe-card";
import { setHandoff } from "@/lib/handoff";
import type { ChatEvent, ToolPayload } from "@/lib/chat-events";
import type { EngineUsage } from "@/lib/engine/claude";
import type { ProductionSheet } from "@/lib/engine/schema";

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

/** An answer in the order it arrived: text, a tool call, more text. */
type Part =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; label: string; done: boolean; ok?: boolean; payload?: ToolPayload };

type Msg = { id: string; role: "user" | "assistant"; text: string; parts: Part[]; meta?: Meta };

const EXAMPLES = [
  "Build a card for chicken tinga: 50 portions, 4 oz cooked, tilt skillet and hotel pans.",
  "What is in my library with chicken? Then scale the Chicken Piccata for 200 covers.",
  "My Mexican rice came out gummy at 800 covers. What went wrong, and what do I change on the card?",
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
  const [saveNotes, setSaveNotes] = useState<Record<string, string>>({});
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

  function handleEvent(assistantId: string, ev: ChatEvent) {
    if (ev.type === "text") {
      patch(assistantId, (m) => {
        const parts = [...m.parts];
        const last = parts[parts.length - 1];
        if (last && last.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + ev.text };
        else parts.push({ kind: "text", text: ev.text });
        return { ...m, text: m.text + ev.text, parts };
      });
    } else if (ev.type === "tool") {
      patch(assistantId, (m) => ({ ...m, parts: [...m.parts, { kind: "tool", id: ev.id, name: ev.name, label: ev.label, done: false }] }));
    } else if (ev.type === "tool_done") {
      patch(assistantId, (m) => ({
        ...m,
        parts: m.parts.map((p) => (p.kind === "tool" && p.id === ev.id ? { ...p, done: true, ok: ev.ok, label: ev.label, payload: ev.payload } : p)),
      }));
      // A sheet scaled here belongs in Recent sheets, like one from the scaler.
      if (ev.payload?.kind === "sheet") {
        const { sheet, covers } = ev.payload;
        getStore().history.add(sheet.dish, covers, sheet).catch(() => {});
      }
    } else if (ev.type === "done") {
      patch(assistantId, (m) => ({ ...m, meta: { ...m.meta, usage: ev.usage, engine: ev.engine, model: ev.model, knowledge: ev.knowledge, demo: ev.demo, note: ev.note } }));
    } else if (ev.type === "error") {
      patch(assistantId, (m) => ({ ...m, meta: { ...m.meta, error: ev.message } }));
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const user: Msg = { id: uid(), role: "user", text: content, parts: [] };
    const history = [...messages, user];
    const assistantId = uid();
    setMessages([...history, { id: assistantId, role: "assistant", text: "", parts: [] }]);
    setInput("");
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          // Only turns with words go to the model; a failed or stopped-empty answer is skipped.
          messages: history.filter((m) => m.text.trim()).map((m) => ({ role: m.role, content: m.text })),
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
          handleEvent(assistantId, JSON.parse(line) as ChatEvent);
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
    setSaveNotes({});
    boxRef.current?.focus();
  }

  function openInScaler(card: RecipeCard, extra?: { covers: number; sheet: ProductionSheet }) {
    setHandoff({ ...card, recipeText: plainText(card.recipeText), ...(extra ?? {}) });
    router.push("/app");
  }

  /** The approval gate: the chef saves, the brain never does. Same rules as the scaler's Save. */
  async function saveCard(card: RecipeCard, key: string) {
    if (!card.basePortions || !card.portionSize) {
      setSaveNotes((s) => ({ ...s, [key]: "To save, the card needs base portions and a portion size. Ask Kitchen Brain to add them." }));
      return;
    }
    try {
      const s = getStore();
      const text = plainText(card.recipeText);
      const existing = (await s.recipes.list()).find((r) => r.name.trim().toLowerCase() === card.name.trim().toLowerCase());
      if (
        existing &&
        (existing.recipeText !== text || existing.basePortions !== card.basePortions || existing.portionSize !== card.portionSize) &&
        !window.confirm(`"${existing.name}" is already in your library. Replace it with this version?\n\nThe saved card is kept as a previous version.`)
      ) {
        return;
      }
      await s.recipes.save({
        name: card.name,
        recipeText: text,
        basePortions: card.basePortions,
        portionSize: card.portionSize,
        equipment: card.equipment,
        holdingTime: card.holdingTime,
      });
      setSaveNotes((n) => ({ ...n, [key]: `Saved "${card.name}" to your library as a Draft.` }));
    } catch (e) {
      setSaveNotes((n) => ({ ...n, [key]: e instanceof Error ? e.message : "Couldn't save the card." }));
    }
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
          Build, repair or question a recipe with the brain that scales it. It can read your library, run the scaler for a cover count, and propose a card for you to approve.
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
                    {m.parts.map((part, pi) =>
                      part.kind === "tool" ? (
                        <ToolLine key={part.id} part={part} onOpen={openInScaler} />
                      ) : (
                        splitCards(part.text).map((seg, si) =>
                          seg.kind === "text" ? (
                            <p key={`${pi}-${si}`} className="whitespace-pre-wrap">
                              {plainText(seg.text)}
                            </p>
                          ) : (
                            <CardBlock
                              key={`${pi}-${si}`}
                              raw={seg.raw}
                              card={seg.card}
                              note={saveNotes[`${m.id}-${pi}-${si}`]}
                              onOpen={() => openInScaler(seg.card)}
                              onSave={() => saveCard(seg.card, `${m.id}-${pi}-${si}`)}
                            />
                          )
                        )
                      )
                    )}
                    {busy && !m.text && !m.parts.length && !m.meta?.error && messages[messages.length - 1]?.id === m.id && (
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
            placeholder="Describe the dish, paste a card, name a library recipe, or ask a kitchen question."
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
            Conversations are kept on this screen only. A card is a Draft until you test it; Save to library keeps it, Open in scaler prints it. A sheet scaled here also appears under Recent sheets in the scaler.
          </p>
        </section>
      </main>
    </div>
  );
}

function CardBlock({ raw, card, note, onOpen, onSave }: { raw: string; card: RecipeCard; note?: string; onOpen: () => void; onSave: () => void }) {
  return (
    <div className="my-3">
      <pre className="font-mono-ui whitespace-pre-wrap border-b border-ink bg-card px-3 py-3 text-sm text-ink">{plainText(raw)}</pre>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={onOpen} className={`${PRIMARY} px-4 py-2 text-sm`}>
          Open in scaler
        </button>
        <button onClick={onSave} className={CHIP}>
          Save to library
        </button>
        <span className="text-xs text-ink-3">
          {card.name}
          {card.basePortions ? ` · base ${card.basePortions}` : ""}
          {card.portionSize ? ` · ${card.portionSize}` : ""}
          {" · Draft until you approve it"}
        </span>
      </div>
      {note && <p className="mt-2 text-xs font-semibold text-ink-2">{note}</p>}
    </div>
  );
}

type OpenSheet = (card: RecipeCard, extra: { covers: number; sheet: ProductionSheet }) => void;

function ToolLine({ part, onOpen }: { part: Extract<Part, { kind: "tool" }>; onOpen: OpenSheet }) {
  const payload = part.payload;
  return (
    <div className="my-3">
      <p className={`text-[11px] font-bold uppercase tracking-wider ${part.done && part.ok === false ? "text-danger" : "text-ink-3"}`}>
        {part.label}
        {!part.done ? " (working)" : ""}
      </p>
      {part.done && payload?.kind === "sheet" && <SheetBlock payload={payload} onOpen={onOpen} />}
    </div>
  );
}

function SheetBlock({ payload, onOpen }: { payload: Extract<ToolPayload, { kind: "sheet" }>; onOpen: OpenSheet }) {
  const { sheet, covers, demo, note } = payload;
  const checks = validateSheet(sheet);
  const head = checksHeadline(checks);
  const warned = checks.filter((c) => c.status === "warn");
  return (
    <div className="mt-2 border-t border-ink pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-semibold">
          {sheet.dish} · {covers} covers
          <span className="ml-2 rounded-md border border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">{sheet.status || "Draft"}</span>
        </span>
        <span className={`text-xs font-bold ${head.status === "warn" ? "text-warn" : "text-ink"}`}>{head.status === "warn" ? `${head.warned} to review` : "All checks passed"}</span>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        {sheet.baseYield.portions} portions to {covers} covers at {sheet.targetYield.portionSize}; finished yield {sheet.targetYield.finishedYield}.
      </p>
      {warned.map((c) => (
        <p key={c.label} className="mt-1 text-xs text-warn">
          {c.label}: {c.detail}
        </p>
      ))}
      {demo && <p className={`${NOTE_WARN} mt-2 text-xs`}>{note || "Built-in estimate: the chef-logic engine was unavailable."}</p>}
      <table className="mt-2 w-full text-sm">
        <tbody>
          {sheet.ingredients.map((i, n) => (
            <tr key={n}>
              <td className={`${TD} font-semibold`}>{i.item}</td>
              <td className={`${TD} whitespace-nowrap pr-0 text-right`}>{i.scaledQty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sheet.pullList.length > 0 && (
        <>
          <h4 className={`${H2} mt-3`}>Pull list</h4>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {sheet.pullList.map((p, n) => (
                <tr key={n}>
                  <td className={`${TD} font-semibold`}>{p.item}</td>
                  <td className={`${TD} whitespace-nowrap pr-0 text-right`}>{p.apQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => onOpen(payload.card, { covers, sheet })} className={`${PRIMARY} px-4 py-2 text-sm`}>
          Open the full sheet in the scaler
        </button>
        <span className="text-xs text-ink-3">batching, holding, checks, HACCP, prep list, print</span>
      </div>
    </div>
  );
}
