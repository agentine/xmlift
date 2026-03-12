/**
 * XML entity resolution — predefined entities, numeric/hex character references,
 * custom entities, and expansion security limits.
 * Pure functions, no side effects.
 */

const PREDEFINED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  quot: '"',
};

export interface EntityOptions {
  strict?: boolean;
  customEntities?: Record<string, string>;
  maxEntityExpansionDepth?: number;
  maxEntityExpansions?: number;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_EXPANSIONS = 10000;

/**
 * Resolve a single entity reference (without the & and ;).
 * Examples: "amp" -> "&", "#123" -> "{", "#x7B" -> "{"
 */
export function resolveEntity(
  ref: string,
  options?: EntityOptions
): string {
  // Numeric decimal reference: #NNN
  if (ref.startsWith("#x") || ref.startsWith("#X")) {
    const hex = ref.slice(2);
    const code = parseInt(hex, 16);
    if (isNaN(code) || hex.length === 0) {
      if (options?.strict !== false) {
        throw new Error(`Invalid hex character reference: &#${ref};`);
      }
      return `&${ref};`;
    }
    return String.fromCodePoint(code);
  }

  if (ref.startsWith("#")) {
    const dec = ref.slice(1);
    const code = parseInt(dec, 10);
    if (isNaN(code) || dec.length === 0) {
      if (options?.strict !== false) {
        throw new Error(`Invalid numeric character reference: &#${ref};`);
      }
      return `&${ref};`;
    }
    return String.fromCodePoint(code);
  }

  // Predefined XML entities
  if (ref in PREDEFINED) {
    return PREDEFINED[ref];
  }

  // Custom entities
  if (options?.customEntities && ref in options.customEntities) {
    return options.customEntities[ref];
  }

  // Unknown entity
  if (options?.strict !== false) {
    throw new Error(`Unknown entity: &${ref};`);
  }
  return `&${ref};`;
}

/**
 * Expand all entity and character references in a text segment.
 * Enforces security limits on expansion depth and count.
 */
export function expandEntities(
  text: string,
  options?: EntityOptions
): string {
  const maxDepth = options?.maxEntityExpansionDepth ?? DEFAULT_MAX_DEPTH;
  const maxExpansions = options?.maxEntityExpansions ?? DEFAULT_MAX_EXPANSIONS;
  let totalExpansions = 0;

  function expand(input: string, depth: number): string {
    if (depth > maxDepth) {
      throw new Error(
        `Entity expansion depth limit exceeded (max ${maxDepth})`
      );
    }

    let result = "";
    let i = 0;

    while (i < input.length) {
      const ampIdx = input.indexOf("&", i);
      if (ampIdx === -1) {
        result += input.slice(i);
        break;
      }

      result += input.slice(i, ampIdx);

      const semiIdx = input.indexOf(";", ampIdx + 1);
      if (semiIdx === -1) {
        // No closing semicolon
        if (options?.strict !== false) {
          throw new Error(`Unterminated entity reference at position ${ampIdx}`);
        }
        result += input.slice(ampIdx);
        break;
      }

      const ref = input.slice(ampIdx + 1, semiIdx);
      totalExpansions++;

      if (totalExpansions > maxExpansions) {
        throw new Error(
          `Entity expansion count limit exceeded (max ${maxExpansions})`
        );
      }

      const resolved = resolveEntity(ref, options);

      // If the resolved value contains entity references, expand recursively
      if (resolved.includes("&") && resolved !== `&${ref};`) {
        result += expand(resolved, depth + 1);
      } else {
        result += resolved;
      }

      i = semiIdx + 1;
    }

    return result;
  }

  return expand(text, 0);
}
