"use client";

import { useDemoSheet, clampCovers, PRESETS, multOf, roleOf, LookSwitch, Icon } from "./shared";

/**
 * Look C, "Board": a visual app. An icon rail, a covers slider that rescales
 * instantly, four facts from the sheet, and the chef's number drawn against
 * the calculator's on every ingredient row, which is the product's whole point.
 */

const C = {
  bg: "#f3f4f6",
  rail: "#0b1220",
  card: "#ffffff",
  line: "#e5e7eb",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#0f766e",
  accentSoft: "#ccfbf1",
  linear: "#cbd5e1",
  amber: "#b45309",
  amberSoft: "#fef3c7",
  green: "#15803d",
};

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  structural: { bg: "#e2e8f0", fg: "#334155" },
  "flavor base": { bg: "#dbeafe", fg: "#1d4ed8" },
  "high impact": { bg: "#fef3c7", fg: "#b45309" },
  seasoning: { bg: "#ede9fe", fg: "#6d28d9" },
  finishing: { bg: "#dcfce7", fg: "#15803d" },
  liquid: { bg: "#cffafe", fg: "#0e7490" },
  fat: { bg: "#ffedd5", fg: "#c2410c" },
};

export default function LookBoard() {
  const { covers, setCovers, sheet, checks, head } = useDemoSheet(800);
  const linear = covers / sheet.baseYield.portions;
  const facts = [
    { label: "Finished yield", value: sheet.targetYield.finishedYield },
    { label: "Ingredients", value: String(sheet.ingredients.length) },
    { label: "Pull list", value: `${sheet.pullList.length} lines` },
    { label: "Checks", value: head.status === "warn" ? `${checks.length - head.warned} of ${checks.length}` : `${checks.length} of ${checks.length}` },
  ];

  return (
    <div className="min-h-screen lg:flex" style={{ background: C.bg, color: C.text }}>
      <aside className="flex items-center gap-1 px-3 py-2 lg:w-20 lg:flex-col lg:items-stretch lg:gap-2 lg:px-3 lg:py-5" style={{ background: C.rail }}>
        <div className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white lg:mx-auto lg:mb-4 lg:mr-auto" style={{ background: C.accent }}>
          DC
        </div>
        {[
          { icon: <Icon.home />, label: "Scale", on: true },
          { icon: <Icon.chat />, label: "Brain", on: false },
          { icon: <Icon.book />, label: "Library", on: false },
          { icon: <Icon.calendar />, label: "Plan", on: false },
        ].map((n) => (
          <div key={n.label} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold lg:flex-col lg:gap-1 lg:py-2.5 ${n.on ? "text-white" : "text-white/55"}`} style={{ background: n.on ? "rgba(255,255,255,0.12)" : "transparent" }} title={n.label}>
            {n.icon}
            <span className="hidden sm:inline">{n.label}</span>
          </div>
        ))}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
              Production sheet
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {sheet.dish}
              <span className="ml-3 align-middle rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: C.amberSoft, color: C.amber }}>
                {sheet.status || "Draft"}
              </span>
            </h1>
          </div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: C.text }}>
            <Icon.print className="h-4 w-4" /> Print
          </button>
        </div>

        <section className="mt-5 rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                Covers
              </div>
              <div className="text-5xl font-semibold tracking-tight sm:text-6xl">{covers}</div>
            </div>
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setCovers(p)} className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: p === covers ? C.accent : C.bg, color: p === covers ? "#fff" : C.text }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min={50}
            max={1600}
            step={10}
            value={covers}
            onChange={(e) => setCovers(clampCovers(Number(e.target.value)))}
            className="mt-4 h-2 w-full cursor-pointer"
            style={{ accentColor: C.accent }}
            aria-label="Covers"
          />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl px-4 py-3" style={{ background: C.bg }}>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                  {f.label}
                </div>
                <div className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{f.value}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-base font-semibold">Scaled recipe</h2>
              <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-5 rounded-full" style={{ background: C.linear }} /> calculator ×{Math.round(linear * 10) / 10}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-5 rounded-full" style={{ background: C.accent }} /> chef
                </span>
              </div>
            </div>
            <ul className="mt-3 divide-y" style={{ borderColor: C.line }}>
              {sheet.ingredients.map((i, n) => {
                const role = roleOf(i.role, i.note);
                const rc = ROLE_COLORS[role] ?? { bg: "#f1f5f9", fg: "#475569" };
                const m = multOf(i.multiplier);
                const share = m === null ? null : Math.min(100, (m / linear) * 100);
                return (
                  <li key={n} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{i.item}</div>
                      <span className="mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: rc.bg, color: rc.fg }}>
                        {role}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: C.linear }}>
                        <div className="h-full rounded-full" style={{ width: `${share ?? 100}%`, background: share === null ? "#94a3b8" : C.accent }} />
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: C.muted }}>
                        {m === null ? i.multiplier || "by hand" : `×${m}`}
                        {i.note ? ` · ${i.note}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-base font-semibold whitespace-nowrap">{i.scaledQty}</div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="space-y-5">
            <Card title="Batching">
              <Steps lines={sheet.batching} />
            </Card>
            <Card title="Hot-line holding">
              <Steps lines={sheet.holding} />
            </Card>
            <Card title={head.status === "warn" ? `${head.warned} to review` : "All checks passed"} tone={head.status === "warn" ? "amber" : "green"}>
              <ul className="space-y-2 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.status === "warn" ? C.amber : C.green }} />
                    <span>
                      <span className="font-semibold">{c.label}.</span> {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <section className="mt-5 rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <h2 className="text-base font-semibold">Pull list, in ordering units</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4 text-right">Order</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {sheet.pullList.map((p, n) => (
                  <tr key={n} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="py-2.5 pr-4 font-medium">{p.item}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold whitespace-nowrap">{p.apQty}</td>
                    <td className="py-2.5 text-xs" style={{ color: C.muted }}>
                      {p.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <LookSwitch current="board" />
    </div>
  );
}

function Card({ title, tone, children }: { title: string; tone?: "amber" | "green"; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <h2 className="text-base font-semibold" style={{ color: tone === "amber" ? C.amber : tone === "green" ? C.green : C.text }}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Steps({ lines }: { lines: string[] }) {
  return (
    <ol className="space-y-2.5 text-sm">
      {lines.map((l, n) => (
        <li key={n} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold" style={{ background: C.accentSoft, color: C.accent }}>
            {n + 1}
          </span>
          <span>{l}</span>
        </li>
      ))}
    </ol>
  );
}
