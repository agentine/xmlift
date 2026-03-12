# xmlift — Implementation Plan

## Overview

**xmlift** is a modern, zero-dependency, TypeScript-first replacement for
[xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) (25M+ weekly npm
downloads, unmaintained since July 2023, single maintainer who explicitly
cannot maintain it, 205 open issues, 42 unmerged PRs).

xmlift provides a 100% xml2js-compatible API so existing code can migrate with
a single import path change.

**npm package:** `@agentine/xmlift`
**License:** MIT

---

## Why xml2js Needs Replacing

| Signal | Detail |
|---|---|
| Downloads | 25M+ weekly / 108M+ monthly |
| Maintainer | Sole maintainer (Marek Kubica) explicitly said he lacks time (issue #626) |
| Last release | v0.6.2 — July 26, 2023 (2.7 years ago) |
| Open issues | 205 |
| Open PRs | 42 |
| CVE history | CVE-2023-0842 — prototype pollution |
| Source language | CoffeeScript (transpiled JS, no types) |
| Dependencies | `sax`, `xmlbuilder` — each with their own maintenance concerns |
| API style | Callback-based (promise wrapper bolted on) |
| No GitHub releases | Only npm publishes, no tagged releases |

**No API-compatible replacement exists.** fast-xml-parser is maintained but has
a completely different API. All other alternatives (xml-js, xmldom, cheerio)
also have incompatible APIs.

---

## Design Principles

1. **Drop-in compatible** — same exports, same options, same output format
2. **TypeScript-first** — full type safety, generics, strict mode
3. **Zero dependencies** — built-in SAX parser and XML builder
4. **Security by default** — prototype pollution blocked, entity expansion
   limited, configurable depth limits
5. **Promise-native** — async/await first, callbacks supported for compat
6. **ESM + CJS** — dual-publish for all environments
7. **Node.js 18+** — modern baseline (LTS)

---

## Public API Surface (xml2js-compatible)

### Exports

```typescript
// Functions
export function parseString(str: string, callback: Callback): void;
export function parseString(str: string, options: ParserOptions, callback: Callback): void;
export function parseStringPromise(str: string, options?: ParserOptions): Promise<any>;

// Classes
export class Parser extends EventEmitter {
  constructor(options?: ParserOptions);
  parseString(str: string, callback?: Callback): void;
  parseStringPromise(str: string): Promise<any>;
  reset(): void;
}

export class Builder {
  constructor(options?: BuilderOptions);
  buildObject(obj: any): string;
}

// Error types
export class ValidationError extends Error {}

// Built-in processors
export const processors: {
  normalize: (str: string) => string;
  firstCharLowerCase: (str: string) => string;
  stripPrefix: (str: string) => string;
  parseNumbers: (str: string) => string | number;
  parseBooleans: (str: string) => string | boolean;
};

// Defaults
export const defaults: { "0.1": ParserOptions; "0.2": ParserOptions };
```

### Parser Options (v0.2 defaults — current)

| Option | Default | Description |
|---|---|---|
| `explicitCharkey` | `false` | Always use charkey for text content |
| `trim` | `false` | Trim whitespace from text |
| `normalize` | `false` | Normalize whitespace in text |
| `normalizeTags` | `false` | Lowercase all tag names |
| `attrkey` | `"$"` | Key under which attributes are stored |
| `charkey` | `"_"` | Key under which character data is stored |
| `explicitArray` | `true` | Always wrap child elements in arrays |
| `ignoreAttrs` | `false` | Ignore all attributes |
| `mergeAttrs` | `false` | Merge attributes into parent element |
| `explicitRoot` | `true` | Wrap result in root element key |
| `validator` | `null` | Custom validation function |
| `xmlns` | `false` | Include namespace info |
| `explicitChildren` | `false` | Separate children from attributes |
| `preserveChildrenOrder` | `false` | Preserve child element order |
| `childkey` | `"$$"` | Key for children when explicitChildren |
| `charsAsChildren` | `false` | Treat text nodes as children |
| `includeWhiteChars` | `false` | Include whitespace-only text nodes |
| `async` | `false` | Process input in chunks via setImmediate |
| `strict` | `true` | Strict XML parsing |
| `attrNameProcessors` | `null` | Transform attribute names |
| `attrValueProcessors` | `null` | Transform attribute values |
| `tagNameProcessors` | `null` | Transform tag names |
| `valueProcessors` | `null` | Transform text values |
| `emptyTag` | `""` | Value for empty tags |
| `chunkSize` | `10000` | Chunk size for async processing |

### Builder Options (additional)

| Option | Default | Description |
|---|---|---|
| `rootName` | `"root"` | Default root element name |
| `xmldec` | `{ version: "1.0", encoding: "UTF-8", standalone: true }` | XML declaration |
| `doctype` | `null` | DOCTYPE string |
| `renderOpts` | `{ pretty: true, indent: "  ", newline: "\n" }` | Render formatting |
| `headless` | `false` | Omit XML declaration |
| `cdata` | `false` | Wrap special chars in CDATA |

---

## Security Improvements Over xml2js

1. **Prototype pollution protection** — reject `__proto__`, `constructor`,
   `prototype` as element/attribute names by default (blocks CVE-2023-0842)
2. **Entity expansion limits** — cap entity expansion depth and total
   expansions to prevent billion-laughs / XXE attacks
3. **Maximum depth limit** — configurable max nesting depth (default: 200)
   to prevent stack overflow on deeply nested documents
4. **Safe object creation** — use `Object.create(null)` for parsed objects
   to prevent prototype chain pollution

---

## Implementation Phases

### Phase 1: SAX Parser Engine

Built-in streaming SAX parser that replaces the `sax` npm dependency.

**Deliverables:**
- XML tokenizer/lexer with position tracking (line, column, byte offset)
- SAX event callbacks: `onopentag`, `onclosetag`, `ontext`, `oncdata`,
  `oncomment`, `onprocessinginstruction`, `onerror`, `onend`
- Predefined XML entities (`&amp;`, `&lt;`, `&gt;`, `&apos;`, `&quot;`)
- Numeric and hex character references (`&#123;`, `&#x7B;`)
- Entity expansion with configurable depth/count limits
- XML namespace support (prefix resolution, default namespace)
- BOM detection and stripping (UTF-8, UTF-16 LE/BE)
- Strict and lenient (non-strict) parsing modes
- CDATA section handling
- Processing instruction handling
- Comment handling
- Attribute parsing with quote handling (single and double)
- Self-closing tag support
- Error recovery in lenient mode

### Phase 2: XML-to-JS Parser

xml2js-compatible `Parser` class and `parseString`/`parseStringPromise`
functions that transform SAX events into JavaScript objects.

**Deliverables:**
- `Parser` class extending `EventEmitter`
- All 25 configuration options with exact xml2js v0.2 defaults
- `parseString(str, [options], callback)` top-level function
- `parseStringPromise(str, [options])` top-level function
- Stack-based tree construction from SAX events
- Attribute handling: `attrkey`, `mergeAttrs`, `ignoreAttrs`
- Text content handling: `charkey`, `trim`, `normalize`, `explicitCharkey`
- Array wrapping: `explicitArray`, `explicitRoot`
- Children handling: `explicitChildren`, `preserveChildrenOrder`, `childkey`,
  `charsAsChildren`, `includeWhiteChars`
- Processor pipelines: `attrNameProcessors`, `attrValueProcessors`,
  `tagNameProcessors`, `valueProcessors`
- Built-in processors: `normalize`, `firstCharLowerCase`, `stripPrefix`,
  `parseNumbers`, `parseBooleans`
- Namespace handling: `xmlns`, `xmlnskey`
- Validator callback support
- Async chunked processing via `setImmediate`
- Empty tag handling (string, function, or falsy)
- `ValidationError` class
- Legacy v0.1 defaults support
- Prototype pollution protection (block dangerous property names)

### Phase 3: JS-to-XML Builder

xml2js-compatible `Builder` class that converts JavaScript objects back to
XML strings, replacing the `xmlbuilder` dependency.

**Deliverables:**
- `Builder` class with `buildObject(obj)` method
- XML element rendering (open tag, close tag, self-closing)
- Attribute rendering with proper escaping
- Text content rendering with XML entity escaping
- CDATA section wrapping (when `cdata: true` and content requires it)
- CDATA escape handling (`]]>` splitting)
- XML declaration generation (`<?xml ... ?>`)
- DOCTYPE generation
- Pretty-printing: configurable indent string and newline
- Headless mode (omit declaration)
- Root name auto-detection from single-key objects
- Recursive object-to-XML rendering matching xml2js output exactly

### Phase 4: Polish & Ship

Testing, documentation, and release preparation.

**Deliverables:**
- **Compatibility tests** — golden tests comparing xmlift output against
  xml2js output for every option combination
- **Security tests** — prototype pollution, XXE, entity bomb, deep nesting
- **Edge case tests** — empty documents, whitespace-only, malformed XML,
  BOM variants, Unicode, huge documents
- **Performance benchmarks** — compare parse/build times vs xml2js and
  fast-xml-parser on standard XML corpus
- **README** — installation, quickstart, migration guide, API reference
- **Migration guide** — step-by-step instructions for xml2js users
  (single import change, behavioral differences)
- **TypeScript declarations** — full .d.ts with generics
- **Dual publish** — ESM (`import`) + CJS (`require`) via package.json exports
- **CI** — GitHub Actions: lint, test, build on Node 18/20/22
- **npm publish** — `@agentine/xmlift`

---

## Technical Architecture

```
src/
  index.ts          # Public API exports
  sax/
    tokenizer.ts    # XML lexer (character-by-character state machine)
    parser.ts       # SAX event emitter wrapping tokenizer
    entities.ts     # Entity resolution (predefined + numeric + hex)
    namespaces.ts   # Namespace prefix resolution
    bom.ts          # BOM detection and stripping
  parser/
    parser.ts       # xml2js-compatible Parser class
    options.ts      # Option types and defaults (0.1 and 0.2)
    processors.ts   # Built-in processor functions
    errors.ts       # ValidationError
  builder/
    builder.ts      # xml2js-compatible Builder class
    escape.ts       # XML entity escaping for output
    render.ts       # XML element/attribute rendering
```

---

## Compatibility Guarantees

For any XML input and any combination of xml2js v0.2 options:

```javascript
const xml2js = require('xml2js');
const xmlift = require('@agentine/xmlift');

// These must produce identical output:
xml2js.parseString(xml, options, (err, r1) => { ... });
xmlift.parseString(xml, options, (err, r2) => { ... });
// assert.deepStrictEqual(r1, r2)

// Builder output must also match:
new xml2js.Builder(options).buildObject(obj);
new xmlift.Builder(options).buildObject(obj);
```

The only intentional divergence is security: xmlift blocks prototype pollution
by default (configurable via `allowDangerousKeys: true` for full compat).
