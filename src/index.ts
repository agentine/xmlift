// xmlift — public API exports

export {
  SaxParser,
  type SaxTag,
  type SaxProcessingInstruction,
  type SaxParserOptions,
} from "./sax/parser.js";

export {
  Tokenizer,
  TokenType,
  type Token,
  type Position,
  type TokenizerOptions,
} from "./sax/tokenizer.js";

export {
  expandEntities,
  resolveEntity,
  type EntityOptions,
} from "./sax/entities.js";

export { stripBOM } from "./sax/bom.js";

export {
  NamespaceContext,
  getElementNS,
  getAttrNS,
  type ResolvedName,
} from "./sax/namespaces.js";

// Phase 2 — xml2js-compatible Parser
export { Parser } from "./parser/parser.js";
export { ValidationError } from "./parser/errors.js";
export {
  DEFAULTS_0_2,
  DEFAULTS_0_1,
  type ParserOptions,
  type Processor,
  type Validator,
} from "./parser/options.js";
import {
  normalize,
  firstCharLowerCase,
  stripPrefix,
  parseNumbers,
  parseBooleans,
} from "./parser/processors.js";
export { normalize, firstCharLowerCase, stripPrefix, parseNumbers, parseBooleans };

import { Parser } from "./parser/parser.js";
import { DEFAULTS_0_1, DEFAULTS_0_2 } from "./parser/options.js";
import type { ParserOptions } from "./parser/options.js";

// -----------------------------------------------------------------------
// Top-level convenience functions (xml2js-compatible)
// -----------------------------------------------------------------------

type ParseCallback = (err: Error | null, result?: unknown) => void;

/**
 * Parse an XML string with optional options.
 * Supports both `parseString(str, cb)` and `parseString(str, opts, cb)`.
 */
export function parseString(
  str: string,
  callback: ParseCallback,
): void;
export function parseString(
  str: string,
  options: ParserOptions,
  callback: ParseCallback,
): void;
export function parseString(
  str: string,
  optionsOrCallback: ParserOptions | ParseCallback,
  maybeCallback?: ParseCallback,
): void {
  let options: ParserOptions | undefined;
  let callback: ParseCallback;
  if (typeof optionsOrCallback === "function") {
    callback = optionsOrCallback;
  } else {
    options = optionsOrCallback;
    callback = maybeCallback!;
  }
  const parser = new Parser(options);
  parser.parseString(str, callback);
}

/**
 * Parse an XML string, returning a Promise.
 */
export function parseStringPromise(
  str: string,
  options?: ParserOptions,
): Promise<unknown> {
  const parser = new Parser(options);
  return parser.parseStringPromise(str);
}

/** Built-in processors object (xml2js-compatible). */
export const processors = {
  normalize,
  firstCharLowerCase,
  stripPrefix,
  parseNumbers,
  parseBooleans,
};

/** Default option sets (xml2js-compatible). */
export const defaults = {
  "0.1": DEFAULTS_0_1,
  "0.2": DEFAULTS_0_2,
};
