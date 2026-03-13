# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-13

Initial release of **xmlift** — a zero-dependency, TypeScript-first drop-in replacement for [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) with security-by-default.

### Added

- **XML tokenizer** — streaming state-machine tokenizer covering all XML production rules: start/end tags, self-closing tags, attributes, text content, CDATA sections, processing instructions, comments, DOCTYPE declarations, and BOM stripping.
- **Entity resolution** — built-in XML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`), numeric character references (decimal and hex), with configurable entity expansion limits to prevent XXE/billion-laughs attacks.
- **XML namespace resolution** — `xmlns` and `xmlns:prefix` attribute processing; namespace URIs surfaced on elements.
- **SAX parser** (`Parser`) — EventEmitter-based streaming parser composing tokenizer, entity resolution, and namespace handling. Events: `text`, `processingInstruction`, `comment`, `doctype`, `startElement`, `endElement`, `cdata`, `error`, `end`.
- **Tree builder** — `parseString(str, [opts], cb)` and `parseStringPromise(str, [opts])` that consume SAX events and produce an xml2js-compatible JS object tree.
- **25 parser options** — `explicitArray`, `explicitRoot`, `explicitCharkey`, `mergeAttrs`, `attrkey`, `charkey`, `childkey`, `explicitChildren`, `charsAsChildren`, `normalize`, `normalizeTags`, `trim`, `ignoreAttrs`, `valueProcessors`, `attrValueProcessors`, `tagNameProcessors`, `attrNameProcessors`, `strict`, `xmlns`, `async`, `emptyTag`, `validator`, `object`, `rootName`, `xmldec` — full xml2js option parity.
- **5 built-in processors** — `normalize`, `firstCharLowerCase`, `stripPrefix`, `parseNumbers`, `parseBooleans` (in the `processors` export).
- **Builder** — `new Builder(opts).buildObject(obj)` converts JS objects back to XML strings, with XML declaration, DOCTYPE, attributes (custom `attrkey`), nested elements, arrays, CDATA wrapping, and pretty-printing.
- **Dual CJS + ESM exports** — `import` path serves ESM (`dist/esm/`), `require` path serves CJS (`dist/cjs/`). Full TypeScript declarations included.
- **241 tests** — covering parser, builder, processors, security limits, edge cases, compat with xml2js output, and supplementary-plane Unicode.

### Security (over xml2js)

- **Prototype pollution protection** — `__proto__`, `constructor`, `prototype` keys are sanitized from parsed output; xml2js is vulnerable by default.
- **Entity expansion limits** — configurable max entity expansions (default 1000) and max entity size; prevents billion-laughs / quadratic blowup.
- **Max depth limit** — configurable maximum nesting depth; prevents stack overflow on deeply nested documents.
- **No `eval`, no `Function` constructor** — zero dynamic code execution paths.

### Fixed

- 7 HIGH bugs in the SAX parser found during QA: malformed attribute handling, CDATA spanning multiple chunks, namespace prefix resolution on attributes, entity decoding in attribute values, comment/PI nesting edge cases, BOM detection for UTF-16 surrogates, self-closing tag state machine transition.
- Supplementary-plane character support in text content and attribute values.
