/**
 * Parser options — xml2js-compatible configuration.
 */

/** A processor function that transforms names or values. */
export type Processor = (value: string, name?: string) => string;

/** A validator function for custom validation. */
export type Validator = (
  xpath: string,
  currentValue: unknown,
  newValue: unknown,
) => unknown;

export interface ParserOptions {
  /** Key under which attributes are stored. Default: `"$"`. */
  attrkey?: string;
  /** Key under which character data is stored. Default: `"_"`. */
  charkey?: string;
  /** Always wrap child elements in arrays. Default: `true`. */
  explicitArray?: boolean;
  /** Wrap result in root element key. Default: `true`. */
  explicitRoot?: boolean;
  /** Ignore all attributes. Default: `false`. */
  ignoreAttrs?: boolean;
  /** Merge attributes into parent element. Default: `false`. */
  mergeAttrs?: boolean;
  /** Trim whitespace from text. Default: `false`. */
  trim?: boolean;
  /** Normalize whitespace in text (collapse runs). Default: `false`. */
  normalize?: boolean;
  /** Always use charkey for text content. Default: `false`. */
  explicitCharkey?: boolean;
  /** Value for empty tags. Default: `""`. */
  emptyTag?: unknown;
  /** Lowercase all tag names. Default: `false`. */
  normalizeTags?: boolean;
  /** Include namespace info. Default: `false`. */
  xmlns?: boolean;
  /** Key for namespace info. Default: `"$ns"`. */
  xmlnskey?: string;
  /** Separate children from attributes. Default: `false`. */
  explicitChildren?: boolean;
  /** Key for children when explicitChildren. Default: `"$$"`. */
  childkey?: string;
  /** Treat text nodes as children. Default: `false`. */
  charsAsChildren?: boolean;
  /** Preserve child element order. Default: `false`. */
  preserveChildrenOrder?: boolean;
  /** Include whitespace-only text nodes. Default: `false`. */
  includeWhiteChars?: boolean;
  /** Process input in chunks via setImmediate. Default: `false`. */
  async?: boolean;
  /** Strict XML parsing. Default: `true`. */
  strict?: boolean;
  /** Transform attribute names. Default: `null`. */
  attrNameProcessors?: Processor[] | null;
  /** Transform attribute values. Default: `null`. */
  attrValueProcessors?: Processor[] | null;
  /** Transform tag names. Default: `null`. */
  tagNameProcessors?: Processor[] | null;
  /** Transform text values. Default: `null`. */
  valueProcessors?: Processor[] | null;
  /** Custom validation function. Default: `null`. */
  validator?: Validator | null;
  /** Chunk size for async processing. Default: `10000`. */
  chunkSize?: number;
  /** Allow dangerous property names (__proto__, constructor, prototype). Default: `false`. */
  allowDangerousKeys?: boolean;
}

/** xml2js v0.2 defaults (current). */
export const DEFAULTS_0_2: Required<ParserOptions> = {
  attrkey: "$",
  charkey: "_",
  explicitArray: true,
  explicitRoot: true,
  ignoreAttrs: false,
  mergeAttrs: false,
  trim: false,
  normalize: false,
  explicitCharkey: false,
  emptyTag: "",
  normalizeTags: false,
  xmlns: false,
  xmlnskey: "$ns",
  explicitChildren: false,
  childkey: "$$",
  charsAsChildren: false,
  preserveChildrenOrder: false,
  includeWhiteChars: false,
  async: false,
  strict: true,
  attrNameProcessors: null,
  attrValueProcessors: null,
  tagNameProcessors: null,
  valueProcessors: null,
  validator: null,
  chunkSize: 10000,
  allowDangerousKeys: false,
};

/** xml2js v0.1 defaults (legacy). */
export const DEFAULTS_0_1: Required<ParserOptions> = {
  ...DEFAULTS_0_2,
  explicitArray: false,
  explicitRoot: false,
};
