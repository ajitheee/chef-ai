"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { demoScale } from "@/lib/engine/demo";
import { validateSheet, checksHeadline } from "@/lib/engine/validate";
import { coversIn, LookSwitch, Icon } from "./shared";

/**
 * Look B, "Brain": the AI first. One conversation; you say what you are
 * cooking and the sheet arrives inside the answer, built in front of you,
 * section by section. Suggestions keep the next step one tap away.
 */

const C = {
  bg: "#f5f6f8",
  card: "#ffffff",
  line: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  user: "#111827",
  accent: "#0f766e",
  accentSoft: "#e6f4f1",
  amber: "#b45309",
  amberSoft: "#fef3c7",
};

type Turn = { id: number; role: "user"; text: string } | { id: number; role: "assistant"; text?: string; covers?: number };

const SUGGESTIONS = ["Mexican rice for 800", "Mexican rice for 600", "What is the hold time?"];

export default function LookBrain() {
  // Opens mid-conversation, so the first thing the chef sees is the sheet arriving.
  const [thread, setThread] = useState<Turn[]>([
    { id: 1, role: "assistant", text: "What are you cooking, and for how many?" },
    { id: 2, role: "user", text: "Mexican rice for 800" },
    { id: 3, role: "assistant", covers: 800 },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const seq = useRef(3);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [thread]);

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    const covers = coversIn(t);
    const user: Turn = { id: ++seq.current, role: "user", text: t };
    const reply: Turn =
      covers && /rice/i.test(t) || (covers && !/[a-z]/i.test(t.replace(/covers|for|portions/gi, "")))
        ? { id: ++seq.current, role: "assistant", covers }
        : covers
          ? { id: ++seq.current, role: "assistant", covers, text: "In this preview every dish is Mexican Rice; the count is yours." }
          : { id: ++seq.current, role: "assistant", text: "In the real app Kitchen Brain answers this under the Master Prompt. In this preview, give me a dish and a count, like Mexican rice for 600." };
    setThread((th) => [...th, user, reply]);
    setInput("");
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <header className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3" style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
        <span className="font-semibold tracking-tight">Digital Chef AI</span>
        <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: C.accentSoft, color: C.accent }}>
          Kitchen Brain
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-40 pt-6">
        <ol className="space-y-4">
          {thread.map((turn) =>
            turn.role === "user" ? (
              <li key={turn.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] text-white" style={{ background: C.user }}>
                  {turn.text}
                </div>
              </li>
            ) : (
              <li key={turn.id} className="flex items-start gap-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: C.accent }}>
                  C
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  {turn.text && (
                    <div className="inline-block max-w-[90%] rounded-2xl rounded-tl-md px-4 py-2.5 text-[15px]" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                      {turn.text}
                    </div>
                  )}
                  {turn.covers && <SheetCard covers={turn.covers} />}
                </div>
              </li>
            )
          )}
        </ol>
        <div ref={endRef} />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 px-4 pb-16 pt-3" style={{ background: `linear-gradient(to top, ${C.bg} 70%, transparent)` }}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm"
            style={{ background: C.card, border: `1px solid ${C.line}` }}
          >
            <input className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] outline-none" placeholder="Message Kitchen Brain" value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: C.accent }} aria-label="Send">
              <Icon.send />
            </button>
          </form>
        </div>
      </div>
      <LookSwitch current="brain" />
    </div>
  );
}

function SheetCard({ covers }: { covers: number }) {
  const sheet = useMemo(() => demoScale(covers), [covers]);
  const checks = useMemo(() => validateSheet(sheet), [sheet]);
  const head = checksHeadline(checks);
  const [phase, setPhase] = useState<"scaling" | "checking" | "done">("scaling");
  const [open, setOpen] = useState<Record<string, boolean>>({ recipe: true });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // The sheet arrives in front of the chef: a short, honest progress line, then the sections. Once.
  useEffect(() => {
    const a = window.setTimeout(() => setPhase("checking"), 700);
    const b = window.setTimeout(() => setPhase("done"), 1300);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);

  const sections: { id: string; title: string; count: number; body: React.ReactNode }[] = [
    {
      id: "recipe",
      title: "Scaled recipe",
      count: sheet.ingredients.length,
      body: (
        <table className="w-full text-sm">
          <tbody>
            {sheet.ingredients.map((i, n) => (
              <tr key={n} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-2 pr-3 font-medium">{i.item}</td>
                <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap">{i.scaledQty}</td>
                <td className="py-2 text-right text-xs whitespace-nowrap" style={{ color: C.muted }}>
                  {i.multiplier}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    { id: "batching", title: "Batching", count: sheet.batching.length, body: <Lines lines={sheet.batching} /> },
    { id: "holding", title: "Hot-line holding", count: sheet.holding.length, body: <Lines lines={sheet.holding} /> },
    {
      id: "pull",
      title: "Pull list",
      count: sheet.pullList.length,
      body: (
        <table className="w-full text-sm">
          <tbody>
            {sheet.pullList.map((p, n) => (
              <tr key={n} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-2 pr-3 font-medium">{p.item}</td>
                <td className="py-2 text-right font-semibold whitespace-nowrap">{p.apQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      id: "checks",
      title: "Accuracy checks",
      count: checks.length,
      body: (
        <ul className="space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.status === "warn" ? C.amber : C.accent }} />
              <span>
                <span className="font-semibold">{c.label}:</span> {c.detail}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl rounded-tl-md" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4">
        <div className="text-lg font-semibold tracking-tight">
          {sheet.dish} <span style={{ color: C.muted }}>·</span> {covers} covers
        </div>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: C.amberSoft, color: C.amber }}>
          {sheet.status || "Draft"}
        </span>
      </div>

      <div className="px-4 pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: C.line }}>
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: phase === "scaling" ? "35%" : phase === "checking" ? "80%" : "100%", background: C.accent }}
          />
        </div>
        <div className="mt-1.5 text-xs" style={{ color: C.muted }}>
          {phase === "scaling" ? `Scaling ${sheet.ingredients.length} ingredients by role` : phase === "checking" ? "Running the accuracy checks" : `Done. ${sheet.targetYield.finishedYield} finished, ${head.status === "warn" ? `${head.warned} to review` : "all checks passed"}.`}
        </div>
      </div>

      {phase === "done" && (
        <div className="mt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {sections.map((s) => (
            <div key={s.id} style={{ borderBottom: `1px solid ${C.line}` }}>
              <button onClick={() => toggle(s.id)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
                <Icon.chevron open={!!open[s.id]} className="h-4 w-4 text-gray-400" />
                <span className="font-semibold">{s.title}</span>
                <span className="ml-auto text-xs" style={{ color: C.muted }}>
                  {s.count}
                </span>
              </button>
              {open[s.id] && <div className="px-4 pb-4">{s.body}</div>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.text }}>
              <Icon.print className="h-4 w-4" /> Print the sheet
            </button>
            <span className="self-center text-xs" style={{ color: C.muted }}>
              Draft until you test it.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <ol className="space-y-2 text-sm">
      {lines.map((l, n) => (
        <li key={n} className="flex gap-3">
          <span className="w-5 shrink-0 text-right font-semibold" style={{ color: C.muted }}>
            {n + 1}
          </span>
          <span>{l}</span>
        </li>
      ))}
    </ol>
  );
}
