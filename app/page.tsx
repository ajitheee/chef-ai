"use client";

import { useEffect, useState } from "react";

const DEMO_ING = [
  { name: "Rice", base: 12.5, unit: "cups", damp: 1.0 },
  { name: "Onion", base: 1.5, unit: "cups", damp: 0.94 },
  { name: "Garlic", base: 1, unit: "oz", damp: 0.75 },
  { name: "Cumin", base: 1, unit: "Tbsp", damp: 0.75 },
  { name: "Jalapeño", base: 2, unit: "oz", damp: 0.62 },
];

function fmt(v: number, unit: string): string {
  const r = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  if (unit === "oz" && v >= 16) return `${r(v / 16)} lb`;
  if (unit === "Tbsp" && v >= 16) return `${r(v / 16)} c`;
  return `${r(v)} ${unit}`;
}

const DISHES = ["Carne Asada", "Chicken Tinga", "Mexican Rice", "Pork Carnitas", "Peruvian Chicken", "Pinto Beans", "Chile Verde", "Pico de Gallo", "Soyrizo"];

const CREAM = "#FCF3E3";
const TERRA = "#C24E33";
const OLIVE = "#51613A";
const SAFFRON = "#E9A93C";

function Wave({ from }: { from: string }) {
  return (
    <svg viewBox="0 0 1440 44" preserveAspectRatio="none" className="block h-8 w-full sm:h-11" aria-hidden>
      <path d="M0,0 L1440,0 L1440,18 C1160,46 980,-8 720,18 C470,44 280,-8 0,18 Z" fill={from} />
    </svg>
  );
}

