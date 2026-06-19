"use client";

import { useEffect, useState } from "react";

/* ---------- interactive demo data (mirrors the engine's dampening) ---------- */
const DEMO_ING = [
  { name: "Jasmine rice", base: 12.5, unit: "cups", damp: 1.0, role: "structural" },
  { name: "Onion", base: 1.5, unit: "cups", damp: 0.94, role: "flavor base" },
  { name: "Garlic", base: 1, unit: "oz", damp: 0.75, role: "flavor base" },
  { name: "Cumin", base: 1, unit: "Tbsp", damp: 0.75, role: "high impact" },
  { name: "Jalapeño", base: 2, unit: "oz", damp: 0.62, role: "high impact" },
];

function fmt(v: number, unit: string): string {
  const r = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  if (unit === "oz" && v >= 16) return `${r(v / 16)} lb`;
  if (unit === "Tbsp" && v >= 16) return `${r(v / 16)} c`;
  return `${r(v)} ${unit}`;
}

const DISHES = [
  "Carne Asada", "Chicken Tinga", "Mexican Rice", "Pork Carnitas", "Peruvian Chicken",
  "Pinto Beans", "Chile Verde", "Pico de Gallo", "Cilantro-Lime Rice", "Soyrizo", "Tomato Sauce",
];

const INK = "#1B1A17";
const RUST = "#B23A12";

