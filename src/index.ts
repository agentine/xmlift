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