export default function Landing() {
  const [covers, setCovers] = useState(800);
  const [chefMode, setChefMode] = useState(true);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const mult = covers / 50;
  const yieldLb = Math.round((covers * 3 * 1.04) / 16);
  const garlicLinear = 1 * mult;
  const garlicChef = garlicLinear * 0.75;

  return (
    <div className="font-techno relative min-h-screen bg-[#FCF3E3] text-[#3A2A1E]">
      <div className="noise pointer-events-none fixed inset-0 z-[60] opacity-[0.04] mix-blend-multiply" aria-hidden />

      {/* NAV */}
      <nav className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <span className="font-display text-lg font-semibold">Digital&nbsp;Chef&nbsp;AI</span>
        <a href="/app" className="rounded-full bg-[#3A2A1E] px-5 py-2 text-sm font-semibold text-[#FCF3E3] transition hover:bg-[#C24E33]">
          Open the tool →
        </a>
      </nav>

      {/* HERO */}
      <header className="relative z-10 mx-auto max-w-5xl px-5 pb-12 pt-8 sm:pt-12">
        <span className="animate-wobble inline-block rounded-full bg-[#E9A93C] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#3A2A1E]">
          ★ No garlic bombs
        </span>
        <h1 className="font-display mt-6 text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
          Scale like a
          <span className="relative ml-3 inline-block text-[#C24E33]">
            chef
            <svg viewBox="0 0 200 18" className="absolute -bottom-3 left-0 w-full" preserveAspectRatio="none" aria-hidden>
              <path className="draw-stroke" d="M3,11 C50,2 80,16 120,8 C150,2 180,12 197,6" fill="none" stroke="#E9A93C" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </span>
          .
          <br />
          Not a calculator.
        </h1>
        <p className="mt-7 max-w-md text-base leading-relaxed text-[#3A2A1E]/75">
          Digital Chef AI takes your standardized recipes to any cover count — dampening the
          seasoning, batching the line, and holding it right. The judgment your recipe system
          doesn&apos;t have.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="/app" className="rounded-full bg-[#C24E33] px-7 py-3.5 text-sm font-bold text-[#FCF3E3] shadow-[0_8px_0_0_#A33E27] transition hover:translate-y-0.5 hover:shadow-[0_4px_0_0_#A33E27]">
            Open the tool →
          </a>
          <a href="#how" className="text-sm font-semibold text-[#3A2A1E]/70 underline decoration-[#E9A93C] decoration-2 underline-offset-4 hover:text-[#3A2A1E]">
            How it works ↓
          </a>
        </div>
      </header>

      {/* DEMO CARD */}
      <section className="relative z-10 mx-auto max-w-2xl px-5 pb-14">
        <div className="reveal rounded-[28px] border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_14px_0_0_#3A2A1E] sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#3A2A1E]/55">Live — Mexican Rice</div>
              <div className="font-display text-4xl font-semibold text-[#C24E33]">{covers.toLocaleString()} <span className="text-2xl text-[#3A2A1E]/50">covers</span></div>
            </div>
            <div className="rounded-2xl bg-[#51613A]/10 px-4 py-2 text-center">
              <div className="font-display text-2xl font-semibold text-[#51613A]">{yieldLb} lb</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#3A2A1E]/50">yield</div>
            </div>
          </div>

          <input
            type="range" min={50} max={2000} step={10} value={covers}
            onChange={(e) => setCovers(Number(e.target.value))}
            className="mt-5 w-full accent-[#C24E33]" aria-label="cover count"
          />

          {/* toggle */}
          <div className="mt-4 inline-flex rounded-full border-2 border-[#3A2A1E] p-1">
            <button onClick={() => setChefMode(false)} className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${!chefMode ? "bg-[#C24E33] text-[#FCF3E3]" : "text-[#3A2A1E]/55"}`}>
              Calculator
            </button>
            <button onClick={() => setChefMode(true)} className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${chefMode ? "bg-[#51613A] text-[#FCF3E3]" : "text-[#3A2A1E]/55"}`}>
              Chef AI
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {DEMO_ING.map((ing) => {
              const eff = chefMode ? ing.damp : 1;
              const val = ing.base * mult * eff;
              return (
                <div key={ing.name} className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-3">
                  <span className="text-sm font-semibold">{ing.name}</span>
                  <span className="relative h-3.5 overflow-hidden rounded-full bg-[#3A2A1E]/10">
                    <span className="bar-anim absolute inset-y-0 left-0 rounded-full" style={{ width: `${eff * 100}%`, background: chefMode ? TERRA : "#B0392A" }} />
                  </span>
                  <span className="text-right text-sm font-bold tabular-nums" style={{ color: chefMode ? OLIVE : "#B0392A" }}>{fmt(val, ing.unit)}</span>
                </div>
              );
            })}
          </div>

          <div className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${chefMode ? "bg-[#51613A]/12 text-[#51613A]" : "bg-[#C24E33]/12 text-[#B0392A]"}`}>
            {chefMode
              ? `✓ Balanced for service — garlic ${fmt(garlicChef, "oz")}, not ${fmt(garlicLinear, "oz")}.`
              : `⚠ 16× everything — ${fmt(garlicLinear, "oz")} of garlic. Inedible.`}
          </div>
        </div>
        <p className="mt-5 text-center text-sm font-semibold text-[#3A2A1E]/55">
          Drag the dial · flip <span className="text-[#C24E33]">Calculator</span> ⇄ <span className="text-[#51613A]">Chef AI</span>
        </p>
      </section>

      {/* MARQUEE */}
      <div className="bg-[#3A2A1E] py-3 overflow-hidden">
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <span key={rep} className="flex shrink-0">
              {DISHES.map((d) => (
                <span key={d + rep} className="font-display flex items-center text-lg italic text-[#FCF3E3]/85">
                  {d}<span className="mx-5 text-[#E9A93C]">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* 02 PROBLEM (terracotta) */}
      <section className="bg-[#C24E33] text-[#FCF3E3]">
        <Wave from={CREAM} />
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="reveal text-xs font-bold uppercase tracking-[0.2em] text-[#FCF3E3]/70">02 — The calculator&apos;s mistake</p>
          <h2 className="reveal font-display mt-4 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            16× the garlic is <span className="italic text-[#E9A93C]">not</span> 16× the dish.
          </h2>
          <div className="reveal mt-9 grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#FCF3E3] p-6 text-[#3A2A1E]">
              <div className="text-xs font-bold uppercase tracking-wide text-[#B0392A]">The calculator</div>
              <p className="font-display mt-2 text-2xl font-semibold">Multiplies everything by 16.</p>
              <ul className="mt-4 space-y-1.5 text-sm text-[#3A2A1E]/75">
                <li>· 16× the garlic — a garlic bomb</li>
                <li>· 16× the salt — inedible</li>
                <li>· one giant pan — steams, won&apos;t brown</li>
                <li>· rice turns to glue on the line</li>
              </ul>
            </div>
            <div className="rounded-3xl bg-[#FCF3E3] p-6 text-[#3A2A1E]">
              <div className="text-xs font-bold uppercase tracking-wide text-[#51613A]">The chef</div>
              <p className="font-display mt-2 text-2xl font-semibold">Knows what to hold back.</p>
              <ul className="mt-4 space-y-1.5 text-sm text-[#3A2A1E]/75">
                <li>· dampens garlic, spice &amp; salt</li>
                <li>· works back from edible yield</li>
                <li>· splits into batches automatically</li>
                <li>· adjusts for the 2-hour hot line</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 03 HOW (cream) */}
      <section id="how" className="bg-[#FCF3E3]">
        <Wave from={TERRA} />
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="reveal text-xs font-bold uppercase tracking-[0.2em] text-[#3A2A1E]/50">03 — How it works</p>
          <div className="reveal mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "Drop in a recipe", d: "Paste it, snap a photo, or pick a saved one — then set tonight's covers." },
              { n: "2", t: "The chef-brain thinks", d: "Scales by ingredient role: dampens seasoning, batches the line, holds for service." },
              { n: "3", t: "Production sheet out", d: "Scaled recipe, batching, holding, allergen flags, and a costed pull list." },
            ].map((s) => (
              <div key={s.n} className="rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-6 shadow-[0_8px_0_0_#3A2A1E]">
                <div className="font-display flex h-12 w-12 items-center justify-center rounded-full bg-[#E9A93C] text-2xl font-bold text-[#3A2A1E]">{s.n}</div>
                <h3 className="font-display mt-4 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-[#3A2A1E]/70">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 CAPABILITIES (olive) */}
      <section className="bg-[#51613A] text-[#FCF3E3]">
        <Wave from={CREAM} />
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="reveal text-xs font-bold uppercase tracking-[0.2em] text-[#FCF3E3]/70">04 — What it does</p>
          <h2 className="reveal font-display mt-4 text-4xl font-semibold">One brain. Many lenses.</h2>
          <div className="reveal mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Smart scaling", "Dampens seasoning by role."],
              ["Batching", "Splits across real vessels."],
              ["Hot-line holding", "Cook to 90%, hold safe."],
              ["Pull list", "Raw quantities to order."],
              ["Variations", "2–3 versions to pick."],
              ["Allergen flags", "Big-9 on every sheet."],
              ["Photo input", "Reads a recipe card."],
              ["Print / CSV", "Sheets + order lists."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-[#FCF3E3]/10 p-4 ring-1 ring-[#FCF3E3]/15 transition hover:bg-[#FCF3E3]/15">
                <div className="font-display text-lg font-semibold text-[#E9A93C]">{t}</div>
                <p className="mt-1 text-sm text-[#FCF3E3]/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA (saffron) */}
      <section className="bg-[#E9A93C] text-[#3A2A1E]">
        <Wave from={OLIVE} />
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="font-display text-5xl font-semibold sm:text-6xl">Built for the line.</h2>
          <p className="mx-auto mt-4 max-w-md text-base text-[#3A2A1E]/75">
            Try it on a real dining-hall recipe right now — no sign-up, no setup.
          </p>
          <a href="/app" className="mt-9 inline-block rounded-full bg-[#3A2A1E] px-9 py-4 text-sm font-bold text-[#FCF3E3] shadow-[0_8px_0_0_#241910] transition hover:translate-y-0.5 hover:shadow-[0_4px_0_0_#241910]">
            Open the scaler →
          </a>
        </div>
      </section>

      <footer className="bg-[#3A2A1E] px-5 py-8 text-center text-xs font-semibold uppercase tracking-[0.15em] text-[#FCF3E3]/55">
        Digital Chef AI — production intelligence for high-volume kitchens
      </footer>
    </div>
  );
}
