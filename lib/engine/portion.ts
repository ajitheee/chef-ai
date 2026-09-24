import type { ProductionSheet } from "./schema";
import { COOK_YIELDS, lookupYield, toGrams } from "./yield";
import { PROTEIN_COOK, parseQuantity, knownPairs } from "./validate";
import { findVerified, verifiedLabel, type VerifiedYield } from "./verified";

/**
 * The finished-yield numbers, computed in code so the same card gives the same
 * sheet every time.
 *
 * The model reasons well about ingredients but its arithmetic on the stated
 * per-serving weight of a COUNT portion ("2 tacos", "1 bowl") wobbled run to
 * run (4.0 vs 4.9 oz on the same card). Here the derivation the application
 * contract prescribes is done deterministically — card raw protein weight ×
 * standard cook yield ÷ base portions — and (1) sent to the model as the
 * approved figure and (2) written onto the sheet after the model answers.
 * Weight and volume portions are simpler: covers × portion.
 */
export type PortionDerivation = {
  kind: "weight" | "volume" | "count";
  /** Canonical portion text (for count portions: with the derived cooked weight appended). */
  portionSize: string;
  /** Canonical finished yield — exactly one quantity, so the referee reads it cleanly. */
  finishedYield: string;
  /** The derivation, for the sheet's assumptions (count portions only). */
  assumption: string | null;
  /** The line sent to the model. */
  promptLine: string;
  /** Verified yields that shaped the figures, for the sheet's engine line. */
  verifiedUsed: string[];
};

const BUFFER = 1.04; // service buffer, applied to the order, not to the stated yield
const G_PER_OZ = 28.3495;

const fmtLb = (lb: number) => (lb >= 20 ? String(Math.round(lb)) : String(Math.round(lb * 10) / 10));
const fmtOz1 = (oz: number) => String(Math.round(oz * 10) / 10);
function fmtVol(floz: number): string {
  if (floz >= 128) return `${fmtLb(floz / 128)} gal`;
  if (floz >= 32) return `${fmtLb(floz / 32)} qt`;
  return `${Math.round(floz)} fl oz`;
}

/** The word a cook uses for the protein on the plate. */
function proteinWord(label: string, item: string): string {
  const it = item.toLowerCase();
  if (label.startsWith("pork")) return "pork";
  if (label.startsWith("beef")) return "beef";
  if (label.startsWith("poultry")) return /turkey/.test(it) ? "turkey" : /duck/.test(it) ? "duck" : "chicken";
  if (label.startsWith("ground")) {
    if (/sausage|chorizo/.test(it)) return "sausage";
    if (/meatball/.test(it)) return "meatballs";
    const m = it.match(/\b(beef|pork|turkey|chicken|lamb)\b/);
    return m ? `ground ${m[1]}` : "meat";
  }
  if (label === "shrimp") return "shrimp";
  if (label === "fish fillet") return "fish";
  return "protein";
}

export type PortionInput = {
  /** The card's ingredient lines: name + the quantity as written ("2.5 lb", "6", "1 #10 can"). */
  ingredients: { name: string; qty: string }[];
  basePortions: number;
  targetCovers: number;
  portionSize: string;
  /** The kitchen's verified yields, which outrank the standard tables. */
  verified?: VerifiedYield[];
};

