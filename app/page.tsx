"use client";

import { useEffect, useState } from "react";

/* ---------- interactive demo data (mirrors the engine's dampening) ---------- */
const DEMO_ING = [
  { name: "RICE", base: 12.5, unit: "cups", damp: 1.0 },
  { name: "ONION", base: 1.5, unit: "cups", damp: 0.94 },
  { name: "GARLIC", base: 1, unit: "oz", damp: 0.75 },
  { name: "CUMIN", base: 1, unit: "Tbsp", damp: 0.75 },
  { name: "JALAPEÑO", base: 2, unit: "oz", damp: 0.62 },
];

function fmt(v: number, unit: string): string {
  const r = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  if (unit === "oz" && v >= 16) return `${r(v / 16)} lb`;
  if (unit === "Tbsp" && v >= 16) return `${r(v / 16)} c`;
  return `${r(v)} ${unit}`;
}

const DISHES = [
  "Carne Asada", "Chicken Tinga", "Mexican Rice", "Pork Carnitas", "Peruvian Chicken",
  "Pinto Beans", "Chile Verde", "Pico de Gallo", "Cilantro-Lime Rice", "Soyrizo",
];

const RUST = "#C0451B";
const GREEN = "#6B8F71";

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
    <div className="relative min-h-screen bg-[#16130E] text-[#F3EEE3]">
      {/* film grain over everything */}
      <div className="noise pointer-events-none fixed inset-0 z-[60] opacity-[0.06] mix-blend-overlay" aria-hidden />

      {/* ===== HERO (dark) ===== */}
      <section className="relative isolate overflow-hidden bg-[#16130E] px-5 pb-32 pt-6 sm:pb-44">
        {/* giant struck-through 16x */}
        <span
          className="font-display pointer-events-none absolute -right-6 top-24 select-none text-[40vw] font-medium leading-none text-[#F3EEE3]/[0.04] line-through decoration-[#C0451B]/40 decoration-[6px] sm:text-[22rem]"
          aria-hidden
        >
          16×
        </span>

        <div className="mx-auto max-w-5xl">
          {/* nav */}
          <nav className="flex items-center justify-between py-3">
            <span className="font-mono-ui text-xs uppercase tracking-[0.2em] text-[#F3EEE3]/90">
              Digital&nbsp;Chef&nbsp;AI
            </span>
            <a href="/app" className="font-mono-ui text-xs uppercase tracking-[0.15em] text-[#E0A21A] hover:text-[#F3EEE3]">
              Open the tool →
            </a>
          </nav>

          {/* stamp */}
          <div className="relative">
            <div className="stamp animate-stamp absolute right-0 top-6 hidden rotate-[-8deg] px-3 py-2 text-center text-[#C0451B] sm:block">
              <div className="font-mono-ui text-[10px] font-bold leading-tight tracking-[0.2em]">CHEF-LOGIC</div>
              <div className="font-mono-ui text-[9px] leading-tight tracking-[0.15em]">NOT LINEAR MATH</div>
            </div>
          </div>

          <p className="mt-16 font-mono-ui text-[11px] uppercase tracking-[0.3em] text-[#F3EEE3]/50 sm:mt-24">
            Production intelligence <span className="text-[#C0451B]">/</span> v4.0 <span className="caret text-[#E0A21A]">_</span>
          </p>

          <h1 className="font-display mt-5 max-w-3xl text-[15vw] font-medium leading-[0.92] tracking-tight sm:text-[6.5rem]">
            Scale like a
            <span className="relative ml-3 inline-block">
              chef.
              <span className="draw-line absolute -bottom-2 left-0 h-[5px] w-full bg-[#C0451B]" />
            </span>
            <br />
            <span className="italic text-[#E0A21A]">Not a calculator.</span>
          </h1>

          <p className="mt-7 max-w-md text-[15px] leading-relaxed text-[#F3EEE3]/70">
            Digital Chef AI takes your standardized recipes to any cover count — dampening the
            seasoning, batching the line, holding it right. The judgment your recipe system
            doesn&apos;t have.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-5">
            <a href="/app" className="bg-[#C0451B] px-7 py-3.5 text-sm font-medium text-[#F3EEE3] transition hover:bg-[#E0A21A] hover:text-[#16130E]">
              Open the tool →
            </a>
            <a href="#how" className="font-mono-ui text-xs uppercase tracking-[0.15em] text-[#F3EEE3]/55 hover:text-[#F3EEE3]">
              How it works ↓
            </a>
          </div>
        </div>
      </section>

      {/* ===== TICKET DEMO (cream, overlapping the hero) ===== */}
      <section className="relative z-10 bg-[#F3EEE3] px-5 pb-20 text-[#1B1A17]">
        <div className="ticket reveal mx-auto -mt-24 max-w-md rotate-[-1deg] border-x border-[#1B1A17]/20 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] sm:-mt-32">
          <div className="perf perf-top border-x border-[#1B1A17]/20" />
          <div className="relative border-x-0 px-6 py-5">
            {/* corner stamp */}
            <div className="stamp animate-stamp absolute -right-2 top-8 rotate-[10deg] bg-[#F3EEE3]/0 px-2 py-1 text-[#C0451B]">
              <span className="font-mono-ui text-[10px] font-bold tracking-[0.2em]">SCALED ✓</span>
            </div>

            <div className="text-center">
              <div className="font-mono-ui text-[11px] tracking-[0.25em] text-[#1B1A17]/60">✱ PRODUCTION TICKET ✱</div>
              <div className="font-mono-ui mt-1 text-[11px] tracking-[0.12em] text-[#1B1A17]/80">
                MEXICAN RICE — {covers.toLocaleString()} COVERS
              </div>
            </div>

            <div className={`my-4 border-t border-dashed ${hair}`} />

            <input
              type="range" min={50} max={2000} step={10} value={covers}
              onChange={(e) => setCovers(Number(e.target.value))}
              className="w-full accent-[#C0451B]"
              aria-label="cover count"
            />

            <div className="mt-4 space-y-2.5 font-mono-ui">
              {DEMO_ING.map((ing) => {
                const chef = ing.base * mult * ing.damp;
                const pctLess = Math.round((1 - ing.damp) * 100);
                return (
                  <div key={ing.name} className="grid grid-cols-[4.5rem_1fr_3.6rem] items-center gap-2 text-[11px]">
                    <span className="tracking-wide text-[#1B1A17]/80">{ing.name}</span>
                    <span className="relative h-2 overflow-hidden bg-[#1B1A17]/10">
                      <span
                        className="bar-anim absolute inset-y-0 left-0"
                        style={{ width: `${ing.damp * 100}%`, background: ing.damp === 1 ? GREEN : RUST }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-[#1B1A17]/70">
                      {pctLess > 0 ? `−${pctLess}%` : "full"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={`my-4 border-t border-dashed ${hair}`} />
            <p className="font-mono-ui text-center text-[11px] leading-relaxed text-[#1B1A17]/70">
              calculator wants <span className="text-[#C0451B]">{fmt(garlicLinear, "oz")}</span> garlic ·
              chef uses <span className="text-[#3F6B4E]">{fmt(garlicChef, "oz")}</span>
            </p>
          </div>
          <div className="perf border-x border-[#1B1A17]/20" />
        </div>

        <p className="mt-8 text-center font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[#1B1A17]/45">
          ↑ drag the dial — watch the seasoning hold back
        </p>
      </section>

      {/* marquee */}
      <div className="border-y border-[#F3EEE3]/10 bg-[#16130E] py-3 overflow-hidden">
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex shrink-0 items-center">
              {DISHES.map((d) => (
                <span key={d + rep} className="flex items-center font-display text-lg italic text-[#F3EEE3]/40">
                  {d}<span className="mx-5 text-[#C0451B]">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ===== 02 PROBLEM (cream) ===== */}
      <section className="bg-[#F3EEE3] px-5 py-20 text-[#1B1A17]">
        <div className="mx-auto max-w-5xl">
          <p className="reveal font-mono-ui text-[11px] uppercase tracking-[0.3em] text-[#1B1A17]/45">
            02 — The calculator&apos;s mistake
          </p>
          <h2 className="reveal font-display mt-4 max-w-2xl text-4xl font-medium leading-tight sm:text-5xl">
            Sixteen times the garlic is <span className="italic text-[#C0451B]">not</span> sixteen times the dish.
          </h2>
          <div className="reveal mt-10 grid gap-px border border-[#1B1A17]/15 bg-[#1B1A17]/10 sm:grid-cols-2">
            <div className="bg-[#F3EEE3] p-7">
              <div className="font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[#9C3B2E]">The calculator</div>
              <p className="mt-3 font-display text-2xl">Multiplies everything by 16.</p>
              <ul className="mt-5 space-y-2 font-mono-ui text-[12px] text-[#1B1A17]/70">
                <li>× 16× the garlic — a garlic bomb</li>
                <li>× 16× the salt — inedible</li>
                <li>× one giant pan — steams, never browns</li>
                <li>× rice turns to glue on the line</li>
              </ul>
            </div>
            <div className="bg-[#F3EEE3] p-7">
              <div className="font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[#3F6B4E]">The chef</div>
              <p className="mt-3 font-display text-2xl">Knows what to hold back.</p>
              <ul className="mt-5 space-y-2 font-mono-ui text-[12px] text-[#1B1A17]/70">
                <li>+ dampens garlic, spice &amp; salt</li>
                <li>+ works back from edible yield</li>
                <li>+ splits into batches automatically</li>
                <li>+ adjusts for the 2-hour hot line</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 03 HOW (dark) ===== */}
      <section id="how" className="bg-[#16130E] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="reveal font-mono-ui text-[11px] uppercase tracking-[0.3em] text-[#F3EEE3]/45">
            03 — How it works
          </p>
          <div className="mt-8">
            {[
              { n: "01", t: "Drop in a recipe", d: "Paste it, snap a photo of the card, or pick a saved one — then set tonight's cover count." },
              { n: "02", t: "The chef-brain thinks", d: "Scales by ingredient role: dampening seasoning, batching the line, holding for service, flagging allergens." },
              { n: "03", t: "Production sheet out", d: "Scaled recipe, batching, hot-line holding, and a costed pull list. Print it or export to CSV." },
            ].map((s) => (
              <div key={s.n} className="reveal grid gap-4 border-t border-[#F3EEE3]/15 py-7 sm:grid-cols-[6rem_1fr]">
                <div className="font-display text-5xl text-[#E0A21A]">{s.n}</div>
                <div>
                  <h3 className="font-display text-2xl font-medium">{s.t}</h3>
                  <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#F3EEE3]/65">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 04 CAPABILITIES (cream) ===== */}
      <section className="bg-[#F3EEE3] px-5 py-20 text-[#1B1A17]">
        <div className="mx-auto max-w-5xl">
          <p className="reveal font-mono-ui text-[11px] uppercase tracking-[0.3em] text-[#1B1A17]/45">
            04 — What it does
          </p>
          <h2 className="reveal font-display mt-4 text-4xl font-medium">One brain. Many lenses.</h2>
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
              <div key={t} className={`flex items-baseline gap-4 border-t border-[#1B1A17]/15 py-4 ${i % 2 === 1 ? "sm:border-l sm:pl-8" : "sm:pr-8"}`}>
                <span className="font-mono-ui text-[11px] text-[#C0451B]">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="font-display text-lg">{t}</div>
                  <div className="font-mono-ui text-[12px] text-[#1B1A17]/60">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CLOSING (dark) ===== */}
      <section className="relative isolate overflow-hidden bg-[#16130E] px-5 py-28 text-center">
        <span className="font-display pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-[30vw] leading-none text-[#F3EEE3]/[0.04]" aria-hidden>
          ✦
        </span>
        <div className="relative mx-auto max-w-3xl">
          <h2 className="font-display text-5xl font-medium sm:text-6xl">Built for the line.</h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-[#F3EEE3]/70">
            Try it on a real dining-hall recipe right now — no sign-up, no setup.
          </p>
          <a href="/app" className="mt-9 inline-block bg-[#C0451B] px-9 py-4 text-sm font-medium text-[#F3EEE3] transition hover:bg-[#E0A21A] hover:text-[#16130E]">
            Open the scaler →
          </a>
        </div>
      </section>

      <footer className="border-t border-[#F3EEE3]/10 bg-[#16130E] px-5 py-8 text-center font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[#F3EEE3]/40">
        Digital Chef AI — production intelligence for high-volume kitchens
      </footer>
    </div>
  );
}
