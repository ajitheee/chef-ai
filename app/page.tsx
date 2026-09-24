"use client";

import { useState } from "react";
import { CHIP, PRIMARY, H2, TH, TD } from "@/components/paper";

/** The same dampening the built-in scaler applies to the sample card — a real comparison, not a mock. */
const BASE_PORTIONS = 50;
const DEMO_ING = [
  { name: "Jasmine rice (dry)", base: 12.5, unit: "cups", damp: 1.0, role: "structural" },
  { name: "Yellow onion", base: 1.5, unit: "cups", damp: 0.94, role: "flavor base" },
  { name: "Garlic", base: 1, unit: "oz", damp: 0.75, role: "high impact" },
  { name: "Cumin", base: 1, unit: "Tbsp", damp: 0.75, role: "high impact" },
  { name: "Jalapeño", base: 2, unit: "oz", damp: 0.62, role: "high impact" },
];

function fmt(v: number, unit: string): string {
  const r = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  if (unit === "oz" && v >= 16) return `${r(v / 16)} lb`;
  if (unit === "Tbsp" && v >= 16) return `${r(v / 16)} cups`;
  return `${r(v)} ${unit}`;
}

const STEPS: [string, string, string][] = [
  ["1", "Drop in a recipe", "Paste the card, snap a photo, or open one from your library. Set today's covers, the portion size, and the equipment on hand."],
  ["2", "The engine reasons like a chef", "Every ingredient is scaled by its role. Finished yield comes first; trim and cooking loss are applied; batches and hot-line holding are planned."],
  ["3", "A production sheet comes out", "Scaled recipe, method, batching, holding, pull list, safety and allergen flags, accuracy checks — printable, or a CSV for purchasing."],
];

const ON_THE_SHEET: [string, string][] = [
  ["Scaled recipe", "Each ingredient with its effective multiplier and the reason whenever it isn't linear."],
  ["Batching", "Split across the vessels you actually have — never an overcrowded pan."],
  ["Hot-line holding", "Starches cooked slightly under, liquid held back, seasoning corrected on the line."],
  ["Pull list", "As-purchased quantities in real ordering units, with trim and cook yield shown."],
  ["Accuracy checks", "A deterministic referee re-checks portion math, units, allergens and feasibility."],
  ["Safety & allergens", "Configured temperatures quoted, never invented; allergens listed with their verification status."],
  ["HACCP, prep list, SOP", "One tap each, built from the sheet."],
  ["Nutrition & food cost", "A per-portion estimate, and cost from your own price list."],
  ["Kitchen memory", "Your corrections apply to every future scale."],
];

export default function Landing() {
  const [covers, setCovers] = useState(800);
  const mult = covers / BASE_PORTIONS;
  const yieldLb = Math.round((covers * 3 * 1.04) / 16);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <span className="text-base font-semibold tracking-tight">Digital Chef AI</span>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#how" className="text-ink-2 hover:text-ink">How it works</a>
            <a href="/login" className="text-ink-2 hover:text-ink">Sign in</a>
            <a href="/app" className={`${PRIMARY} px-4 py-2 text-sm`}>Open the scaler</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 lg:px-8">
        <section className="py-12 sm:py-16">
          <p className={H2}>Production scaling for high-volume kitchens</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Scale a recipe the way a chef would — not the way a calculator does.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2">
            Digital Chef AI takes a standardized recipe to any cover count: seasoning dampened by its role, batches sized to your vessels, hot-line holding accounted for, and a pull list in as-purchased units — on one production sheet you can print and hand to the line.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a href="/app" className={`${PRIMARY} px-5 py-3 text-base`}>Open the scaler →</a>
            <a href="#how" className="text-sm font-semibold underline underline-offset-4">How it works</a>
          </div>
        </section>

        {/* Calculator vs chef — one slider, the same card */}
        <section className="border-t border-ink pb-12 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <h2 className={H2}>Mexican Rice · base {BASE_PORTIONS} portions · 3 oz cooked</h2>
              <p className="mt-1 text-2xl font-semibold">
                {covers.toLocaleString()} covers{" "}
                <span className="text-base font-normal text-ink-2">≈ {yieldLb} lb finished, +4 % buffer</span>
              </p>
            </div>
            <label className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-3">
              Covers
              <input
                type="range"
                min={50}
                max={2000}
                step={10}
                value={covers}
                onChange={(e) => setCovers(Number(e.target.value))}
                className="w-56 accent-ink"
                aria-label="Cover count"
              />
            </label>
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Ingredient</th>
                <th className={`${TH} hidden sm:table-cell`}>Role</th>
                <th className={`${TH} text-right`}>Calculator ×{mult.toFixed(0)}</th>
                <th className={`${TH} pr-0 text-right`}>Digital Chef AI</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_ING.map((ing) => {
                const linear = ing.base * mult;
                const chef = linear * ing.damp;
                return (
                  <tr key={ing.name}>
                    <td className={`${TD} font-semibold`}>{ing.name}</td>
                    <td className={`${TD} hidden text-ink-3 sm:table-cell`}>{ing.role}</td>
                    <td className={`${TD} whitespace-nowrap text-right ${ing.damp < 1 ? "text-danger line-through" : ""}`}>{fmt(linear, ing.unit)}</td>
                    <td className={`${TD} whitespace-nowrap pr-0 text-right font-semibold`}>
                      {fmt(chef, ing.unit)}
                      {ing.damp < 1 && <span className="ml-1 text-xs font-normal text-ink-3">×{(mult * ing.damp).toFixed(1)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 max-w-3xl text-sm text-ink-2">
            Multiplying everything by {mult.toFixed(0)} gives {fmt(mult, "oz")} of garlic and one pan that steams instead of browning. The chef works from the finished yield, holds seasoning back, splits the batch, and cooks the rice slightly under for the hot line.
          </p>
        </section>

        <section id="how" className="border-t border-ink pb-12 pt-4">
          <h2 className={H2}>How it works</h2>
          <ol className="mt-4 grid gap-8 sm:grid-cols-3">
            {STEPS.map(([n, t, d]) => (
              <li key={n} className="border-t border-line pt-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Step {n}</div>
                <h3 className="mt-1 text-lg font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-ink pb-12 pt-4">
          <h2 className={H2}>On every sheet</h2>
          <ul className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {ON_THE_SHEET.map(([t, d]) => (
              <li key={t} className="border-t border-line pt-2">
                <div className="font-semibold">{t}</div>
                <p className="mt-0.5 text-ink-2">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-ink pb-12 pt-4">
          <h2 className={H2}>Governed reasoning</h2>
          <p className="mt-3 max-w-3xl text-sm text-ink-2">
            The engine runs under a versioned master prompt and production knowledge pack written for professional kitchens. Every sheet states its working assumptions, marks what is unverified, and starts as a{" "}
            <span className="font-semibold text-ink">Draft</span> until a kitchen test confirms the yield — the recipe lifecycle a real operation uses.
          </p>
        </section>

        <section className="border-t border-ink py-12">
          <h2 className="text-2xl font-semibold">Built for the line.</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-2">
            Open the scaler and run it on one of your own cards. If you were given a login, sign in; otherwise ask your admin for access.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a href="/app" className={`${PRIMARY} px-5 py-3 text-base`}>Open the scaler →</a>
            <a href="/login" className={CHIP}>Sign in</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[11px] font-bold uppercase tracking-wider text-ink-3 lg:px-8">
          <span>Digital Chef AI — production intelligence for high-volume kitchens</span>
          <a href="/terms" className="underline underline-offset-2 hover:text-ink">Terms of use</a>
        </div>
      </footer>
    </div>
  );
}