/** Derive the canonical portion + finished-yield figures for this job, or null when the card doesn't allow it. */
export function derivePortion(input: PortionInput): PortionDerivation | null {
  const covers = input.targetCovers;
  const base = input.basePortions;
  const portion = (input.portionSize || "").trim();
  if (!(covers > 0) || !(base > 0) || !portion) return null;
  // A multi-component portion ("5 oz pork + 1/2 cup beans") has no single finished number — leave it to the chef.
  if (knownPairs(portion) >= 2) return null;

  const q = parseQuantity(portion);
  if (q && q.family === "weight") {
    const needLb = (covers * q.n * q.base) / 16;
    return {
      kind: "weight",
      verifiedUsed: [],
      portionSize: portion,
      finishedYield: `≈${fmtLb(needLb)} lb finished for ${covers} covers · plus 4% service buffer on the order`,
      assumption: null,
      promptLine: `FINISHED YIELD — computed from the approved portion; use it exactly: ${covers} covers × ${portion} ≈ ${fmtLb(needLb)} lb finished. Put the 4% service buffer on the order (pull list), not on the stated yield.`,
    };
  }
  if (q && q.family === "volume") {
    const needFlOz = covers * q.n * q.base;
    return {
      kind: "volume",
      verifiedUsed: [],
      portionSize: portion,
      finishedYield: `≈${fmtVol(needFlOz)} finished for ${covers} covers · plus 4% service buffer on the order`,
      assumption: null,
      promptLine: `FINISHED YIELD — computed from the approved portion; use it exactly: ${covers} covers × ${portion} ≈ ${fmtVol(needFlOz)} finished. Put the 4% service buffer on the order (pull list), not on the stated yield.`,
    };
  }

  // Count portion: anchor on the biggest raw protein on the card.
  let best: { item: string; qty: string; grams: number; label: string; y: number; verified: boolean } | null = null;
  for (const ing of input.ingredients) {
    const hit = PROTEIN_COOK.find(([re]) => re.test(ing.name));
    if (!hit) continue;
    const g = toGrams(ing.name, ing.qty);
    if (!g) continue;
    // Already-cooked product on the card: no cook loss to apply.
    const precooked = /\b(pre-?cooked|cooked|rotisserie|smoked|deli)\b/i.test(ing.name);
    const vCook = precooked ? null : findVerified(ing.name, "cook", input.verified);
    const y = precooked ? 1 : vCook ? vCook.pct / 100 : COOK_YIELDS.find((c) => c.label === hit[1])?.yield;
    if (!y) continue;
    const label = vCook ? verifiedLabel(vCook) : hit[1];
    if (!best || g.grams > best.grams) best = { item: ing.name, qty: ing.qty, grams: g.grams, label, y, verified: !!vCook };
  }
  if (!best) return null;

  const rawBaseOz = best.grams / G_PER_OZ;
  const perOz = (rawBaseOz * best.y) / base;
  if (!(perOz > 0.25)) return null; // a garnish-sized protein is not the plate
  const needLb = (covers * perOz) / 16;
  const rawNeedLb = (needLb * BUFFER) / best.y;
  const vTrim = findVerified(best.item, "trim", input.verified);
  const trim = vTrim ? { yield: vTrim.pct / 100, label: verifiedLabel(vTrim) } : lookupYield(best.item);
  const apLb = trim && trim.yield < 1 ? rawNeedLb / trim.yield : null;
  const word = proteinWord(best.label, best.item);
  const pct = Math.round(best.y * 100);
  const bare = portion.replace(/\s*\(≈[^)]*\)\s*$/, "");
  const portionSize = `${bare} (≈${fmtOz1(perOz)} oz cooked ${word})`;
  const rawText = rawBaseOz >= 16 ? `${fmtLb(rawBaseOz / 16)} lb` : `${fmtOz1(rawBaseOz)} oz`;

  return {
    kind: "count",
    portionSize,
    finishedYield: `≈${fmtLb(needLb)} lb cooked ${word} for ${covers} servings · plus 4% service buffer on the order`,
    assumption: `Per-serving weight derived from the card: ${rawText} raw ${best.item.toLowerCase()} × ${pct}% cook yield (${best.label}${best.verified ? "" : ", standard"}) ÷ ${base} base portions = ${fmtOz1(perOz)} oz cooked per serving.${best.verified ? "" : " Standard yield — verify with a test batch."}`,
    verifiedUsed: [...(best.verified ? [best.label] : []), ...(vTrim ? [verifiedLabel(vTrim)] : [])],
    promptLine:
      `PORTION WEIGHT — computed from the card; use these numbers exactly: ${portionSize}. ` +
      `Finished yield needed ≈ ${fmtLb(needLb)} lb cooked ${word} for ${covers} covers. ` +
      `Raw ${word} to cook ≈ ${fmtLb(rawNeedLb)} lb (includes the 4% service buffer; ${pct}% cook yield)` +
      (apLb && trim ? `; order ≈ ${fmtLb(apLb)} lb as-purchased at ${Math.round(trim.yield * 100)}% trim yield${vTrim ? " (verified)" : ""}` : "") +
      `. Scale the other ingredients to the same ${covers}/${base} basis.`,
  };
}

/** Write the canonical figures onto a sheet (after the engine, or the built-in scaler, has produced it). */
export function applyPortion<T extends ProductionSheet>(sheet: T, d: PortionDerivation | null): T {
  if (!d) return sheet;
  sheet.targetYield.portionSize = d.portionSize;
  sheet.targetYield.finishedYield = d.finishedYield;
  if (d.assumption && !sheet.assumptions.some((a) => a.startsWith("Per-serving weight derived"))) {
    sheet.assumptions = [d.assumption, ...sheet.assumptions];
  }
  return sheet;
}
