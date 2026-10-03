"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { H1, H2, FIELD, CHIP, CHIP_ON, PRIMARY, TD, NOTE_WARN, NOTE_DANGER } from "@/components/paper";
import { getStore, type KitchenNote, type VerifiedYieldItem } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { plainText } from "@/lib/engine/plain";
import { validateSheet, checksHeadline } from "@/lib/engine/validate";
import { splitBlocks, hidePartialChoices, type RecipeCard, type Choices } from "@/lib/recipe-card";
import { setHandoff } from "@/lib/handoff";
import type { ChatEvent, ChatPart, ToolPayload, StoredChatMessage, ConversationSummary } from "@/lib/chat-events";
import type { EngineUsage } from "@/lib/engine/claude";
import type { ProductionSheet } from "@/lib/engine/schema";

type Msg = StoredChatMessage;

type UsageInfo = {
  usd: number;
  tokens: number;
  budgetUsd: number;
  resetsOn: string;
  scope: "month" | "session";
  needsMigration?: boolean;
};

const EXAMPLES = [
  "Build a card for chicken tinga: 50 portions, 4 oz cooked, tilt skillet and hotel pans. I need 120 covers.",
  "What is in my library with chicken? Then scale the Chicken Piccata for 200 covers.",
  "My Mexican rice came out gummy at 800 covers. What went wrong, and what do I change on the card?",
];

// Two messages are created in the same millisecond on every send; a counter keeps their keys distinct.
let seq = 0;
const uid = () => `${Date.now()}-${++seq}`;
const fmt = (n: number) => n.toLocaleString();
const tokensOf = (u?: EngineUsage) => (u ? u.input + u.cacheRead + u.cacheWrite + u.output : 0);
const titleFrom = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 60);
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** One event applied to an answer. Pure, so the same function drives the screen and what gets saved. */
function applyEvent(m: Msg, ev: ChatEvent): Msg {
  if (ev.type === "text") {
    const parts = [...m.parts];
    const last = parts[parts.length - 1];
    if (last && last.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + ev.text };
    else parts.push({ kind: "text", text: ev.text });
    return { ...m, text: m.text + ev.text, parts };
  }
  if (ev.type === "tool") return { ...m, parts: [...m.parts, { kind: "tool", id: ev.id, name: ev.name, label: ev.label, done: false }] };
  if (ev.type === "tool_done") {
    return { ...m, parts: m.parts.map((p) => (p.kind === "tool" && p.id === ev.id ? { ...p, done: true, ok: ev.ok, label: ev.label, payload: ev.payload } : p)) };
  }
  if (ev.type === "done") {
    return { ...m, meta: { ...m.meta, usage: ev.usage, engine: ev.engine, model: ev.model, knowledge: ev.knowledge, demo: ev.demo, note: ev.note } };
  }
  return { ...m, meta: { ...m.meta, error: ev.message } };
}

/** A tool call that never finished (stopped, or the page was left) is saved as interrupted, not as running. */
const settle = (parts: ChatPart[]): ChatPart[] =>
  parts.map((p) => (p.kind === "tool" && !p.done ? { ...p, done: true, ok: false, label: `${p.label} (interrupted)` } : p));

const setUrl = (id: string | null) => {
  try {
    window.history.replaceState(null, "", id ? `/app/brain?c=${encodeURIComponent(id)}` : "/app/brain");
  } catch {
    // never mind the address bar
  }
};

