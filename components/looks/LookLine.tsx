"use client";

import { useState } from "react";
import { useDemoSheet, clampCovers, PRESETS, multOf, LookSwitch, Icon } from "./shared";

/**
 * Look A, "Line": a kitchen display. Dark surface, big numbers, five stations
 * you tap through at arm's length, tiles you can mark done during service.
 */

const C = {
  bg: "#0f1113",
  surface: "#171a1e",
  surface2: "#1f2328",
  line: "#2b3036",
  text: "#f3f4f1",
  muted: "#9aa0a6",
  amber: "#e8a33d",
  green: "#3fb950",
  red: "#e5534b",
};

type Station = "prep" | "cook" | "hold" | "pull" | "checks";
const STATIONS: { id: Station; label: string }[] = [
  { id: "prep", label: "Prep" },
  { id: "cook", label: "Cook" },
  { id: "hold", label: "Hold" },
  { id: "pull", label: "Pull" },
  { id: "checks", label: "Checks" },
];

export default function LookLine() {
  const { covers, setCovers, sheet, checks, head } = useDemoSheet(800);
  const [station, setStation] = useState<Station>("prep");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const linear = covers / sheet.baseYield.portions;
  const toggle = (k: string) => setDone((d) => ({ ...d, [k]: !d[k] }));

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <header className="flex items-center gap-4 px-5 py-3" style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <span className="font-semibold tracking-tight">Digital Chef AI</span>
        <span className="text-sm" style={{ color: C.muted }}>
          Line
        </span>
        <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold" style={{ border: `1px solid ${C.line}` }}>
          <Icon.print className="h-4 w-4" /> Print
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
              Tonight
            </div>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{sheet.dish}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-md px-2.5 py-1 font-semibold uppercase tracking-wider" style={{ border: `1px solid ${C.amber}`, color: C.amber }}>
                {sheet.status || "Draft"}
              </span>
              <span className="rounded-md px-2.5 py-1" style={{ background: C.surface2 }}>
                {sheet.targetYield.portionSize} portions
              </span>
              <span className="rounded-md px-2.5 py-1" style={{ background: C.surface2 }}>
                {sheet.targetYield.finishedYield} finished
              </span>
            </div>
          </div>
          <Stepper covers={covers} onChange={(n) => setCovers(clampCovers(n))} />
        </div>

        <nav className="mt-7 grid grid-cols-5 overflow-hidden rounded-lg" style={{ border: `1px solid ${C.line}` }} aria-label="Stations">
          {STATIONS.map((s) => {
            const on = s.id === station;
            return (
              <button
                key={s.id}
                onClick={() => setStation(s.id)}
                className="py-4 text-[11px] font-semibold uppercase tracking-wide sm:text-base sm:tracking-wider"
                style={{ background: on ? C.amber : C.surface, color: on ? "#111" : C.text, borderRight: `1px solid ${C.line}` }}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        <section className="mt-5">
          {station === "prep" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sheet.ingredients.map((i, n) => {
                const m = multOf(i.multiplier);
                const share = m === null ? null : Math.min(100, Math.round((m / linear) * 100));
                const dampened = m !== null && m < linear * 0.985;
                return (
                  <div key={n} className="rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                    <div className="text-sm" style={{ color: C.muted }}>
                      {i.item}
                    </div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight">{i.scaledQty}</div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: C.surface2 }}>
                      <div className="h-full rounded-full" style={{ width: `${share ?? 100}%`, background: share === null ? C.muted : dampened ? C.amber : C.green }} />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-3 text-xs" style={{ color: C.muted }}>
                      <span>{m === null ? i.multiplier || "by hand" : `×${m} of ×${Math.round(linear * 10) / 10} linear`}</span>
                      {dampened && (
                        <span className="font-semibold" style={{ color: C.amber }}>
                          held back
                        </span>
                      )}
                    </div>
                    {i.note && (
                      <div className="mt-2 text-xs" style={{ color: C.muted }}>
                        {i.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(station === "cook" || station === "hold") && (
            <div className="grid gap-3 lg:grid-cols-2">
              {(station === "cook" ? sheet.batching : sheet.holding).map((line, n) => {
                const k = `${station}-${n}`;
                const isDone = !!done[k];
                return (
                  <button
                    key={k}
                    onClick={() => toggle(k)}
                    className="flex items-start gap-4 rounded-lg p-4 text-left"
                    style={{ background: C.surface, border: `1px solid ${isDone ? C.green : C.line}`, opacity: isDone ? 0.6 : 1 }}
                  >
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base font-semibold"
                      style={{ background: isDone ? C.green : C.surface2, color: isDone ? "#111" : C.text }}
                    >
                      {isDone ? <Icon.check className="h-5 w-5" /> : n + 1}
                    </span>
                    <span className="text-lg leading-snug">{line}</span>
                  </button>
                );
              })}
              <p className="text-xs lg:col-span-2" style={{ color: C.muted }}>
                Tap a step when it is done. {station === "cook" ? "Batches sized to your vessels." : "Hot-line holding, as the engine planned it."}
              </p>
            </div>
          )}

          {station === "pull" && (
            <div className="overflow-hidden rounded-lg" style={{ border: `1px solid ${C.line}` }}>
              {sheet.pullList.map((p, n) => (
                <div key={n} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3" style={{ background: n % 2 ? C.surface : C.surface2, borderBottom: `1px solid ${C.line}` }}>
                  <span className="w-56 text-base font-semibold">{p.item}</span>
                  <span className="text-2xl font-semibold tracking-tight" style={{ color: C.amber }}>
                    {p.apQty}
                  </span>
                  {p.note && (
                    <span className="text-xs" style={{ color: C.muted }}>
                      {p.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {station === "checks" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg p-4 sm:col-span-2" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="text-2xl font-semibold" style={{ color: head.status === "warn" ? C.amber : C.green }}>
                  {head.status === "warn" ? `${head.warned} to review` : "All checks passed"}
                </div>
                <div className="mt-1 text-sm" style={{ color: C.muted }}>
                  A deterministic referee re-checks the engine: portion math, units, allergens, feasibility.
                </div>
              </div>
              {checks.map((c) => (
                <div key={c.label} className="flex items-start gap-3 rounded-lg p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-sm" style={{ background: c.status === "warn" ? C.amber : c.status === "pass" ? C.green : C.muted }} />
                  <div>
                    <div className="font-semibold">{c.label}</div>
                    <div className="mt-0.5 text-sm" style={{ color: C.muted }}>
                      {c.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <LookSwitch current="line" />
    </div>
  );
}

function Stepper({ covers, onChange }: { covers: number; onChange: (n: number) => void }) {
  const btn = "flex h-14 w-14 items-center justify-center rounded-lg sm:h-16 sm:w-16";
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
        Covers
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={() => onChange(covers - 50)} className={btn} style={{ background: C.surface2, border: `1px solid ${C.line}` }} aria-label="50 fewer covers">
          <Icon.minus />
        </button>
        <span className="w-40 text-center text-6xl font-semibold tracking-tight sm:text-7xl">{covers}</span>
        <button onClick={() => onChange(covers + 50)} className={btn} style={{ background: C.surface2, border: `1px solid ${C.line}` }} aria-label="50 more covers">
          <Icon.plus />
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => onChange(p)} className="rounded-md px-3 py-1.5 text-sm font-semibold" style={{ background: p === covers ? C.amber : C.surface2, color: p === covers ? "#111" : C.text }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
