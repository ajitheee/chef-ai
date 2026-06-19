"use client";

import { useEffect, useState } from "react";

/* ---------- interactive demo data (mirrors the engine's dampening) ---------- */
const DEMO_ING = [
  { name: "Jasmine rice", emoji: "🍚", base: 12.5, unit: "cups", damp: 1.0, label: "structural" },
  { name: "Onion", emoji: "🧅", base: 1.5, unit: "cups", damp: 0.94, label: "flavor base" },
  { name: "Garlic", emoji: "🧄", base: 1, unit: "oz", damp: 0.75, label: "flavor base" },
  { name: "Cumin", emoji: "🥄", base: 1, unit: "Tbsp", damp: 0.75, label: "high impact" },
  { name: "Jalapeño", emoji: "🌶️", base: 2, unit: "oz", damp: 0.62, label: "high impact" },
];

function fmt(v: number, unit: string): string {
  const r = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
  if (unit === "oz" && v >= 16) return `${r(v / 16)} lb`;
  if (unit === "Tbsp" && v >= 16) return `${r(v / 16)} cups`;
  return `${r(v)} ${unit}`;
}

const FLOATERS = [
  { e: "🧄", top: "12%", left: "8%", a: "animate-floaty", d: "0s" },
  { e: "🌶️", top: "22%", left: "86%", a: "animate-drift", d: "0.6s" },
  { e: "🧅", top: "62%", left: "12%", a: "animate-drift", d: "1.2s" },
  { e: "🍅", top: "72%", left: "82%", a: "animate-floaty", d: "0.3s" },
  { e: "🧂", top: "40%", left: "92%", a: "animate-floaty", d: "0.9s" },
  { e: "🌿", top: "82%", left: "46%", a: "animate-drift", d: "1.5s" },
  { e: "🫑", top: "16%", left: "60%", a: "animate-floaty", d: "1.1s" },
  { e: "🍚", top: "50%", left: "4%", a: "animate-drift", d: "0.2s" },
];

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

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <span className="text-base font-bold text-white drop-shadow">🍳 Digital Chef AI</span>
          <a
            href="/app"
            className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-violet-700 shadow-lg transition hover:bg-white"
          >
            Try the demo →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative isolate overflow-hidden bg-gradient-to-br from-violet-700 via-blue-600 to-emerald-500 animate-gradient">
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className={`pointer-events-none absolute select-none text-4xl opacity-30 ${f.a}`}
            style={{ top: f.top, left: f.left, animationDelay: f.d }}
            aria-hidden
          >
            {f.e}
          </span>
        ))}

        <div className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:pt-36">
          <div className="animate-fadeup">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/30">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Built on chef-level culinary logic — v4.0
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-white sm:text-6xl">
              Scale recipes like a chef.
              <br />
              <span className="bg-gradient-to-r from-amber-200 to-emerald-200 bg-clip-text text-transparent">
                Not a calculator.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/90">
              Digital Chef AI scales your standardized recipes to any cover count — dampening the
              seasoning, batching the line, and holding it right. The intelligence your recipe
              system doesn&apos;t have.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/app"
                className="animate-glow rounded-full bg-white px-6 py-3 text-sm font-bold text-violet-700 shadow-xl transition hover:scale-[1.03]"
              >
                Try the live demo →
              </a>
              <a
                href="#how"
                className="rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10"
              >
                See how it works ↓
              </a>
            </div>
          </div>

          {/* INTERACTIVE DEMO */}
          <div className="reveal mt-14 rounded-3xl border border-white/20 bg-white/95 p-5 shadow-2xl sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Mexican Rice — live scale</h2>
                <p className="text-sm text-slate-500">
                  Drag the dial. Watch the rice scale full while the garlic & spice hold back.
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-violet-700">{covers.toLocaleString()}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">covers</div>
              </div>
            </div>

            <input
              type="range"
              min={50}
              max={2000}
              step={10}
              value={covers}
              onChange={(e) => setCovers(Number(e.target.value))}
              className="mt-4 w-full accent-violet-600"
            />

            <div className="mt-4 space-y-3">
              {DEMO_ING.map((ing) => {
                const chef = ing.base * mult * ing.damp;
                const pctLess = Math.round((1 - ing.damp) * 100);
                return (
                  <div key={ing.name} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-sm">
                      <span className="mr-1">{ing.emoji}</span>
                      <span className="font-medium text-slate-700">{ing.name}</span>
                    </div>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                      {/* ghost linear bar */}
                      <div className="absolute inset-y-0 left-0 w-full rounded-lg bg-rose-100" />
                      {/* chef bar */}
                      <div
                        className={`bar-anim absolute inset-y-0 left-0 rounded-lg ${
                          ing.damp === 1 ? "bg-emerald-500" : "bg-violet-500"
                        }`}
                        style={{ width: `${ing.damp * 100}%` }}
                      />
                      <span className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-slate-700">
                        {fmt(chef, ing.unit)}
                      </span>
                    </div>
                    <div className="w-24 shrink-0 text-right text-xs text-slate-400">
                      {pctLess > 0 ? `−${pctLess}% vs linear` : "scales full"}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
              At <b>{covers.toLocaleString()}</b> covers a calculator would dump{" "}
              <b>{fmt(garlicLinear, "oz")}</b> of garlic. Chef AI uses <b>{fmt(garlicChef, "oz")}</b>{" "}
              — so it&apos;s still edible, not a garlic bomb.
            </p>
          </div>
        </div>

        <svg className="block w-full" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path d="M0,40 C360,90 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f4f6fa" />
        </svg>
      </header>

      {/* PROBLEM */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="reveal grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <div className="text-sm font-bold uppercase tracking-wide text-rose-500">A calculator</div>
            <p className="mt-2 text-2xl font-bold text-slate-900">Multiplies everything by 16.</p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
              <li>❌ 16× the garlic → a garlic bomb</li>
              <li>❌ 16× the salt → inedible</li>
              <li>❌ one giant pan → steams, never browns</li>
              <li>❌ rice turns to glue on the line</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="text-sm font-bold uppercase tracking-wide text-emerald-600">A chef</div>
            <p className="mt-2 text-2xl font-bold text-slate-900">Knows what to hold back.</p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
              <li>✅ dampens garlic, spice & salt</li>
              <li>✅ works back from edible yield</li>
              <li>✅ splits into batches automatically</li>
              <li>✅ adjusts for the 2-hour hot line</li>
            </ul>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="reveal text-center text-3xl font-extrabold text-slate-900">How it works</h2>
        <div className="reveal mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { n: "1", t: "Drop in a recipe", d: "Paste it, snap a photo of the card, or pick a saved one. Set tonight's cover count.", e: "📝" },
            { n: "2", t: "The chef-brain thinks", d: "Scales by ingredient role — dampening seasoning, batching the line, holding for service.", e: "🧠" },
            { n: "3", t: "Production sheet out", d: "Scaled recipe, batching, holding, allergen flags, and a costed pull list. Print or export.", e: "📋" },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="text-4xl">{s.e}</div>
              <div className="mt-3 text-xs font-bold uppercase tracking-wide text-violet-500">Step {s.n}</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{s.t}</div>
              <p className="mt-2 text-sm text-slate-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="reveal text-center text-3xl font-extrabold text-slate-900">
          One brain. Many lenses.
        </h2>
        <p className="reveal mx-auto mt-3 max-w-xl text-center text-slate-500">
          Every feature is a view of the same recipe — no extra tool to learn.
        </p>
        <div className="reveal mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { e: "⚖️", t: "Non-linear scaling", d: "Dampens seasoning by ingredient role." },
            { e: "🍳", t: "Batching", d: "Splits volume across real vessels." },
            { e: "🔥", t: "Hot-line holding", d: "Cook to 90%, reserve liquid, hold safely." },
            { e: "📋", t: "AP pull list", d: "Raw quantities to order from inventory." },
            { e: "💡", t: "Variations", d: "2–3 versions to pick from, then scale." },
            { e: "⚠️", t: "Allergen flags", d: "Big-9 surfaced on every sheet." },
            { e: "📷", t: "Photo input", d: "Snap a recipe card — it reads it." },
            { e: "🖨️", t: "Print / CSV", d: "Clean sheets for the line, lists for ordering." },
          ].map((f) => (
            <div key={f.t} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg">
              <div className="text-3xl transition group-hover:scale-110">{f.e}</div>
              <div className="mt-3 font-bold text-slate-900">{f.t}</div>
              <p className="mt-1 text-sm text-slate-500">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-16">
        <div className="reveal animate-gradient mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-violet-700 via-blue-600 to-emerald-500 p-10 text-center shadow-2xl">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Ready to scale smarter?</h2>
          <p className="mx-auto mt-3 max-w-lg text-white/90">
            Try it on a real dining-hall recipe right now — no sign-up, no setup.
          </p>
          <a
            href="/app"
            className="mt-7 inline-block rounded-full bg-white px-8 py-3.5 text-sm font-bold text-violet-700 shadow-xl transition hover:scale-[1.03]"
          >
            Open the scaler →
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-400">
        🍳 Digital Chef AI — production intelligence for high-volume kitchens.
      </footer>
    </div>
  );
}
