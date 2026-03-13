import { describe, it, expect } from "vitest";
import { Parser } from "./parser.js";
import { ValidationError } from "./errors.js";
import { DEFAULTS_0_2, DEFAULTS_0_1 } from "./options.js";

// Helper: parse synchronously and return result via callback.
function parse(xml: string, opts?: ConstructorParameters<typeof Parser>[0]) {
  return new Promise<unknown>((resolve, reject) => {
    const parser = new Parser(opts);
    parser.parseString(xml, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

describe("Parser — core tree construction", () => {
  it("parses a simple element with text", async () => {
    const result = await parse("<root>hello</root>");
    expect(result).toEqual({ root: ["hello"] });
  });

  it("parses nested elements", async () => {
    const xml = "<root><a>1</a><b>2</b></root>";
    const result = await parse(xml);
    expect(result).toEqual({ root: [{ a: ["1"], b: ["2"] }] });
  });

  it("parses attributes with default attrkey=$", async () => {
    const xml = '<item id="42">text</item>';
    const result = await parse(xml);
    expect(result).toEqual({
      item: [{ $: { id: "42" }, _: "text" }],
    });
  });

  it("wraps children in arrays with explicitArray=true (default)", async () => {
    const xml = "<root><a>1</a></root>";
    const result = await parse(xml);
    // root is wrapped in array, and a is wrapped in array
    expect(result).toEqual({ root: [{ a: ["1"] }] });
  });

  it("does not wrap in arrays with explicitArray=false", async () => {
    const xml = "<root><a>1</a></root>";
    const result = await parse(xml, { explicitArray: false });
    expect(result).toEqual({ root: { a: "1" } });
  });

  it("wraps result in root key with explicitRoot=true (default)", async () => {
    const xml = "<root>hello</root>";
    const result = await parse(xml);
    expect(result).toHaveProperty("root");
  });

  it("omits root key with explicitRoot=false", async () => {
    const xml = "<root>hello</root>";
    const result = await parse(xml, { explicitRoot: false });
    expect(result).toBe("hello");
  });

  it("handles empty elements with emptyTag default", async () => {
    const xml = "<root><empty/></root>";
    const result = await parse(xml);
    expect(result).toEqual({ root: [{ empty: [""] }] });
  });

  it("handles custom emptyTag value", async () => {
    const xml = "<root><empty/></root>";
    const result = await parse(xml, { emptyTag: null });
    expect(result).toEqual({ root: [{ empty: [null] }] });
  });

  it("handles multiple children with same name", async () => {
    const xml = "<root><item>a</item><item>b</item></root>";
    const result = await parse(xml);
    expect(result).toEqual({ root: [{ item: ["a", "b"] }] });
  });

  it("handles mixed text and child elements", async () => {
    const xml = "<root>text<child>inner</child></root>";
    const result = await parse(xml);
    // text gets charkey, child gets array
    expect(result).toEqual({
      root: [{ _: "text", child: ["inner"] }],
    });
  });
});

describe("Parser — attribute handling", () => {
  it("ignores attributes with ignoreAttrs=true", async () => {
    const xml = '<item id="1" class="x">text</item>';
    const result = await parse(xml, { ignoreAttrs: true });
    expect(result).toEqual({ item: ["text"] });
  });

  it("merges attributes with mergeAttrs=true", async () => {
    const xml = '<item id="1">text</item>';
    const result = await parse(xml, { mergeAttrs: true });
    // id merged into element, text gets charkey
    expect(result).toEqual({
      item: [{ id: ["1"], _: "text" }],
    });
  });

  it("custom attrkey", async () => {
    const xml = '<item id="42"/>';
    const result = await parse(xml, { attrkey: "@" });
    expect(result).toEqual({
      item: [{ "@": { id: "42" } }],
    });
  });
});

describe("Parser — text processing", () => {
  it("trims text with trim=true", async () => {
    const xml = "<root>  hello  </root>";
    const result = await parse(xml, { trim: true });
    expect(result).toEqual({ root: ["hello"] });
  });

  it("normalizes whitespace with normalize=true", async () => {
    const xml = "<root>  hello   world  </root>";
    const result = await parse(xml, { normalize: true });
    // Collapsed but not trimmed by default
    expect(result).toEqual({ root: [" hello world "] });
  });

  it("trim + normalize together", async () => {
    const xml = "<root>  hello   world  </root>";
    const result = await parse(xml, { trim: true, normalize: true });
    expect(result).toEqual({ root: ["hello world"] });
  });

  it("uses charkey for text when explicitCharkey=true", async () => {
    const xml = "<root>hello</root>";
    const result = await parse(xml, { explicitCharkey: true });
    expect(result).toEqual({ root: [{ _: "hello" }] });
  });

  it("custom charkey", async () => {
    const xml = '<item id="1">text</item>';
    const result = await parse(xml, { charkey: "#text" });
    expect(result).toEqual({
      item: [{ $: { id: "1" }, "#text": "text" }],
    });
  });
});

describe("Parser — tag name processing", () => {
  it("lowercases tag names with normalizeTags=true", async () => {
    const xml = "<Root><Child>text</Child></Root>";
    const result = await parse(xml, { normalizeTags: true });
    expect(result).toEqual({ root: [{ child: ["text"] }] });
  });

  it("applies tagNameProcessors", async () => {
    const xml = "<ns:root><ns:item>text</ns:item></ns:root>";
    const stripPrefix = (name: string) => name.replace(/^.*:/, "");
    const result = await parse(xml, {
      tagNameProcessors: [stripPrefix],
      strict: false,
    });
    expect(result).toEqual({ root: [{ item: ["text"] }] });
  });

  it("applies attrNameProcessors", async () => {
    const xml = '<item MyAttr="val"/>';
    const lower = (name: string) => name.toLowerCase();
    const result = await parse(xml, { attrNameProcessors: [lower] });
    expect(result).toEqual({ item: [{ $: { myattr: "val" } }] });
  });

  it("applies attrValueProcessors", async () => {
    const xml = '<item count="42"/>';
    const parseNum = (val: string) => {
      const n = Number(val);
      return isNaN(n) ? val : String(n);
    };
    const result = await parse(xml, { attrValueProcessors: [parseNum] });
    expect(result).toEqual({ item: [{ $: { count: "42" } }] });
  });

  it("applies valueProcessors to text", async () => {
    const xml = "<root>42</root>";
    const parseNum = (val: string) => {
      const n = Number(val);
      return isNaN(n) ? val : String(n);
    };
    const result = await parse(xml, { valueProcessors: [parseNum] });
    expect(result).toEqual({ root: ["42"] });
  });
});

describe("Parser — security", () => {
  it("blocks __proto__ tag names by default", async () => {
    const xml = "<root><__proto__>evil</__proto__></root>";
    const result = await parse(xml);
    const root = (result as Record<string, unknown[]>)?.root?.[0];
    expect(root).toBeDefined();
    expect(root).not.toHaveProperty("__proto__");
  });

  it("allows __proto__ with allowDangerousKeys=true", async () => {
    const xml = "<root><__proto__>evil</__proto__></root>";
    const result = await parse(xml, { allowDangerousKeys: true });
    const root = (result as Record<string, unknown[]>)?.root?.[0];
    expect(root).toHaveProperty("__proto__");
  });

  it("blocks constructor attribute names by default", async () => {
    const xml = '<root constructor="bad"/>';
    const result = await parse(xml);
    const root = (result as Record<string, unknown[]>)?.root?.[0];
    const attrs = (root as Record<string, unknown>)?.$;
    expect(attrs).not.toHaveProperty("constructor");
  });
});

describe("Parser — parseStringPromise", () => {
  it("returns a promise", async () => {
    const parser = new Parser();
    const result = await parser.parseStringPromise("<root>hello</root>");
    expect(result).toEqual({ root: ["hello"] });
  });

  it("rejects on malformed XML in strict mode", async () => {
    const parser = new Parser({ strict: true });
    await expect(
      parser.parseStringPromise("<root><unclosed>"),
    ).rejects.toThrow();
  });
});

describe("Parser — reset", () => {
  it("allows reuse after reset", async () => {
    const parser = new Parser();
    const r1 = await parser.parseStringPromise("<a>1</a>");
    expect(r1).toEqual({ a: ["1"] });

    parser.reset();
    const r2 = await parser.parseStringPromise("<b>2</b>");
    expect(r2).toEqual({ b: ["2"] });
  });
});

describe("Parser — validator", () => {
  it("calls validator with xpath", async () => {
    const xpaths: string[] = [];
    const validator = (xpath: string, _cur: unknown, val: unknown) => {
      xpaths.push(xpath);
      return val;
    };
    await parse("<root><a>1</a></root>", { validator });
    expect(xpaths).toContain("/root/a");
  });

  it("emits error on ValidationError", async () => {
    const validator = () => {
      throw new ValidationError("invalid");
    };
    const parser = new Parser({ validator });
    const errors: Error[] = [];
    parser.on("error", (err: Error) => errors.push(err));
    parser.parseString("<root><a>1</a></root>");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toBeInstanceOf(ValidationError);
  });
});

describe("Parser — async mode", () => {
  it("parses asynchronously with async=true", async () => {
    const result = await parse("<root>async</root>", { async: true });
    expect(result).toEqual({ root: ["async"] });
  });
});

describe("Parser — CDATA handling", () => {
  it("treats CDATA as text content", async () => {
    const xml = "<root><![CDATA[hello <world>]]></root>";
    const result = await parse(xml);
    expect(result).toEqual({ root: ["hello <world>"] });
  });
});

describe("Defaults", () => {
  it("v0.2 defaults have explicitArray=true", () => {
    expect(DEFAULTS_0_2.explicitArray).toBe(true);
    expect(DEFAULTS_0_2.explicitRoot).toBe(true);
  });

  it("v0.1 defaults have explicitArray=false", () => {
    expect(DEFAULTS_0_1.explicitArray).toBe(false);
    expect(DEFAULTS_0_1.explicitRoot).toBe(false);
  });
});

describe("ValidationError", () => {
  it("extends Error", () => {
    const err = new ValidationError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ValidationError");
    expect(err.message).toBe("test");
  });
});
