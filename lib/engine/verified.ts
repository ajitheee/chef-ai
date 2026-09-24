/**
 * The kitchen's own measured yields. Wherever a product matches, they outrank
 * the standard tables (yield.ts) and the sheet says "verified" instead of
 * "standard — verify with a test batch". kind: trim = usable (EP) ÷
 * as-purchased (AP); cook = cooked ÷ raw.
 */
export type VerifiedYield = {
  product: string;
  kind: "trim" | "cook";
  /** Percent: 85 = 85 %. Cook-up ratios (dry rice → cooked) can exceed 100. */
  pct: number;
  source?: string;
  verifiedOn?: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The most specific verified yield of this kind whose product name appears in the item. */
export function findVerified(item: string, kind: VerifiedYield["kind"], list: VerifiedYield[] | undefined): VerifiedYield | null {
  if (!list || list.length === 0) return null;
  let best: VerifiedYield | null = null;
  for (const v of list) {
    const product = v.product.trim();
    if (v.kind !== kind || !(v.pct > 0) || !product) continue;
    if (!new RegExp(`\\b${escapeRe(product)}\\b`, "i").test(item)) continue;
    if (!best || product.length > best.product.trim().length) best = v;
  }
  return best;
}

/** "pork shoulder — verified, test batch 9/20/2026" */
export const verifiedLabel = (v: VerifiedYield) =>
  `${v.product.trim()} — verified${v.source ? `, ${v.source}` : ""}${v.verifiedOn ? ` ${v.verifiedOn}` : ""}`;

/** The block sent to the engine, ahead of the standard tables. Empty when there are none. */
export function verifiedYieldsText(list: VerifiedYield[] | undefined): string {
  const lines = (list ?? [])
    .filter((v) => v.product.trim() && v.pct > 0)
    .map(
      (v) =>
        `- ${v.product.trim()}: ${v.kind === "trim" ? "trim (EP ÷ AP)" : "cook (cooked ÷ raw)"} yield ${v.pct}%` +
        `${v.source ? ` — ${v.source}` : ""}${v.verifiedOn ? `, ${v.verifiedOn}` : ""}`
    );
  if (lines.length === 0) return "";
  return [
    `VERIFIED YIELDS — this kitchen's own measured numbers. They OUTRANK the standard tables below: use them wherever the product matches, and say 'verified' where you did:`,
    ...lines,
  ].join("\n");
}
