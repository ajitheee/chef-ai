/**
 * The blocks Kitchen Brain writes inside an answer, read back by the page.
 * The conversation contract fixes two exact formats: a RECIPE CARD between
 * "RECIPE CARD" and "END CARD" (so the page can offer Open in scaler and Save
 * to library), and a CHOICES block between "CHOICES" and "END CHOICES" (a
 * question or an approval gate, shown as buttons that send the reply).
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

/** A question or a gate the brain is waiting on, with the replies the chef can press. */
export type Choices = { question: string; options: string[] };

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "card"; card: RecipeCard; raw: string }
  | { kind: "choices"; choices: Choices; raw: string };

/** Buttons past this are not a focused question; the rest of the list is dropped. */
export const MAX_CHOICES = 4;

const CARD = /RECIPE CARD[ \t]*\n([\s\S]*?)\nEND CARD/g;
// Anchored to a line start so the word inside "END CHOICES" can never open a block.
const CHOICES = /^CHOICES[ \t]*\n([\s\S]*?)\nEND CHOICES[ \t]*$/gm;
const META = /^(Name|Base portions|Portion size|Equipment|Hold time)\s*:\s*(.*)$/i;
const OPTION = /^(?:[-*•]|\d+[.)])\s+(.*)$/;

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

/**
 * Read one choices body: a question line (with or without "Question:"), then
 * one option per line, listed with a hyphen or a number. Null without an option.
 */
export function parseChoices(body: string): Choices | null {
  const question: string[] = [];
  const options: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(OPTION);
    if (m) {
      const option = m[1].trim();
      if (option && !options.some((o) => o.toLowerCase() === option.toLowerCase())) options.push(option);
    } else if (options.length === 0) {
      question.push(line.replace(/^question\s*:\s*/i, ""));
    }
  }
  if (options.length === 0) return null;
  return { question: question.join(" ").trim(), options: options.slice(0, MAX_CHOICES) };
}

/**
 * Split an answer into text, complete cards and complete choices, in order.
 * An unfinished block (still streaming) stays text. Text segments lose the
 * blank lines that separate them from a block; a segment that was only blank
 * lines is dropped.
 */
export function splitBlocks(text: string): Segment[] {
  const found: { start: number; end: number; seg: Segment }[] = [];
  for (const m of text.matchAll(CARD)) {
    const card = parseCard(m[1]);
    const start = m.index ?? 0;
    if (card) found.push({ start, end: start + m[0].length, seg: { kind: "card", card, raw: m[0] } });
  }
  for (const m of text.matchAll(CHOICES)) {
    const choices = parseChoices(m[1]);
    const start = m.index ?? 0;
    if (choices) found.push({ start, end: start + m[0].length, seg: { kind: "choices", choices, raw: m[0] } });
  }
  found.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  const pushText = (s: string) => {
    const t = s.replace(/^\n+|\n+$/g, "");
    if (t.trim()) out.push({ kind: "text", text: t });
  };
  let last = 0;
  for (const f of found) {
    if (f.start < last) continue; // a block inside a block: the outer one was already taken
    if (f.start > last) pushText(text.slice(last, f.start));
    out.push(f.seg);
    last = f.end;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

/** While an answer streams, a CHOICES block that has begun but not ended is held back: it is buttons, not prose. */
export function hidePartialChoices(text: string): string {
  let cut = -1;
  for (const m of text.matchAll(/^CHOICES[ \t]*(?:\n|$)/gm)) cut = m.index ?? -1;
  if (cut < 0 || /^END CHOICES/m.test(text.slice(cut))) return text;
  return text.slice(0, cut).replace(/\s+$/, "");
}