export default function Landing() {
  const [covers, setCovers] = useState(800);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const mult = covers / 50;
  const garlicLinear = 1 * mult;
  const garlicChef = garlicLinear * 0.75;

  const hair = "border-[#1B1A17]/15";

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#1B1A17] [text-rendering:optimizeLegibility]">
      {/* TOP BAR */}
      <nav className={`sticky top-0 z-50 border-b ${hair} bg-[#F7F4EE]/85 backdrop-blur`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="font-mono-ui text-xs font-medium uppercase tracking-[0.2em]">
            Digital&nbsp;Chef&nbsp;AI
          </span>
          <a href="/app" className="font-mono-ui text-xs uppercase tracking-[0.15em] underline decoration-[#B23A12] decoration-2 underline-offset-4 hover:text-[#B23A12]">
            Open the tool →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header className="mx-auto max-w-5xl px-5">
        <div className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          {/* left: type */}
          <div>
            <p className="font-mono-ui text-[11px] uppercase tracking-[0.25em] text-[#1B1A17]/55">
              Production intelligence <span className="text-[#B23A12]">/</span> v4.0 <span className="caret text-[#B23A12]">_</span>
            </p>
            <h1 className="font-display mt-5 text-5xl font-medium leading-[0.98] tracking-tight sm:text-6xl">
              Scale like a
              <span className="relative ml-3 inline-block">
                chef.
                <span className="draw-line absolute -bottom-1 left-0 h-[3px] w-full bg-[#B23A12]" />
              </span>
              <br />
              <span className="italic text-[#B23A12]">Not a calculator.</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#1B1A17]/70">
              Digital Chef AI takes your standardized recipes to any cover count — dampening the
              seasoning, batching the line, and holding it right. The judgment your recipe system
              doesn&apos;t have.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <a href="/app" className="bg-[#1B1A17] px-6 py-3 text-sm font-medium text-[#F7F4EE] transition hover:bg-[#B23A12]">
                Open the tool →
              </a>
              <a href="#how" className="font-mono-ui text-xs uppercase tracking-[0.15em] text-[#1B1A17]/60 hover:text-[#1B1A17]">
                How it works ↓
              </a>
            </div>
          </div>

          {/* right: spec card (interactive) */}
          <div className={`reveal border ${hair} bg-[#FBF9F3] p-5 sm:p-6`}>
            <div className={`flex items-end justify-between border-b ${hair} pb-3`}>
              <div className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[#1B1A17]/55">
                Live scale — Mexican Rice
              </div>
              <div className="text-right">
                <div className="font-display text-3xl font-medium leading-none">{covers.toLocaleString()}</div>
                <div className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-[#1B1A17]/45">covers</div>
              </div>
            </div>

            <input
              type="range" min={50} max={2000} step={10} value={covers}
              onChange={(e) => setCovers(Number(e.target.value))}
              className="mt-4 w-full accent-[#B23A12]"
              aria-label="cover count"
            />

            <div className="mt-4 space-y-3">
              {DEMO_ING.map((ing) => {
                const chef = ing.base * mult * ing.damp;
                const pctLess = Math.round((1 - ing.damp) * 100);
                return (
                  <div key={ing.name} className="grid grid-cols-[5.5rem_1fr_4.2rem] items-center gap-2">
                    <span className="truncate text-[13px]">{ing.name}</span>
                    <span className="relative h-2.5 overflow-hidden bg-[#1B1A17]/8">
                      <span
                        className="bar-anim absolute inset-y-0 left-0"
                        style={{ width: `${ing.damp * 100}%`, background: ing.damp === 1 ? "#3F6B4E" : RUST }}
                      />
                    </span>
                    <span className="text-right font-mono-ui text-[11px] tabular-nums text-[#1B1A17]/75">
                      {pctLess > 0 ? `−${pctLess}%` : "full"}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className={`mt-4 border-t ${hair} pt-3 font-mono-ui text-[11px] leading-relaxed text-[#1B1A17]/65`}>
              At {covers.toLocaleString()} covers a calculator wants{" "}
              <span className="text-[#B23A12]">{fmt(garlicLinear, "oz")}</span> of garlic.
              The chef uses <span className="text-[#3F6B4E]">{fmt(garlicChef, "oz")}</span>.
            </p>
          </div>
        </div>
      </header>

      {/* MARQUEE of his real dishes */}
      <div className={`border-y ${hair} bg-[#F2EEE5] py-3 overflow-hidden`}>
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex shrink-0 items-center">
              {DISHES.map((d) => (
                <span key={d + rep} className="flex items-center font-display text-lg italic text-[#1B1A17]/45">
                  {d}
                  <span className="mx-5 text-[#B23A12]/60">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 02 — THE PROBLEM */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="reveal font-mono-ui text-[11px] uppercase tracking-[0.25em] text-[#1B1A17]/45">
          02 — The calculator&apos;s mistake
        </p>
        <h2 className="reveal font-display mt-4 max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">
          Sixteen times the garlic is <span className="italic text-[#B23A12]">not</span> sixteen times the dish.
        </h2>
        <div className={`reveal mt-10 grid gap-px sm:grid-cols-2 ${hair} border bg-[#1B1A17]/10`}>
          <div className="bg-[#F7F4EE] p-7">
            <div className="font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[#9C3B2E]">The calculator</div>
            <p className="mt-3 font-display text-xl">Multiplies everything by 16.</p>
            <ul className="mt-5 space-y-2 font-mono-ui text-[12px] text-[#1B1A17]/70">
              <li>× 16× the garlic — a garlic bomb</li>
              <li>× 16× the salt — inedible</li>
              <li>× one giant pan — steams, never browns</li>
              <li>× rice turns to glue on the line</li>
            </ul>
          </div>
          <div className="bg-[#F7F4EE] p-7">
            <div className="font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[#3F6B4E]">The chef</div>
            <p className="mt-3 font-display text-xl">Knows what to hold back.</p>
            <ul className="mt-5 space-y-2 font-mono-ui text-[12px] text-[#1B1A17]/70">
              <li>+ dampens garlic, spice &amp; salt</li>
              <li>+ works back from edible yield</li>
              <li>+ splits into batches automatically</li>
              <li>+ adjusts for the 2-hour hot line</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 03 — HOW IT WORKS */}
      <section id="how" className={`border-t ${hair} bg-[#F2EEE5]`}>
        <div className="mx-auto max-w-5xl px-5 py-20">
          <p className="reveal font-mono-ui text-[11px] uppercase tracking-[0.25em] text-[#1B1A17]/45">
            03 — How it works
          </p>
          <div className="mt-8">
            {[
              { n: "01", t: "Drop in a recipe", d: "Paste it, snap a photo of the card, or pick a saved one — then set tonight's cover count." },
              { n: "02", t: "The chef-brain thinks", d: "Scales by ingredient role: dampening seasoning, batching the line, holding for service, flagging allergens." },
              { n: "03", t: "Production sheet out", d: "Scaled recipe, batching, hot-line holding, and a costed pull list. Print it or export to CSV." },
            ].map((s) => (
              <div key={s.n} className={`reveal grid gap-4 border-t ${hair} py-7 sm:grid-cols-[5rem_1fr]`}>
                <div className="font-display text-4xl text-[#B23A12]">{s.n}</div>
                <div>
                  <h3 className="font-display text-2xl font-medium">{s.t}</h3>
                  <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#1B1A17]/70">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — CAPABILITIES (spec sheet) */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="reveal font-mono-ui text-[11px] uppercase tracking-[0.25em] text-[#1B1A17]/45">
          04 — What it does
        </p>
        <h2 className="reveal font-display mt-4 text-3xl font-medium">One brain. Many lenses.</h2>
        <div className="reveal mt-8 grid sm:grid-cols-2">
          {[
            ["Non-linear scaling", "Dampens seasoning by ingredient role."],
            ["Batching", "Splits volume across real vessels."],
            ["Hot-line holding", "Cook to 90%, reserve liquid, hold safely."],
            ["AP pull list", "Raw quantities to order from inventory."],
            ["Variations", "2–3 versions to pick from, then scale."],
            ["Allergen flags", "Big-9 surfaced on every sheet."],
            ["Photo input", "Snap a recipe card — it reads it."],
            ["Print / CSV", "Clean sheets for the line, lists for ordering."],
          ].map(([t, d], i) => (
            <div key={t} className={`flex items-baseline gap-4 border-t ${hair} py-4 ${i % 2 === 0 ? "sm:pr-8" : "sm:pl-8 sm:border-l"}`}>
              <span className="font-mono-ui text-[11px] text-[#B23A12]">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="font-display text-lg">{t}</div>
                <div className="font-mono-ui text-[12px] text-[#1B1A17]/60">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className={`border-t ${hair} bg-[#1B1A17] text-[#F7F4EE]`}>
        <div className="mx-auto max-w-5xl px-5 py-24 text-center">
          <h2 className="font-display text-4xl font-medium sm:text-5xl">
            Built for the line.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-[#F7F4EE]/70">
            Try it on a real dining-hall recipe right now — no sign-up, no setup.
          </p>
          <a href="/app" className="mt-8 inline-block bg-[#B23A12] px-8 py-3.5 text-sm font-medium text-[#F7F4EE] transition hover:bg-[#F7F4EE] hover:text-[#1B1A17]">
            Open the scaler →
          </a>
        </div>
      </section>

      <footer className={`border-t border-[#F7F4EE]/10 bg-[#1B1A17] px-5 py-8 text-center font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[#F7F4EE]/40`}>
        Digital Chef AI — production intelligence for high-volume kitchens
      </footer>
    </div>
  );
}
