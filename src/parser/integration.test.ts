/**
 * Phase 2.3 integration tests — top-level API and golden comparisons.
 */
import { describe, it, expect } from "vitest";
import {
  parseString,
  parseStringPromise,
  Parser,
  processors,
  defaults,
  ValidationError,
  DEFAULTS_0_2,
  DEFAULTS_0_1,
} from "../index.js";

// -----------------------------------------------------------------------
// Top-level parseString / parseStringPromise
// -----------------------------------------------------------------------

describe("parseString (top-level)", () => {
  it("parses with callback (no options)", async () => {
    const result = await new Promise<unknown>((resolve, reject) => {
      parseString("<root>hello</root>", (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    expect(result).toEqual({ root: ["hello"] });
  });

  it("parses with options and callback", async () => {
    const result = await new Promise<unknown>((resolve, reject) => {
      parseString(
        "<root>hello</root>",
        { explicitRoot: false },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        },
      );
    });
    expect(result).toBe("hello");
  });

  it("returns error on malformed XML", async () => {
    const err = await new Promise<Error | null>((resolve) => {
      parseString("<root><unclosed>", { strict: true }, (err) => {
        resolve(err);
      });
    });
    expect(err).toBeInstanceOf(Error);
  });
});

describe("parseStringPromise (top-level)", () => {
  it("resolves with parsed result", async () => {
    const result = await parseStringPromise("<root>hello</root>");
    expect(result).toEqual({ root: ["hello"] });
  });

  it("accepts options", async () => {
    const result = await parseStringPromise("<root>hello</root>", {
      explicitRoot: false,
    });
    expect(result).toBe("hello");
  });

  it("rejects on malformed XML", async () => {
    await expect(
      parseStringPromise("<root><unclosed>", { strict: true }),
    ).rejects.toThrow();
  });
});

// -----------------------------------------------------------------------
// processors and defaults exports
// -----------------------------------------------------------------------

describe("processors export", () => {
  it("has all 5 built-in processors", () => {
    expect(typeof processors.normalize).toBe("function");
    expect(typeof processors.firstCharLowerCase).toBe("function");
    expect(typeof processors.stripPrefix).toBe("function");
    expect(typeof processors.parseNumbers).toBe("function");
    expect(typeof processors.parseBooleans).toBe("function");
  });
});

describe("defaults export", () => {
  it("has 0.1 and 0.2 defaults", () => {
    expect(defaults["0.1"]).toBeDefined();
    expect(defaults["0.2"]).toBeDefined();
  });

  it("0.2 has explicitArray=true", () => {
    expect(defaults["0.2"].explicitArray).toBe(true);
    expect(defaults["0.2"].explicitRoot).toBe(true);
  });

  it("0.1 has explicitArray=false", () => {
    expect(defaults["0.1"].explicitArray).toBe(false);
    expect(defaults["0.1"].explicitRoot).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Golden comparison tests — verify output matches xml2js exactly
// -----------------------------------------------------------------------

describe("Golden comparisons (xml2js v0.2 defaults)", () => {
  it("simple element", async () => {
    const result = await parseStringPromise("<root>hello</root>");
    expect(result).toEqual({ root: ["hello"] });
  });

  it("nested elements", async () => {
    const xml = "<root><a>1</a><b>2</b></root>";
    const result = await parseStringPromise(xml);
    expect(result).toEqual({ root: [{ a: ["1"], b: ["2"] }] });
  });

  it("attributes", async () => {
    const xml = '<root id="1" class="main"><child>text</child></root>';
    const result = await parseStringPromise(xml);
    expect(result).toEqual({
      root: [{
        $: { id: "1", class: "main" },
        child: ["text"],
      }],
    });
  });

  it("repeated children", async () => {
    const xml = "<list><item>a</item><item>b</item><item>c</item></list>";
    const result = await parseStringPromise(xml);
    expect(result).toEqual({ list: [{ item: ["a", "b", "c"] }] });
  });

  it("self-closing tag", async () => {
    const xml = '<root><empty/></root>';
    const result = await parseStringPromise(xml);
    expect(result).toEqual({ root: [{ empty: [""] }] });
  });

  it("mixed content", async () => {
    const xml = '<item id="42">text</item>';
    const result = await parseStringPromise(xml);
    expect(result).toEqual({
      item: [{ $: { id: "42" }, _: "text" }],
    });
  });

  it("deeply nested", async () => {
    const xml = "<a><b><c><d>deep</d></c></b></a>";
    const result = await parseStringPromise(xml);
    expect(result).toEqual({
      a: [{ b: [{ c: [{ d: ["deep"] }] }] }],
    });
  });

  it("CDATA content", async () => {
    const xml = "<root><![CDATA[hello <world>]]></root>";
    const result = await parseStringPromise(xml);
    expect(result).toEqual({ root: ["hello <world>"] });
  });

  it("entity references", async () => {
    const xml = "<root>&lt;b&gt;bold&lt;/b&gt;</root>";
    const result = await parseStringPromise(xml);
    expect(result).toEqual({ root: ["<b>bold</b>"] });
  });

  it("empty document root", async () => {
    const xml = "<root/>";
    const result = await parseStringPromise(xml);
    expect(result).toEqual({ root: [""] });
  });
});

// -----------------------------------------------------------------------
// Namespace integration
// -----------------------------------------------------------------------

describe("Namespace handling (xmlns=true)", () => {
  it("includes namespace info on elements", async () => {
    const xml = '<root xmlns="http://example.com"><child>text</child></root>';
    const result = await parseStringPromise(xml, { xmlns: true });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("$ns");
    const ns = root.$ns as { uri: string; local: string };
    expect(ns.uri).toBe("http://example.com");
    expect(ns.local).toBe("root");
  });

  it("custom xmlnskey", async () => {
    const xml = '<root xmlns="http://example.com">text</root>';
    const result = await parseStringPromise(xml, {
      xmlns: true,
      xmlnskey: "$xmlns",
    });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("$xmlns");
  });
});

// -----------------------------------------------------------------------
// Complete option verification
// -----------------------------------------------------------------------

describe("All v0.2 options exist", () => {
  it("DEFAULTS_0_2 has all required keys", () => {
    const keys = [
      "attrkey", "charkey", "explicitArray", "explicitRoot",
      "ignoreAttrs", "mergeAttrs", "trim", "normalize",
      "explicitCharkey", "emptyTag", "normalizeTags", "xmlns",
      "xmlnskey", "explicitChildren", "childkey",
      "charsAsChildren", "preserveChildrenOrder", "includeWhiteChars",
      "async", "strict", "attrNameProcessors", "attrValueProcessors",
      "tagNameProcessors", "valueProcessors", "validator",
      "chunkSize", "allowDangerousKeys",
    ];
    for (const key of keys) {
      expect(DEFAULTS_0_2).toHaveProperty(key);
    }
  });

  it("DEFAULTS_0_2 values match xml2js v0.2", () => {
    expect(DEFAULTS_0_2.attrkey).toBe("$");
    expect(DEFAULTS_0_2.charkey).toBe("_");
    expect(DEFAULTS_0_2.explicitArray).toBe(true);
    expect(DEFAULTS_0_2.explicitRoot).toBe(true);
    expect(DEFAULTS_0_2.ignoreAttrs).toBe(false);
    expect(DEFAULTS_0_2.mergeAttrs).toBe(false);
    expect(DEFAULTS_0_2.trim).toBe(false);
    expect(DEFAULTS_0_2.normalize).toBe(false);
    expect(DEFAULTS_0_2.explicitCharkey).toBe(false);
    expect(DEFAULTS_0_2.emptyTag).toBe("");
    expect(DEFAULTS_0_2.normalizeTags).toBe(false);
    expect(DEFAULTS_0_2.xmlns).toBe(false);
    expect(DEFAULTS_0_2.strict).toBe(true);
    expect(DEFAULTS_0_2.async).toBe(false);
    expect(DEFAULTS_0_2.chunkSize).toBe(10000);
    expect(DEFAULTS_0_2.allowDangerousKeys).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Parser reuse
// -----------------------------------------------------------------------

describe("Parser reuse", () => {
  it("can parse multiple documents without reset", async () => {
    const parser = new Parser();
    const r1 = await parser.parseStringPromise("<a>1</a>");
    expect(r1).toEqual({ a: ["1"] });
    const r2 = await parser.parseStringPromise("<b>2</b>");
    expect(r2).toEqual({ b: ["2"] });
  });

  it("can parse multiple documents with reset", async () => {
    const parser = new Parser();
    const r1 = await parser.parseStringPromise("<a>1</a>");
    expect(r1).toEqual({ a: ["1"] });
    parser.reset();
    const r2 = await parser.parseStringPromise("<b>2</b>");
    expect(r2).toEqual({ b: ["2"] });
  });
});
