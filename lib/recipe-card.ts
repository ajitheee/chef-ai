/**
 * Recipe cards inside a Kitchen Brain answer. The conversation contract makes
 * the model write a card between "RECIPE CARD" and "END CARD" with a fixed
 * header; this reads it back so the page can offer "Open in scaler".
 */

export type RecipeCard = {
  name: string;
  basePortions?: number;
  portionSize?: string;
  equipment?: string;
  holdingTime?: string;
  /** The card as the scaler's parser expects it: the name on the first line, then the ingredient and method lines. */
  recipeText: string;
};

export type Segment = { kind: "text"; text: string } | { kind: "card"; card: RecipeCard; raw: string };

const CARD = /RECIPE CARD[ \t]*\n([\s\S]*?)\nEND CARD/g;
const META = /^(Name|Base portions|Portion size|Equipment|Hold time)\s*:\s*(.*)$/i;

/** Read one card body (the lines between the markers). Null when there is no name. */
export function parseCard(body: string): RecipeCard | null {
  const lines = body.split("\n");
  const meta: Record<string, string> = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(META);
    if (!m) break;
    meta[m[1].toLowerCase()] = m[2].trim();
  }
  const name = meta["name"];
  if (!name) return null;
  const rest = lines.slice(i).join("\n").trim();
  const base = Number(meta["base portions"]);
  return {
    name,
    basePortions: base > 0 ? base : undefined,
    portionSize: meta["portion size"] || undefined,
    equipment: meta["equipment"] || undefined,
    holdingTime: meta["hold time"] || undefined,
    recipeText: `${name}\n${rest}`,
  };
}

/** Split an answer into plain text and complete cards, in order. An unfinished card (still streaming) stays text. */
export function splitCards(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(CARD)) {
    const start = m.index ?? 0;
    const card = parseCard(m[1]);
    if (!card) continue;
    if (start > last) out.push({ kind: "text", text: text.slice(last, start) });
    out.push({ kind: "card", card, raw: m[0] });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
