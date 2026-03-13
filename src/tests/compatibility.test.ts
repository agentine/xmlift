/**
 * Compatibility tests — golden tests exercising parser option combinations
 * to verify xml2js-compatible output.
 */
import { describe, it, expect } from "vitest";
import { parseStringPromise } from "../index.js";
import { Builder } from "../builder/builder.js";

const SAMPLE_XML = '<root id="1"><child attr="v">text</child><child>more</child></root>';
const NESTED_XML = '<doc><section title="A"><para>Hello</para></section></doc>';

// ---------------------------------------------------------------------------
// Core option combinations
// ---------------------------------------------------------------------------

describe("Compat — explicitArray", () => {
  it("true (default): wraps all children in arrays", async () => {
    const result = await parseStringPromise(SAMPLE_XML);
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(Array.isArray(root.child)).toBe(true);
    expect((root.child as unknown[]).length).toBe(2);
  });

  it("false: single children are unwrapped", async () => {
    const result = await parseStringPromise(NESTED_XML, {
      explicitArray: false,
    });
    const doc = (result as Record<string, unknown>).doc as Record<
      string,
      unknown
    >;
    // section is single child — should not be array
    expect(Array.isArray(doc.section)).toBe(false);
  });
});

describe("Compat — explicitRoot", () => {
  it("true (default): result wrapped in root key", async () => {
    const result = await parseStringPromise("<r>text</r>");
    expect(result).toHaveProperty("r");
  });

  it("false: root element unwrapped", async () => {
    const result = await parseStringPromise("<r>text</r>", {
      explicitRoot: false,
    });
    // Simple text-only element is unwrapped to just the text value
    expect(result).toBe("text");
  });

  it("false + explicitArray false: just text", async () => {
    const result = await parseStringPromise("<r>text</r>", {
      explicitRoot: false,
      explicitArray: false,
    });
    expect(result).toBe("text");
  });
});

describe("Compat — ignoreAttrs", () => {
  it("true: attributes are dropped", async () => {
    const result = await parseStringPromise(SAMPLE_XML, {
      ignoreAttrs: true,
    });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).not.toHaveProperty("$");
  });

  it("false (default): attributes preserved under $", async () => {
    const result = await parseStringPromise(SAMPLE_XML);
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("$");
    expect((root["$"] as Record<string, unknown>).id).toBe("1");
  });
});

describe("Compat — mergeAttrs", () => {
  it("true: attributes merged into element", async () => {
    const xml = '<item id="42">text</item>';
    const result = await parseStringPromise(xml, { mergeAttrs: true });
    const item = (result as Record<string, unknown[]>).item[0] as Record<
      string,
      unknown
    >;
    expect(item).toHaveProperty("id");
    expect(item).not.toHaveProperty("$");
  });
});

describe("Compat — trim and normalize", () => {
  it("trim removes leading/trailing whitespace", async () => {
    const xml = "<root>  hello  </root>";
    const result = await parseStringPromise(xml, { trim: true });
    expect((result as Record<string, string[]>).root[0]).toBe("hello");
  });

  it("normalize collapses whitespace runs", async () => {
    const xml = "<root>hello   world</root>";
    const result = await parseStringPromise(xml, { normalize: true });
    expect((result as Record<string, string[]>).root[0]).toBe("hello world");
  });

  it("trim + normalize combined", async () => {
    const xml = "<root>  hello   world  </root>";
    const result = await parseStringPromise(xml, {
      trim: true,
      normalize: true,
    });
    expect((result as Record<string, string[]>).root[0]).toBe("hello world");
  });
});

describe("Compat — normalizeTags", () => {
  it("lowercases tag names", async () => {
    const xml = "<ROOT><CHILD>text</CHILD></ROOT>";
    const result = await parseStringPromise(xml, { normalizeTags: true });
    expect(result).toHaveProperty("root");
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("child");
  });
});

describe("Compat — explicitCharkey", () => {
  it("always uses charkey for text", async () => {
    const xml = '<item id="1">text</item>';
    const result = await parseStringPromise(xml, { explicitCharkey: true });
    const item = (result as Record<string, unknown[]>).item[0] as Record<
      string,
      unknown
    >;
    expect(item).toHaveProperty("_");
    expect(item["_"]).toBe("text");
  });
});

