/**
 * The front door: one line, "Mexican rice for 800". A library recipe and a
 * count scale straight away; several possible recipes become a choice; anything
 * else (a question, a card, a dish that is not in the library) goes to Kitchen
 * Brain, which builds the card and offers the scale. Pure, so it can be checked.
 */

export type Named = { name: string };

export type Ask<R extends Named> =
  | { kind: "scale"; recipe: R; covers: number }
  | { kind: "choose"; covers: number; matches: R[] }
  | { kind: "covers"; covers: number }
  | { kind: "brain"; text: string };

/** Words that carry no part of a recipe name. */
const FILLER = new Set([
  "for", "to", "at", "x", "of", "covers", "cover", "portions", "portion", "servings", "serving", "people", "pax", "guests",
  "scale", "please", "tonight", "today", "tomorrow", "need", "i", "we", "the", "a", "an", "some", "our", "my", "make", "do",
]);
/** A number followed by one of these is a quantity, not a count. */
const UNIT = /^(oz|lb|lbs|g|kg|cup|cups|tbsp|tsp|qt|qts|gal|ml|l|%|each|ea|hr|hrs|hour|hours|min|mins|minutes|f|c|degrees)$/i;
const MAX_CHOICES = 6;

export const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** The count, and the words that are left once the count and the small words are gone. */
export function parseAsk(text: string): { covers: number | null; words: string[] } {
  const raw = text.replace(/(\d),(\d{3})/g, "$1$2").split(/\s+/).filter(Boolean);
  let covers: number | null = null;
  const words: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i].toLowerCase().replace(/[^a-z0-9%]/g, "");
    if (!t) continue;
    const m = t.match(/^(\d+)([a-z%]*)$/);
    if (m) {
      const next = (raw[i + 1] ?? "").toLowerCase().replace(/[^a-z%]/g, "");
      if (m[2] && UNIT.test(m[2])) continue; // "4oz"
      if (!m[2] && UNIT.test(next)) {
        i++; // "4 oz": a quantity, skip the unit too
        continue;
      }
      if (m[2]) continue; // "800x" and the like: not a count
      const n = Number(m[1]);
      if (n > 0 && n <= 100000) covers = n; // the last count on the line wins
      continue;
    }
    if (!FILLER.has(t) && !UNIT.test(t)) words.push(t);
  }
  return { covers, words };
}

/** The library recipes the words name: an exact name wins; otherwise every word must be in the name. */
export function matchRecipes<R extends Named>(words: string[], recipes: R[]): R[] {
  if (words.length === 0) return [];
  const want = words.join(" ");
  const seen = new Set<string>();
  const unique = recipes.filter((r) => {
    const key = tokens(r.name).join(" ");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const exact = unique.filter((r) => tokens(r.name).join(" ") === want);
  if (exact.length > 0) return exact.slice(0, 1);
  return unique.filter((r) => {
    const have = new Set(tokens(r.name));
    return words.every((w) => have.has(w));
  });
}

export function routeAsk<R extends Named>(text: string, recipes: R[]): Ask<R> {
  const t = text.trim();
  if (!t || /\n/.test(t) || /\?/.test(t)) return { kind: "brain", text: t };
  const { covers, words } = parseAsk(t);
  if (covers === null) return { kind: "brain", text: t };
  if (words.length === 0) return { kind: "covers", covers };
  const matches = matchRecipes(words, recipes);
  if (matches.length === 1) return { kind: "scale", recipe: matches[0], covers };
  if (matches.length > 1) return { kind: "choose", covers, matches: matches.slice(0, MAX_CHOICES) };
  return { kind: "brain", text: t };
}
