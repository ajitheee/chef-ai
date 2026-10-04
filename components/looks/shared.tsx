"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { demoScale } from "@/lib/engine/demo";
import { validateSheet, checksHeadline } from "@/lib/engine/validate";

/**
 * Three directions for the first screen and the sheet, built as real screens
 * on the chef's own Mexican Rice so he judges the product, not a mockup. Every
 * look rescales in the browser with the built-in estimate, so the comparison
 * costs nothing and answers instantly. The winner becomes the app.
 */

import { LOOKS, type LookId } from "./looks";
export { LOOKS, type LookId };

export const PRESETS = [200, 400, 800, 1200];
export const clampCovers = (n: number) => Math.min(5000, Math.max(10, Math.round(n)));

export function useDemoSheet(initial = 800) {
  const [covers, setCovers] = useState(initial);
  const sheet = useMemo(() => demoScale(covers), [covers]);
  const checks = useMemo(() => validateSheet(sheet), [sheet]);
  const head = checksHeadline(checks);
  return { covers, setCovers, sheet, checks, head };
}

/** The number in a multiplier like "x15 (dampened)"; null for "staged", "by surface area". */
export function multOf(s: string): number | null {
  const m = s.match(/x\s*([\d.]+)/i);
  return m ? Number(m[1]) : null;
}

/** A short role name from the engine's role or note text. */
export function roleOf(role: string, note = ""): string {
  const s = `${role} ${note}`.toLowerCase();
  if (/struct/.test(s)) return "structural";
  if (/base|aromatic/.test(s)) return "flavor base";
  if (/high|impact|spice|heat/.test(s)) return "high impact";
  if (/season|salt/.test(s)) return "seasoning";
  if (/finish|garnish|fold/.test(s)) return "finishing";
  if (/stock|liquid|water/.test(s)) return "liquid";
  if (/oil|fat/.test(s)) return "fat";
  return role || "ingredient";
}

/** The count in a line like "for 600" or "600 covers"; null when there is none. */
export function coversIn(text: string): number | null {
  const m = text.replace(/(\d),(\d{3})/g, "$1$2").match(/(\d{2,5})(?!\s*(oz|lb|g|kg|cup|tbsp|tsp|%))/i);
  return m ? Number(m[1]) : null;
}

/** Flip between the three looks from any of them. */
export function LookSwitch({ current }: { current: LookId }) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-[#111]/90 p-1 text-xs font-semibold text-white shadow-lg backdrop-blur print:hidden">
      {LOOKS.map((l) => (
        <Link key={l.id} href={`/app/looks/${l.id}`} className={`rounded-md px-3 py-1.5 ${l.id === current ? "bg-white text-black" : "text-white/80 hover:text-white"}`}>
          {l.name}
        </Link>
      ))}
      <Link href="/app/looks" className="rounded-md px-3 py-1.5 text-white/60 hover:text-white">
        All
      </Link>
    </div>
  );
}

/* Small inline icons: no icon font, no emoji. */
export const Icon = {
  check: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-4 w-4"} aria-hidden>
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  ),
  chevron: (p: { className?: string; open?: boolean }) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${p.className ?? "h-4 w-4"} transition-transform ${p.open ? "rotate-90" : ""}`} aria-hidden>
      <path d="M7 4l6 6-6 6" />
    </svg>
  ),
  send: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-5 w-5"} aria-hidden>
      <path d="M3 10h13M11 5l5 5-5 5" />
    </svg>
  ),
  minus: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={p.className ?? "h-6 w-6"} aria-hidden>
      <path d="M4 10h12" />
    </svg>
  ),
  plus: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={p.className ?? "h-6 w-6"} aria-hidden>
      <path d="M10 4v12M4 10h12" />
    </svg>
  ),
  home: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-5 w-5"} aria-hidden>
      <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
    </svg>
  ),
  chat: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-5 w-5"} aria-hidden>
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  ),
  book: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-5 w-5"} aria-hidden>
      <path d="M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-7a2 2 0 00-2 2v14a2 2 0 012-2h7z" />
    </svg>
  ),
  calendar: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-5 w-5"} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  print: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-5 w-5"} aria-hidden>
      <path d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v7H6z" />
    </svg>
  ),
};
