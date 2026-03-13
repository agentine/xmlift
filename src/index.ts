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
