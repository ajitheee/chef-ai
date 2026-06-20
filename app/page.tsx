"use client";

import { useEffect, useState } from "react";

const DEMO_ING = [
  { name: "RICE", base: 12.5, unit: "cups", damp: 1.0 },
  { name: "ONION", base: 1.5, unit: "cups", damp: 0.94 },
  { name: "GARLIC", base: 1, unit: "oz", damp: 0.75 },
  { name: "CUMIN", base: 1, unit: "Tbsp", damp: 0.75 },
  { name: "JALAPENO", base: 2, unit: "oz", damp: 0.62 },
];

function fmt(v: number, unit: string): string {
  const r = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  if (unit === "oz" && v >= 16) return `${r(v / 16)} lb`;
  if (unit === "Tbsp" && v >= 16) return `${r(v / 16)} c`;
  return `${r(v)} ${unit}`;
}

const DISHES = ["CARNE ASADA", "CHICKEN TINGA", "MEXICAN RICE", "PORK CARNITAS", "PERUVIAN CHICKEN", "PINTO BEANS", "CHILE VERDE", "PICO DE GALLO", "SOYRIZO", "TOMATO SAUCE"];

function Brackets() {
  return (
    <>
      <span className="pointer-events-none absolute -left-px -top-px h-4 w-4 border-l-2 border-t-2 border-[#5BE47A]/70" />
      <span className="pointer-events-none absolute -right-px -top-px h-4 w-4 border-r-2 border-t-2 border-[#5BE47A]/70" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-[#5BE47A]/70" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-[#5BE47A]/70" />
    </>
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
  const pans = Math.max(1, Math.round(covers / 16));
  const garlicLinear = 1 * mult;
  const garlicChef = garlicLinear * 0.75;

  const dim = "text-[#9FC9A8]";

  return (
    <div className="hud-grid relative min-h-screen bg-[#060A07] font-mono-ui text-[#C8E6CC]">
      {/* CRT scanlines + grain */}
      <div className="scanlines pointer-events-none fixed inset-0 z-[60] opacity-50" aria-hidden />
      <div className="noise pointer-events-none fixed inset-0 z-[61] opacity-[0.05] mix-blend-overlay" aria-hidden />

      {/* STATUS BAR */}
      <nav className="sticky top-0 z-50 border-b border-[#5BE47A]/20 bg-[#060A07]/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-2.5 text-[11px] uppercase tracking-[0.18em]">
          <span className="glow-g font-bold">DIGITAL_CHEF_AI</span>
          <span className="hidden items-center gap-4 text-[#9FC9A8]/70 sm:flex">
            <span><span className="caret glow-g">●</span> ENGINE: ONLINE</span>
            <span>v4.0</span>
          </span>
          <a href="/app" className="glow-a hover:text-[#F3EEE3]">OPEN TOOL →</a>
        </div>
      </nav>

      {/* HERO */}
      <header className="mx-auto max-w-5xl px-5 pt-14 pb-10 sm:pt-20">
        <div className="text-[12px] text-[#5BE47A]/80">
          <span className="typewriter">&gt; initializing chef-logic engine ... [OK]</span>
        </div>

        <h1 className="font-techno mt-7 text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl">
          <span className="glow-g">Scale like a chef.</span>
          <br />
          <span className="glow-a">Not a calculator.</span>
        </h1>

        <p className={`mt-6 max-w-lg text-[13px] leading-relaxed ${dim}`}>
          &gt; A production engine that scales your standardized recipes to any cover count —
          dampening the seasoning, batching the line, holding it right. The judgment your recipe
          system doesn&apos;t have.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4 text-[12px] uppercase tracking-[0.15em]">
          <a href="/app" className="border border-[#5BE47A] bg-[#5BE47A]/10 px-6 py-3 font-bold text-[#5BE47A] transition hover:bg-[#5BE47A] hover:text-[#060A07]">
            ▶ Open the tool
          </a>
          <a href="#how" className="text-[#9FC9A8]/70 hover:glow-g">how it works ↓</a>
        </div>
      </header>

      {/* CONSOLE (the star) */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="panel reveal relative overflow-hidden p-5 sm:p-7">
          <Brackets />
          <div className="scan-line pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#5BE47A] to-transparent" />

          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em]">
            <span className="glow-g font-bold">▣ Scaling Console</span>
            <span className={dim}>
              <span className="caret glow-g">●</span> LIVE
            </span>
          </div>

          {/* readouts */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { k: "COVERS", v: covers.toLocaleString(), c: "glow-g" },
              { k: "YIELD", v: `${yieldLb} lb`, c: "glow-a" },
              { k: "PANS", v: `~${pans}`, c: "glow-g" },
            ].map((r) => (
              <div key={r.k} className="border border-[#5BE47A]/20 bg-black/30 p-3 text-center">
                <div className={`font-techno text-3xl font-bold ${r.c}`}>{r.v}</div>
                <div className="mt-1 text-[10px] tracking-[0.2em] text-[#9FC9A8]/60">{r.k}</div>
              </div>
            ))}
          </div>

          {/* slider */}
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-[10px] tracking-[0.2em] text-[#9FC9A8]/60">
              <span>50</span><span>TARGET COVERS</span><span>2000</span>
            </div>
            <input
              type="range" min={50} max={2000} step={10} value={covers}
              onChange={(e) => setCovers(Number(e.target.value))}
              className="w-full accent-[#5BE47A]" aria-label="cover count"
            />
          </div>

          {/* MODE TOGGLE */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[10px] tracking-[0.2em] text-[#9FC9A8]/60">MODE:</span>
            <div className="flex border border-[#5BE47A]/30">
              <button
                onClick={() => setChefMode(false)}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${!chefMode ? "bg-[#FF5C5C]/20 glow-r" : "text-[#9FC9A8]/50"}`}
              >
                Calculator
              </button>
              <button
                onClick={() => setChefMode(true)}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${chefMode ? "bg-[#5BE47A]/15 glow-g" : "text-[#9FC9A8]/50"}`}
              >
                Chef AI
              </button>
            </div>
          </div>

          {/* meters */}
          <div className="mt-5 space-y-2.5">
            {DEMO_ING.map((ing) => {
              const eff = chefMode ? ing.damp : 1;
              const val = ing.base * mult * eff;
              return (
                <div key={ing.name} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-[11px]">
                  <span className="tracking-[0.12em] text-[#9FC9A8]">{ing.name}</span>
                  <span className="relative h-3 border border-[#5BE47A]/15 bg-black/40">
                    <span className="absolute inset-y-0 right-0 w-px bg-[#5BE47A]/40" />
                    <span
                      className={`bar-anim absolute inset-y-0 left-0 ${chefMode ? "bar-glow-g" : "bar-glow-r"}`}
                      style={{ width: `${eff * 100}%` }}
                    />
                  </span>
                  <span className={`text-right tabular-nums ${chefMode ? "glow-g" : "glow-r"}`}>{fmt(val, ing.unit)}</span>
                </div>
              );
            })}
          </div>

          {/* status */}
          <div className="mt-5 border-t border-[#5BE47A]/20 pt-4 text-[11px]">
            {chefMode ? (
              <div className="glow-g tracking-[0.12em]">✓ STATUS: BALANCED FOR SERVICE — garlic {fmt(garlicChef, "oz")} (−25% vs linear)</div>
            ) : (
              <div className="glow-r tracking-[0.12em]">⚠ FAULT: 16× SALT · GARLIC BOMB ({fmt(garlicLinear, "oz")}) · INEDIBLE AT SCALE</div>
            )}
          </div>
        </div>
        <p className="mt-5 text-center text-[11px] uppercase tracking-[0.2em] text-[#9FC9A8]/50">
          ↑ drag the dial · flip CALCULATOR ⇄ CHEF to see the difference
        </p>
      </section>

      {/* DATA TICKER */}
      <div className="border-y border-[#5BE47A]/15 bg-black/30 py-2.5 overflow-hidden">
        <div className="marquee-track text-[11px] tracking-[0.2em] text-[#5BE47A]/55">
          {[0, 1].map((rep) => (
            <span key={rep} className="flex shrink-0">
              {DISHES.map((d) => (
                <span key={d + rep} className="flex items-center">{d}<span className="mx-4 text-[#F5B83D]/60">::</span></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* 02 FAULT */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="reveal text-[11px] uppercase tracking-[0.3em] text-[#9FC9A8]/45">02 // THE LINEAR FAULT</p>
        <h2 className="reveal font-techno mt-4 max-w-2xl text-3xl font-bold uppercase leading-tight sm:text-4xl">
          16× the garlic is <span className="glow-r">not</span> 16× the dish.
        </h2>
        <div className="reveal mt-8 grid gap-4 sm:grid-cols-2">
          <div className="border border-[#FF5C5C]/40 bg-[#FF5C5C]/[0.04] p-6">
            <div className="glow-r text-[11px] font-bold uppercase tracking-[0.2em]">⚠ Calculator</div>
            <ul className={`mt-4 space-y-2 text-[12px] ${dim}`}>
              <li>× 16× garlic — garlic bomb</li>
              <li>× 16× salt — inedible</li>
              <li>× one giant pan — steams, won&apos;t brown</li>
              <li>× rice turns to glue on the line</li>
            </ul>
          </div>
          <div className="border border-[#5BE47A]/40 bg-[#5BE47A]/[0.04] p-6">
            <div className="glow-g text-[11px] font-bold uppercase tracking-[0.2em]">✓ Chef AI</div>
            <ul className={`mt-4 space-y-2 text-[12px] ${dim}`}>
              <li>+ dampens garlic, spice &amp; salt</li>
              <li>+ works back from edible yield</li>
              <li>+ splits into batches automatically</li>
              <li>+ adjusts for the 2-hour hot line</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 03 PIPELINE */}
      <section id="how" className="border-y border-[#5BE47A]/15 bg-black/20 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="reveal text-[11px] uppercase tracking-[0.3em] text-[#9FC9A8]/45">03 // PIPELINE</p>
          <div className="reveal mt-8 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {[
              { t: "INPUT", d: "Paste, snap a photo, or pick a saved recipe + set covers.", c: "glow-g" },
              { t: "ENGINE", d: "Chef-logic scales by role: dampen, batch, hold, flag allergens.", c: "glow-a" },
              { t: "OUTPUT", d: "Production sheet: scaled recipe, batching, holding, pull list.", c: "glow-g" },
            ].map((s, i) => (
              <div key={s.t} className="contents">
                <div className="relative border border-[#5BE47A]/25 bg-black/30 p-5">
                  <Brackets />
                  <div className={`font-techno text-lg font-bold uppercase ${s.c}`}>{s.t}</div>
                  <p className={`mt-2 text-[12px] ${dim}`}>{s.d}</p>
                </div>
                {i < 2 && (
                  <div className="hidden items-center justify-center text-2xl text-[#5BE47A]/60 sm:flex">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 MODULES */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="reveal text-[11px] uppercase tracking-[0.3em] text-[#9FC9A8]/45">04 // MODULES</p>
        <h2 className="reveal font-techno mt-4 text-3xl font-bold uppercase">One brain. Many lenses.</h2>
        <div className="reveal mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["NON-LINEAR SCALE", "Dampens by ingredient role."],
            ["BATCHING", "Splits across real vessels."],
            ["HOT-LINE HOLD", "Cook to 90%, hold safely."],
            ["AP PULL LIST", "Raw qty to order."],
            ["VARIATIONS", "2-3 versions to pick."],
            ["ALLERGEN FLAGS", "Big-9 on every sheet."],
            ["PHOTO INPUT", "Reads a recipe card."],
            ["PRINT / CSV", "Sheets + order lists."],
          ].map(([t, d]) => (
            <div key={t} className="border border-[#5BE47A]/20 bg-black/30 p-4 transition hover:border-[#5BE47A]/60 hover:bg-[#5BE47A]/[0.05]">
              <div className="flex items-center gap-2">
                <span className="caret glow-g text-[10px]">●</span>
                <span className="font-techno text-[13px] font-bold uppercase glow-g">{t}</span>
              </div>
              <p className={`mt-2 text-[11px] ${dim}`}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className="relative isolate overflow-hidden border-t border-[#5BE47A]/20 px-5 py-28 text-center">
        <div className="scan-line pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#5BE47A]/60 to-transparent" />
        <h2 className="font-techno text-5xl font-bold uppercase glow-g sm:text-6xl">Built for the line.</h2>
        <p className={`mx-auto mt-4 max-w-md text-[13px] ${dim}`}>
          &gt; Run it on a real dining-hall recipe now — no sign-up, no setup.
        </p>
        <a href="/app" className="mt-9 inline-block border border-[#5BE47A] bg-[#5BE47A]/10 px-9 py-4 text-[12px] font-bold uppercase tracking-[0.15em] text-[#5BE47A] transition hover:bg-[#5BE47A] hover:text-[#060A07]">
          ▶ Open the scaler
        </a>
      </section>

      <footer className="border-t border-[#5BE47A]/15 px-5 py-8 text-center text-[10px] uppercase tracking-[0.2em] text-[#9FC9A8]/40">
        DIGITAL_CHEF_AI — production intelligence for high-volume kitchens
      </footer>
    </div>
  );
}
