/**
 * Built-in processor functions for transforming tag names, attribute
 * names, attribute values, and text values during parsing.
 */

/** Lowercase the entire string. */
export function normalize(str: string): string {
  return str.toLowerCase();
}

/** Lowercase only the first character. */
export function firstCharLowerCase(str: string): string {
  if (str.length === 0) return str;
  return str[0].toLowerCase() + str.slice(1);
}

/** Remove namespace prefix (everything up to and including the colon). */
export function stripPrefix(str: string): string {
  const idx = str.indexOf(":");
  return idx >= 0 ? str.slice(idx + 1) : str;
}

/** Convert numeric strings to numbers. Returns original string if not numeric. */
export function parseNumbers(str: string): string | number {
  if (/^\s*$/.test(str)) return str;
  const n = Number(str);
  return isNaN(n) ? str : n;
}

/** Convert "true"/"false" strings to booleans. Returns original string otherwise. */
export function parseBooleans(str: string): string | boolean {
  const lower = str.toLowerCase().trim();
  if (lower === "true") return true;
  if (lower === "false") return false;
  return str;
}