describe("Compat — emptyTag", () => {
  it("uses custom empty tag value", async () => {
    const xml = "<root><empty/></root>";
    const result = await parseStringPromise(xml, { emptyTag: null });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect((root.empty as unknown[])[0]).toBeNull();
  });

  it("default: empty string for empty elements", async () => {
    const xml = "<root><empty/></root>";
    const result = await parseStringPromise(xml);
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect((root.empty as unknown[])[0]).toBe("");
  });
});

describe("Compat — attrkey and charkey", () => {
  it("custom attrkey", async () => {
    const xml = '<root id="1">text</root>';
    const result = await parseStringPromise(xml, { attrkey: "@" });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("@");
    expect(root).not.toHaveProperty("$");
  });

  it("custom charkey", async () => {
    const xml = '<root id="1">text</root>';
    const result = await parseStringPromise(xml, {
      charkey: "text",
      explicitCharkey: true,
    });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("text");
  });
});

describe("Compat — xmlns", () => {
  it("includes namespace info when xmlns=true", async () => {
    const xml = '<root xmlns:ns="http://example.com"><ns:child>text</ns:child></root>';
    const result = await parseStringPromise(xml, { xmlns: true });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("$ns");
  });
});

// ---------------------------------------------------------------------------
// Builder compatibility
// ---------------------------------------------------------------------------

describe("Compat — Builder round-trip", () => {
  it("parse with default options → build → parse produces same result", async () => {
    const xml = '<root id="1"><child>text</child></root>';
    const parsed = await parseStringPromise(xml);
    const builder = new Builder({ renderOpts: { pretty: false } });
    const rebuilt = builder.buildObject(parsed as Record<string, unknown>);
    const reparsed = await parseStringPromise(rebuilt);
    expect(reparsed).toEqual(parsed);
  });

  it("Builder respects custom attrkey", async () => {
    const xml = '<item id="1">text</item>';
    const parsed = await parseStringPromise(xml, { attrkey: "@" });
    const builder = new Builder({
      headless: true,
      attrkey: "@",
      renderOpts: { pretty: false },
    });
    const rebuilt = builder.buildObject(parsed as Record<string, unknown>);
    expect(rebuilt).toContain('id="1"');
    expect(rebuilt).toContain("text");
  });

  it("Builder with multiple children round-trip", async () => {
    const xml = "<list><item>a</item><item>b</item><item>c</item></list>";
    const parsed = await parseStringPromise(xml);
    const builder = new Builder({
      headless: true,
      renderOpts: { pretty: false },
    });
    const rebuilt = builder.buildObject(parsed as Record<string, unknown>);
    const reparsed = await parseStringPromise(rebuilt);
    expect(reparsed).toEqual(parsed);
  });
});

// ---------------------------------------------------------------------------
// Combined option stress tests
// ---------------------------------------------------------------------------

describe("Compat — combined options", () => {
  it("explicitArray=false + mergeAttrs + normalizeTags", async () => {
    const xml = '<ROOT ID="1"><CHILD>text</CHILD></ROOT>';
    const result = await parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      normalizeTags: true,
    });
    const root = (result as Record<string, unknown>).root as Record<
      string,
      unknown
    >;
    // normalizeTags lowercases tag names but not attribute names
    expect(root.ID).toBe("1");
    expect(root.child).toBe("text");
  });

  it("explicitRoot=false + ignoreAttrs + trim", async () => {
    const xml = '<root id="1">  hello  </root>';
    const result = await parseStringPromise(xml, {
      explicitRoot: false,
      ignoreAttrs: true,
      trim: true,
    });
    // text-only element with explicitRoot=false gets unwrapped to just text
    expect(result).toBe("hello");
  });

  it("all processors combined", async () => {
    const xml = '<NS:Root ATTR="value">text</NS:Root>';
    const result = await parseStringPromise(xml, {
      normalizeTags: true,
      ignoreAttrs: true,
      explicitArray: false,
      explicitRoot: false,
      strict: false,
    });
    expect(result).toBe("text");
  });
});
