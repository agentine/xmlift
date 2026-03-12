/**
 * BOM (Byte Order Mark) detection and stripping.
 */

// UTF-8 BOM: EF BB BF (U+FEFF)
// UTF-16 LE BOM: FF FE (U+FFFE when read as UTF-8, but appears as U+FEFF in string)
// UTF-16 BE BOM: FE FF (U+FEFF)
// In JavaScript strings (already decoded), all BOMs appear as U+FEFF.

/**
 * Strip BOM from the beginning of a string if present.
 * Handles UTF-8, UTF-16 LE, and UTF-16 BE BOMs.
 * Returns string unchanged if no BOM present.
 */
export function stripBOM(input: string): string {
  if (input.length > 0 && input.charCodeAt(0) === 0xfeff) {
    return input.slice(1);
  }
  return input;
}
