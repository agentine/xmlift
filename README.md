# xmlift

**Modern, zero-dependency, TypeScript-first replacement for xml2js.**

`@agentine/xmlift` is a drop-in replacement for [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) — the same exports, same options, same output format — with full TypeScript types, no dependencies, and security improvements baked in by default.

> **Current status:** The SAX parser engine (Phase 1) is complete and published. The xml2js-compatible `Parser`, `Builder`, `parseString`, and `parseStringPromise` layer (Phase 2–3) is under active development. See [Roadmap](#roadmap).

---

## Why xmlift?

xml2js has 25M+ weekly downloads and has not had a release since July 2023. Its sole maintainer has publicly stated they cannot maintain it (issue [#626](https://github.com/Leonidas-from-XIV/node-xml2js/issues/626)), with 205 open issues and 42 unmerged PRs. It is written in CoffeeScript with no TypeScript types and has a known prototype pollution CVE (CVE-2023-0842).

No drop-in replacement existed — until now.

| | xml2js | xmlift |
|---|---|---|
| TypeScript | No (DefinitelyTyped only) | Yes (built-in, strict) |
| Dependencies | `sax`, `xmlbuilder` | None |
| Security | CVE-2023-0842 (prototype pollution) | Protected by default |
| API | Callback-first | Promise-native + callback compat |
| Maintained | No (since July 2023) | Yes |
| ESM | No | Yes (ESM + CJS dual publish) |

---

## Installation

```sh
npm install @agentine/xmlift
```

Requires **Node.js 18 or later**.

---

## Quick Start

### Parsing XML (promise style)

```typescript
import { parseStringPromise } from '@agentine/xmlift';

const xml = `<root><item id="1">hello</item><item id="2">world</item></root>`;

const result = await parseStringPromise(xml);
// {
//   root: {
//     item: [
//       { _: 'hello', $: { id: '1' } },
//       { _: 'world', $: { id: '2' } }
//     ]
//   }
// }
```

### Parsing XML (callback style)

```typescript
import { parseString } from '@agentine/xmlift';

parseString(xml, (err, result) => {
  if (err) throw err;
  console.log(result);
});

// With options:
parseString(xml, { trim: true, explicitArray: false }, (err, result) => {
  console.log(result);
});
```

### Using the Parser class

```typescript
import { Parser } from '@agentine/xmlift';

const parser = new Parser({ explicitArray: false, mergeAttrs: true });

const result = await parser.parseStringPromise(xml);

// Reuse the parser instance:
parser.reset();
const result2 = await parser.parseStringPromise(otherXml);
```

### Building XML

```typescript
import { Builder } from '@agentine/xmlift';

const builder = new Builder();
const xml = builder.buildObject({
  root: {
    item: [
      { _: 'hello', $: { id: '1' } },
      { _: 'world', $: { id: '2' } },
    ],
  },
});
// <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
// <root>
//   <item id="1">hello</item>
//   <item id="2">world</item>
// </root>
```

---

## API Reference

### `parseString(str, [options], callback)`

Top-level convenience function. Parses an XML string and calls `callback(err, result)`.

```typescript
function parseString(str: string, callback: Callback): void;
function parseString(str: string, options: ParserOptions, callback: Callback): void;

type Callback = (err: Error | null, result: any) => void;
```

### `parseStringPromise(str, [options])`

Promise-based version. Resolves with the parsed object or rejects with an error.

```typescript
function parseStringPromise(str: string, options?: ParserOptions): Promise<any>;
```

### `Parser`

The `Parser` class extends `EventEmitter` and is the core parsing engine.

```typescript
class Parser extends EventEmitter {
  constructor(options?: ParserOptions);

  /** Parse with callback. */
  parseString(str: string, callback?: Callback): void;

  /** Parse and return a promise. */
  parseStringPromise(str: string): Promise<any>;

  /** Reset internal state to reuse the parser instance. */
  reset(): void;
}
```

**Events emitted during parsing:**

| Event | Payload | Description |
|---|---|---|
| `end` | `result: any` | Parsing complete |
| `error` | `err: Error` | Parse error |

### `Builder`

Converts a JavaScript object to an XML string.

```typescript
class Builder {
  constructor(options?: BuilderOptions);

  /** Build an XML string from a JS object. */
  buildObject(obj: any): string;
}
```

### `ValidationError`

Thrown (or passed to callbacks) when a `validator` option rejects a value.

```typescript
class ValidationError extends Error {}
```

### `processors`

Built-in processor functions for use with `tagNameProcessors`, `attrNameProcessors`, `attrValueProcessors`, and `valueProcessors`.

```typescript
const processors: {
  /** Normalize whitespace in strings (collapse runs to single space, trim). */
  normalize: (str: string) => string;

  /** Lowercase the first character of a string. */
  firstCharLowerCase: (str: string) => string;

  /** Strip the namespace prefix from a name ("ns:local" -> "local"). */
  stripPrefix: (str: string) => string;

  /** Parse numeric strings to numbers, leave others as strings. */
  parseNumbers: (str: string) => string | number;

  /** Parse "true"/"false" to booleans, leave others as strings. */
  parseBooleans: (str: string) => string | boolean;
};
```

**Example:**

```typescript
import { parseStringPromise, processors } from '@agentine/xmlift';

const result = await parseStringPromise(xml, {
  tagNameProcessors: [processors.stripPrefix, processors.normalize],
  valueProcessors: [processors.parseNumbers, processors.parseBooleans],
});
```

### `defaults`

The default option sets for each xml2js compatibility mode.

```typescript
const defaults: {
  '0.1': ParserOptions; // legacy defaults
  '0.2': ParserOptions; // current defaults
};
```

---

## Parser Options

All options below correspond exactly to xml2js v0.2 options. The **Default** column shows the v0.2 default.

| Option | Type | Default | Description |
|---|---|---|---|
| `explicitCharkey` | `boolean` | `false` | Always store text content under `charkey` (default `"_"`), even when there are no sibling elements. When `false`, a simple `<tag>text</tag>` produces `{ tag: "text" }` instead of `{ tag: { _: "text" } }`. |
| `trim` | `boolean` | `false` | Trim leading and trailing whitespace from text nodes. |
| `normalize` | `boolean` | `false` | Collapse internal whitespace runs to a single space in text nodes (implies `trim`). |
| `normalizeTags` | `boolean` | `false` | Lowercase all element names before processing. |
| `attrkey` | `string` | `"$"` | The key under which element attributes are stored in the result object. |
| `charkey` | `string` | `"_"` | The key under which character data (text content) is stored when co-existing with attributes or children. |
| `explicitArray` | `boolean` | `true` | Always wrap child elements in arrays. When `false`, a single child is returned as a plain object rather than a one-element array. |
| `ignoreAttrs` | `boolean` | `false` | Discard all XML attributes entirely. |
| `mergeAttrs` | `boolean` | `false` | Merge attribute key-value pairs into the parent element object rather than nesting them under `attrkey`. Ignored when `ignoreAttrs` is `true`. |
| `explicitRoot` | `boolean` | `true` | Wrap the result in a top-level object keyed by the root element name. When `false`, the root element's content is returned directly. |
| `validator` | `function \| null` | `null` | A function `(xpath, currentValue, newValue) => newValue` that can validate or transform values. Throw a `ValidationError` to reject a value. |
| `xmlns` | `boolean` | `false` | Add namespace information (`uri`, `local`, `prefix`) to each tag and attribute under the `ns` key. |
| `explicitChildren` | `boolean` | `false` | Separate child elements from attributes into a dedicated `childkey` array. |
| `preserveChildrenOrder` | `boolean` | `false` | When `explicitChildren` is enabled, preserve document order of mixed text and element children. |
| `childkey` | `string` | `"$$"` | The key used for the children array when `explicitChildren` is `true`. |
| `charsAsChildren` | `boolean` | `false` | Include text nodes in the `childkey` array when `explicitChildren` is `true`. |
| `includeWhiteChars` | `boolean` | `false` | Include whitespace-only text nodes in the result (normally discarded). |
| `async` | `boolean` | `false` | Process the input in chunks using `setImmediate` to avoid blocking the event loop on large documents. |
| `strict` | `boolean` | `true` | Enable strict XML parsing. When `false`, lenient mode tolerates malformed XML such as unquoted attributes, mismatched tags, and unknown entities. |
| `attrNameProcessors` | `Processor[] \| null` | `null` | Array of functions applied in sequence to each attribute name before it is stored in the result. |
| `attrValueProcessors` | `Processor[] \| null` | `null` | Array of functions applied in sequence to each attribute value before it is stored. |
| `tagNameProcessors` | `Processor[] \| null` | `null` | Array of functions applied in sequence to each element name. |
| `valueProcessors` | `Processor[] \| null` | `null` | Array of functions applied in sequence to each text value. |
| `emptyTag` | `string \| function \| false` | `""` | Value to use for empty elements (e.g., `<br/>`). Pass a function to compute the value dynamically; pass `false` or `null` to use `null`. |
| `chunkSize` | `number` | `10000` | Number of characters per chunk when `async` is `true`. |
| `allowDangerousKeys` | `boolean` | `false` | Disable prototype pollution protection. When `false` (default), element and attribute names that would pollute the prototype chain (`__proto__`, `constructor`, `prototype`) are silently dropped. Set to `true` only for strict xml2js output compatibility in trusted environments. |

### Processor function type

```typescript
type Processor = (value: string) => string | number | boolean;
```

---

## Builder Options

| Option | Type | Default | Description |
|---|---|---|---|
| `rootName` | `string` | `"root"` | The element name to use when the input object has no single top-level key. |
| `xmldec` | `object` | `{ version: "1.0", encoding: "UTF-8", standalone: true }` | XML declaration parameters. Set any key to `null` to omit that attribute from the declaration. |
| `doctype` | `string \| null` | `null` | DOCTYPE string to insert after the XML declaration. |
| `renderOpts` | `object` | `{ pretty: true, indent: "  ", newline: "\n" }` | Formatting options. Set `pretty: false` for compact single-line output. `indent` is the per-level indentation string. `newline` is the line separator. |
| `headless` | `boolean` | `false` | Omit the `<?xml ...?>` declaration entirely. |
| `cdata` | `boolean` | `false` | Wrap text content that contains `<`, `>`, or `&` in a `<![CDATA[...]]>` section rather than escaping with XML entities. |

---

## Security Features

xmlift is designed to be safe by default. All protections are enabled without any configuration.

### Prototype Pollution Protection

Element and attribute names that would pollute the JavaScript prototype chain — `__proto__`, `constructor`, and `prototype` — are rejected during parsing. This blocks the class of vulnerability described in [CVE-2023-0842](https://nvd.nist.gov/vuln/detail/CVE-2023-0842) (the xml2js prototype pollution CVE).

If you need the raw xml2js behavior in a fully trusted environment, set `allowDangerousKeys: true`.

### Entity Expansion Limits

Malicious XML documents can use recursive entity definitions to cause exponential string expansion (the "billion laughs" attack). xmlift enforces two limits on entity expansion:

- **`maxEntityExpansionDepth`** (default: `5`) — maximum depth of recursive entity expansion.
- **`maxEntityExpansions`** (default: `10000`) — maximum total number of entity expansions for a single document.

Both limits can be raised or lowered via `SaxParserOptions` when using the low-level SAX API.

### Maximum Nesting Depth

Deeply nested XML documents can cause stack overflows. xmlift tracks nesting depth and throws an error when it exceeds the limit.

- **`maxDepth`** (default: `200`) — maximum element nesting depth.

This is configurable via `SaxParserOptions` when using the SAX API directly.

### Safe Object Construction

Parsed result objects are created with `Object.create(null)` rather than `{}`, which prevents prototype chain pollution even for edge cases not caught by the key filter.

---

## Low-Level SAX API

xmlift exposes its internal SAX parser for advanced use cases such as streaming, custom tree building, or performance-critical pipelines.

### `SaxParser`

An `EventEmitter`-based streaming XML parser. Feed it chunks of text; it emits events as tokens are recognized.

```typescript
import { SaxParser } from '@agentine/xmlift';

const parser = new SaxParser({ strict: true, xmlns: true, maxDepth: 200 });

parser.on('opentag', (tag: SaxTag) => {
  console.log('open:', tag.name, tag.attributes);
  if (tag.ns) console.log('  namespace:', tag.ns);
});

parser.on('closetag', (name: string) => {
  console.log('close:', name);
});

parser.on('text', (text: string) => {
  console.log('text:', text);
});

parser.on('cdata', (data: string) => {
  console.log('cdata:', data);
});

parser.on('comment', (text: string) => {
  console.log('comment:', text);
});

parser.on('processinginstruction', (pi: SaxProcessingInstruction) => {
  console.log('pi:', pi.name, pi.body);
});

parser.on('doctype', (dtd: string) => {
  console.log('doctype:', dtd);
});

parser.on('error', (err: Error) => {
  console.error('parse error:', err);
});

parser.on('end', () => {
  console.log('done');
});

// Feed data (can be called multiple times for streaming):
parser.feed('<root>');
parser.feed('<item>hello</item>');
parser.feed('</root>');
parser.close();
```

**`SaxParser` methods:**

| Method | Description |
|---|---|
| `feed(chunk: string)` | Feed a chunk of XML text. May be called multiple times for streaming. Strips BOM on first call. |
| `close()` | Signal end of input. Flushes remaining text, validates final state, emits `"end"`. |
| `reset()` | Reset all parser state for reuse without creating a new instance. |

**`SaxParserOptions`:**

| Option | Type | Default | Description |
|---|---|---|---|
| `strict` | `boolean` | `true` | Strict parsing mode. When `false`, errors are silently suppressed and malformed XML is recovered where possible. |
| `xmlns` | `boolean` | `false` | Enable namespace processing. Adds `ns` and `attributeNS` fields to `SaxTag`. |
| `maxDepth` | `number` | `200` | Maximum element nesting depth. Throws when exceeded. |
| `maxEntityExpansionDepth` | `number` | `5` | Maximum depth for recursive entity expansion. |
| `maxEntityExpansions` | `number` | `10000` | Maximum total entity expansions per document. |
| `customEntities` | `Record<string, string>` | — | Custom entity name-to-value mappings (e.g., `{ nbsp: '\u00a0' }`). |

**`SaxTag` interface:**

```typescript
interface SaxTag {
  /** Raw element name (with prefix if present). */
  name: string;
  /** Attribute name-to-value map (entities already resolved). */
  attributes: Record<string, string>;
  /** Namespace info for the element (only when xmlns: true). */
  ns?: ResolvedName;
  /** Namespace info for each attribute (only when xmlns: true). */
  attributeNS?: Record<string, ResolvedName>;
}
```

**`ResolvedName` interface** (namespace info):

```typescript
interface ResolvedName {
  local: string;   // local name without prefix
  prefix: string;  // namespace prefix (empty string for default namespace)
  uri: string;     // namespace URI
}
```

### `Tokenizer`

The lowest-level API. A character-by-character state machine that tokenizes raw XML into `Token` objects via a callback. Use this if you need token-level position tracking or want to build a custom parser on top.

```typescript
import { Tokenizer, TokenType, type Token, type Position } from '@agentine/xmlift';

const tokenizer = new Tokenizer((token: Token) => {
  console.log(token.type, token.name ?? '', token.value, token.position);
}, { strict: true });

tokenizer.feed('<root id="1">hello</root>');
tokenizer.close();
```

**Token types (`TokenType` enum):**

| Value | Description |
|---|---|
| `TokenType.OpenTag` | Opening tag name seen (`<foo`). `token.name` = tag name. |
| `TokenType.CloseTag` | Closing tag (`</foo>`). `token.name` = tag name. |
| `TokenType.SelfCloseTag` | Self-closing tag (`<foo/>`). `token.name` = tag name. |
| `TokenType.Attribute` | Attribute. `token.name` = attribute name, `token.value` = raw value (before entity resolution). |
| `TokenType.Text` | Text node. `token.value` = raw text (before entity resolution). |
| `TokenType.CDATA` | CDATA section. `token.value` = content. |
| `TokenType.Comment` | Comment. `token.value` = content. |
| `TokenType.ProcessingInstruction` | Processing instruction. `token.name` = target, `token.value` = body. |
| `TokenType.DocType` | DOCTYPE declaration. `token.value` = raw DTD content. |

**`Token` interface:**

```typescript
interface Token {
  type: TokenType;
  value: string;
  name?: string;       // tag name, attribute name, or PI target (where applicable)
  position: Position;  // location of the token start in the source
}

interface Position {
  line: number;    // 1-based line number
  column: number;  // 1-based column number
  offset: number;  // 0-based byte offset
}
```

### Entity utilities

```typescript
import { resolveEntity, expandEntities, type EntityOptions } from '@agentine/xmlift';
```

**`resolveEntity(ref, options?)`** — Resolve a single entity reference (without `&` and `;`).

```typescript
resolveEntity('amp')        // '&'
resolveEntity('lt')         // '<'
resolveEntity('#65')        // 'A'  (decimal)
resolveEntity('#x41')       // 'A'  (hex)
resolveEntity('nbsp', { customEntities: { nbsp: '\u00a0' } }) // '\u00a0'
```

**`expandEntities(text, options?)`** — Expand all entity and character references in a text string. Enforces depth and count limits.

```typescript
expandEntities('AT&amp;T &lt;3')  // 'AT&T <3'
```

**`EntityOptions`:**

| Option | Type | Default | Description |
|---|---|---|---|
| `strict` | `boolean` | `true` | Throw on unknown or malformed entities. When `false`, leave them as-is. |
| `customEntities` | `Record<string, string>` | — | Additional entity definitions. |
| `maxEntityExpansionDepth` | `number` | `5` | Maximum recursion depth for entity expansion. |
| `maxEntityExpansions` | `number` | `10000` | Maximum total expansions per call. |

### BOM utility

```typescript
import { stripBOM } from '@agentine/xmlift';

stripBOM('\uFEFF<?xml version="1.0"?>...')  // '<?xml version="1.0"?>...'
```

Strips the Unicode BOM (U+FEFF) from the start of a string if present. Handles UTF-8, UTF-16 LE, and UTF-16 BE BOMs (all appear as U+FEFF in decoded JavaScript strings).

### Namespace utilities

```typescript
import { NamespaceContext, getElementNS, getAttrNS } from '@agentine/xmlift';
```

**`NamespaceContext`** — Scoped namespace prefix-to-URI registry.

```typescript
const ctx = new NamespaceContext();
ctx.push();                          // enter new element scope
ctx.addNamespace('', 'http://example.com/default');
ctx.addNamespace('foo', 'http://example.com/foo');
ctx.resolvePrefix('foo');            // 'http://example.com/foo'
ctx.resolvePrefix('');               // 'http://example.com/default'
ctx.pop();                           // exit element scope

// Parse an xmlns attribute name to get its declared prefix:
NamespaceContext.parseXmlnsAttr('xmlns');       // '' (default namespace)
NamespaceContext.parseXmlnsAttr('xmlns:foo');   // 'foo'
NamespaceContext.parseXmlnsAttr('href');        // null (not an xmlns attr)
```

**`getElementNS(tagName, ctx)`** — Resolve the namespace of an element.

**`getAttrNS(attrName, ctx)`** — Resolve the namespace of an attribute. Per the XML Namespaces spec, unprefixed attributes do not inherit the default namespace.

---

## Migration Guide from xml2js

### Single import change

For most projects, migration is a one-line change:

```diff
- const xml2js = require('xml2js');
+ const xml2js = require('@agentine/xmlift');
```

```diff
- import * as xml2js from 'xml2js';
+ import * as xml2js from '@agentine/xmlift';
```

Or adopt named imports:

```diff
- const { parseString, parseStringPromise, Builder } = require('xml2js');
+ const { parseString, parseStringPromise, Builder } = require('@agentine/xmlift');
```

All exports (`parseString`, `parseStringPromise`, `Parser`, `Builder`, `ValidationError`, `processors`, `defaults`) are available with the same signatures.

### Prototype pollution protection (`allowDangerousKeys`)

The one intentional behavioral difference is security. xmlift blocks element and attribute names that would pollute the prototype chain (`__proto__`, `constructor`, `prototype`). xml2js is vulnerable to these (CVE-2023-0842).

If you have XML that legitimately contains these names and you have verified your input is trusted, you can restore the xml2js behavior:

```typescript
parseStringPromise(xml, { allowDangerousKeys: true });
```

In almost all cases you do not need this.

### Behavioral differences

| Behavior | xml2js | xmlift |
|---|---|---|
| Prototype pollution via element names | Vulnerable (CVE-2023-0842) | Blocked by default |
| Entity expansion limits | None | Depth 5, count 10000 |
| Maximum nesting depth | None (stack overflow possible) | 200 (configurable) |
| TypeScript types | Via `@types/xml2js` (separate package) | Built-in, strict |
| Dependencies | `sax`, `xmlbuilder` | None |
| ESM support | No | Yes |
| Node.js requirement | Node 6+ | Node 18+ |

### Minimum viable migration checklist

1. `npm uninstall xml2js && npm install @agentine/xmlift`
2. Find and replace import/require paths.
3. Remove `@types/xml2js` from devDependencies (types are now built-in).
4. Run your test suite. Output should be identical.
5. If any test uses element names like `__proto__` or `constructor`, add `allowDangerousKeys: true` to that test — but consider whether that XML is actually safe to process.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| 1: SAX engine | **Complete** | Tokenizer, entity resolution, BOM, namespace support |
| 2: xml2js-compatible Parser | In progress | `Parser`, `parseString`, `parseStringPromise`, all 25+ options |
| 3: xml2js-compatible Builder | Planned | `Builder`, `buildObject`, all builder options |
| 4: Polish & publish | Planned | Tests, CI, npm publish |

---

## License

MIT