export default function BrainPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [storeNote, setStoreNote] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<KitchenNote[]>([]);
  const [yields, setYields] = useState<VerifiedYieldItem[]>([]);
  const [saveNotes, setSaveNotes] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  async function refreshUsage() {
    try {
      const res = await fetch("/api/usage");
      const d = (await res.json()) as UsageInfo & { ok: boolean };
      if (d.ok) setUsage(d);
    } catch {
      // the meter is informational
    }
  }

  async function openConversation(id: string) {
    if (busy) stop();
    try {
      const ms = await getStore().conversations.messages(id);
      setMessages(ms);
      setCurrentId(id);
      setSaveNotes({});
      setUrl(id);
    } catch (e) {
      setStoreNote(e instanceof Error ? e.message : "That conversation could not be opened.");
    }
  }

  useEffect(() => {
    const s = getStore();
    s.notes.list().then(setNotes).catch(() => {});
    s.yields.list().then(setYields).catch(() => {});
    s.conversations
      .list()
      .then((list) => {
        setConversations(list);
        if (s.needsConversationMigration) setStoreNote("Conversations are not saved yet: run supabase/migrations/0004_conversations_usage.sql in the Supabase SQL editor once, then reload.");
      })
      .catch(() => {});
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) openConversation(c);
    refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const patch = (id: string, fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  const bump = (id: string) =>
    setConversations((cs) => {
      const c = cs.find((x) => x.id === id);
      return c ? [{ ...c, updatedAt: new Date().toISOString() }, ...cs.filter((x) => x.id !== id)] : cs;
    });

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const s = getStore();
    const now = new Date().toISOString();
    const user: Msg = { id: uid(), role: "user", text: content, parts: [], createdAt: now };
    const history = [...messages, user];
    const assistantId = uid();
    let draft: Msg = { id: assistantId, role: "assistant", text: "", parts: [], createdAt: now };
    setMessages([...history, draft]);
    if (text === undefined) setInput(""); // a pressed button leaves a typed draft alone
    setBusy(true);

    // The conversation exists from the first message on.
    let convId = currentId;
    if (!convId) {
      try {
        const c = await s.conversations.create(titleFrom(content));
        convId = c.id;
        setCurrentId(c.id);
        setConversations((cs) => [c, ...cs]);
        setUrl(c.id);
      } catch (e) {
        setStoreNote(e instanceof Error ? e.message : "This conversation is not being saved.");
      }
    }
    if (convId) s.conversations.put(convId, user).catch(() => {});

    const ac = new AbortController();
    abortRef.current = ac;
    const apply = (ev: ChatEvent) => {
      draft = applyEvent(draft, ev);
      const snapshot = draft;
      patch(assistantId, () => snapshot);
      // A sheet scaled here belongs in Recent sheets, like one from the scaler.
      if (ev.type === "tool_done" && ev.payload?.kind === "sheet") {
        const { sheet, covers } = ev.payload;
        s.history.add(sheet.dish, covers, sheet).catch(() => {});
      }
    };

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
        apply({ type: "error", message });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const feed = (line: string) => {
        if (!line.trim()) return;
        try {
          apply(JSON.parse(line) as ChatEvent);
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
      if (ac.signal.aborted) {
        draft = { ...draft, meta: { ...draft.meta, stopped: true } };
        const snapshot = draft;
        patch(assistantId, () => snapshot);
      } else {
        apply({ type: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (convId && (draft.text || draft.parts.length)) {
        s.conversations.put(convId, { ...draft, parts: settle(draft.parts) }).catch(() => {});
        bump(convId);
      }
      refreshUsage();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newConversation() {
    if (busy) stop();
    setMessages([]);
    setCurrentId(null);
    setSaveNotes({});
    setInput("");
    setUrl(null);
    boxRef.current?.focus();
  }

  async function deleteConversation(c: ConversationSummary) {
    if (!window.confirm(`Delete "${c.title}"?\n\nThis cannot be undone.`)) return;
    try {
      const list = await getStore().conversations.remove(c.id);
      setConversations(list);
      if (c.id === currentId) newConversation();
    } catch (e) {
      setStoreNote(e instanceof Error ? e.message : "That conversation could not be deleted.");
    }
  }

  function openInScaler(card: RecipeCard, extra?: { covers: number; sheet: ProductionSheet }) {
    setHandoff({ ...card, recipeText: plainText(card.recipeText), ...(extra ?? {}) });
    router.push("/app");
  }

  /** The approval gate: the chef saves, the brain never does. Same rules as the scaler's Save. */
  async function saveCard(card: RecipeCard, key: string) {
    if (!card.basePortions || !card.portionSize) {
      setSaveNotes((n) => ({ ...n, [key]: "To save, the card needs base portions and a portion size. Ask Kitchen Brain to add them." }));
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
  const activeNotes = notes.filter((n) => n.active !== false).length;

  const usageLine = !usage
    ? "Loading"
    : usage.needsMigration
      ? "Usage is not recorded yet. Run migration 0004 to start the budget."
      : usage.scope === "month"
        ? `$${usage.usd.toFixed(2)} of $${usage.budgetUsd.toFixed(2)}, estimated at the configured rates. Resets ${usage.resetsOn}.`
        : `${fmt(usage.tokens)} tokens this session, about $${usage.usd.toFixed(2)}. No database, so usage is not kept.`;
  const usagePct = usage && usage.scope === "month" && usage.budgetUsd > 0 ? Math.min(100, Math.round((usage.usd / usage.budgetUsd) * 100)) : null;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="brain" signOut={isSupabaseConfigured()} />
      <main className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:px-8">
        <aside className="lg:sticky lg:top-16 lg:self-start">
          <button onClick={newConversation} className={`${PRIMARY} w-full py-2.5 text-sm`}>
            New conversation
          </button>

          <div className="mt-5 border-t border-ink pt-3">
            <h2 className={H2}>AI budget this month</h2>
            <p className="mt-1 text-xs text-ink-2">{usageLine}</p>
            {usagePct !== null && (
              <div className="mt-2 h-1 w-full bg-line" aria-hidden>
                <div className={`h-1 ${usagePct >= 90 ? "bg-warn" : "bg-ink"}`} style={{ width: `${usagePct}%` }} />
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-ink pt-3">
            <h2 className={H2}>Conversations</h2>
            {conversations.length === 0 ? (
              <p className="mt-1 text-xs text-ink-3">None yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {conversations.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                    <button
                      onClick={() => openConversation(c.id)}
                      className={`min-w-0 flex-1 truncate text-left text-sm ${c.id === currentId ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}
                      title={c.title}
                    >
                      {c.title}
                    </button>
                    <span className="whitespace-nowrap text-[11px] text-ink-3">{shortDate(c.updatedAt)}</span>
                    <button onClick={() => deleteConversation(c)} className="px-1 text-ink-3 hover:text-danger" aria-label={`Delete ${c.title}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {storeNote && <p className={`${NOTE_WARN} mt-5 text-xs`}>{storeNote}</p>}
        </aside>

        <section className="mt-8 min-w-0 lg:mt-0 lg:border-l lg:border-ink lg:pl-10">
          <h1 className={H1}>Kitchen Brain</h1>
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
              {messages.map((m, mi) => (
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
                          // While the latest answer streams, a half-written CHOICES block is held back until it is complete.
                          splitBlocks(busy && mi === messages.length - 1 ? hidePartialChoices(part.text) : part.text).map((seg, si) =>
                            seg.kind === "text" ? (
                              <p key={`${pi}-${si}`} className="whitespace-pre-wrap">
                                {plainText(seg.text)}
                              </p>
                            ) : seg.kind === "card" ? (
                              <CardBlock
                                key={`${pi}-${si}`}
                                raw={seg.raw}
                                card={seg.card}
                                note={saveNotes[`${m.id}-${pi}-${si}`]}
                                onOpen={() => openInScaler(seg.card)}
                                onSave={() => saveCard(seg.card, `${m.id}-${pi}-${si}`)}
                              />
                            ) : (
                              <ChoicesBlock
                                key={`${pi}-${si}`}
                                choices={seg.choices}
                                live={!busy && mi === messages.length - 1}
                                chosen={messages[mi + 1]?.role === "user" ? messages[mi + 1].text : undefined}
                                onPick={send}
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
                {activeNotes} kitchen notes and {yields.length} verified yields go with every message.
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
              Conversations are saved as you go. When Kitchen Brain asks you something, the answers are buttons; you can always type instead. A card is a Draft until you test it; Save to library keeps it, Open in scaler prints it. A sheet scaled here also appears under Recent sheets in the scaler.
            </p>
          </section>
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

/** A spent button: the chef has already replied. The one they pressed stays filled. */
const SPENT = "rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-3";

/**
 * A question or an approval gate from the brain, as buttons. Live on the latest
 * answer, where pressing one sends it as the reply; spent once the chef has
 * replied, with the pressed one filled.
 */
function ChoicesBlock({ choices, live, chosen, onPick }: { choices: Choices; live: boolean; chosen?: string; onPick: (option: string) => void }) {
  const options = choices.options.map((o) => plainText(o));
  const picked = chosen ? options.find((o) => o.trim().toLowerCase() === chosen.trim().toLowerCase()) : undefined;
  return (
    <div className="my-3">
      {choices.question && <p className="font-semibold">{plainText(choices.question)}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {options.map((o) =>
          live ? (
            <button key={o} onClick={() => onPick(o)} className={CHIP}>
              {o}
            </button>
          ) : (
            <span key={o} className={o === picked ? CHIP_ON : SPENT}>
              {o}
            </span>
          )
        )}
        {live && <span className="text-xs text-ink-3">or type your answer below</span>}
      </div>
    </div>
  );
}

type OpenSheet = (card: RecipeCard, extra: { covers: number; sheet: ProductionSheet }) => void;

function ToolLine({ part, onOpen }: { part: Extract<ChatPart, { kind: "tool" }>; onOpen: OpenSheet }) {
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
