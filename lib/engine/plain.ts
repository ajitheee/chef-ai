/**
 * Plain punctuation for everything a cook reads. The model is told not to use
 * em or en dashes; this is the safety net for what it writes anyway, and for
 * sheets saved before the rule existed. Ranges keep a hyphen (135-70F); a dash
 * between clauses becomes a comma; leading and trailing dashes are dropped.
 */
export function plainText(s: string): string {
  return s
    .replace(/(\d)\s*[–—―]\s*(\d)/g, "$1-$2")
    .replace(/^\s*[–—―]\s*/, "")
    .replace(/\s*[–—―]\s*$/, "")
    .replace(/\s*[–—―]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*,\s*/g, "(")
    .replace(/\s*,\s*\)/g, ")");
}

/** Apply plainText to every string in a sheet (or any nested value), except the dish name, which is the chef's own. */
export function plainSheet<T>(value: T): T {
  const walk = (v: unknown, key?: string): unknown => {
    if (typeof v === "string") return key === "dish" ? v : plainText(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = walk(x, k);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
