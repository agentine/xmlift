import { describe, it, expect } from "vitest";
import { Builder } from "./builder.js";
import { escapeXML, wrapCDATA, needsEscape } from "./escape.js";
import { parseStringPromise } from "../index.js";

describe("escapeXML", () => {
  it("escapes &, <, >, quote, apos", () => {
    expect(escapeXML('a&b<c>d"e\'f')).toBe(
      "a&amp;b&lt;c&gt;d&quot;e&apos;f",
    );
  });

  it("returns clean strings unchanged", () => {
    expect(escapeXML("hello world")).toBe("hello world");
  });
});

describe("wrapCDATA", () => {
  it("wraps simple text", () => {
    expect(wrapCDATA("hello")).toBe("<![CDATA[hello]]>");
  });

  it("splits on ]]>", () => {
    const result = wrapCDATA("a]]>b");
    expect(result).not.toContain("]]>b");
    // Splits: "a" → <![CDATA[a]]]]>, then ">" starts new section, then "b" in final
    expect(result).toBe("<![CDATA[a]]]]><![CDATA[><![CDATA[b]]>");
  });
});

describe("needsEscape", () => {
  it("returns true for strings with special chars", () => {
    expect(needsEscape("a&b")).toBe(true);
    expect(needsEscape("a<b")).toBe(true);
  });

  it("returns false for clean strings", () => {
    expect(needsEscape("hello")).toBe(false);
  });
});

describe("Builder — basic", () => {
  it("builds simple XML with declaration", () => {
    const builder = new Builder();
    const xml = builder.buildObject({ root: "hello" });
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<root>hello</root>");
  });

  it("builds headless XML", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({ root: "hello" });
    expect(xml).not.toContain("<?xml");
    expect(xml).toContain("<root>hello</root>");
  });

  it("auto-detects root name from single key", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({ myRoot: "text" });
    expect(xml).toContain("<myRoot>text</myRoot>");
  });

  it("uses rootName when multiple keys", () => {
    const builder = new Builder({ headless: true, rootName: "data" });
    const xml = builder.buildObject({ a: "1", b: "2" });
    expect(xml).toContain("<data>");
    expect(xml).toContain("<a>1</a>");
    expect(xml).toContain("<b>2</b>");
    expect(xml).toContain("</data>");
  });
});

describe("Builder — attributes", () => {
  it("renders attributes from $ key", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({
      item: { $: { id: "42", class: "main" }, _: "text" },
    });
    expect(xml).toContain('id="42"');
    expect(xml).toContain('class="main"');
    expect(xml).toContain("text");
  });

  it("escapes attribute values", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({
      item: { $: { title: 'a "b" c' } },
    });
    expect(xml).toContain("&quot;");
  });

  it("custom attrkey", () => {
    const builder = new Builder({ headless: true, attrkey: "@" });
    const xml = builder.buildObject({
      item: { "@": { id: "1" }, _: "text" },
    });
    expect(xml).toContain('id="1"');
  });
});

describe("Builder — nested elements", () => {
  it("renders nested children", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({
      root: { a: { b: "deep" } },
    });
    expect(xml).toContain("<a>");
    expect(xml).toContain("<b>deep</b>");
    expect(xml).toContain("</a>");
  });

  it("renders arrays as repeated elements", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({
      root: { item: ["a", "b", "c"] },
    });
    expect(xml).toContain("<item>a</item>");
    expect(xml).toContain("<item>b</item>");
    expect(xml).toContain("<item>c</item>");
  });
});

describe("Builder — CDATA", () => {
  it("wraps text in CDATA when cdata=true and text needs escaping", () => {
    const builder = new Builder({ headless: true, cdata: true });
    const xml = builder.buildObject({ root: "a<b>c" });
    expect(xml).toContain("<![CDATA[");
    expect(xml).not.toContain("&lt;");
  });

  it("does not use CDATA for clean text", () => {
    const builder = new Builder({ headless: true, cdata: true });
    const xml = builder.buildObject({ root: "hello" });
    expect(xml).not.toContain("<![CDATA[");
    expect(xml).toContain("hello");
  });
});

describe("Builder — formatting", () => {
  it("pretty prints by default", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({ root: { a: "1" } });
    expect(xml).toContain("\n");
    expect(xml).toContain("  <a>");
  });

  it("compact output with pretty=false", () => {
    const builder = new Builder({
      headless: true,
      renderOpts: { pretty: false },
    });
    const xml = builder.buildObject({ root: { a: "1" } });
    expect(xml).not.toContain("\n");
    expect(xml).toContain("<root><a>1</a></root>");
  });

  it("custom indent and newline", () => {
    const builder = new Builder({
      headless: true,
      renderOpts: { pretty: true, indent: "\t", newline: "\r\n" },
    });
    const xml = builder.buildObject({ root: { a: "1" } });
    expect(xml).toContain("\t<a>");
    expect(xml).toContain("\r\n");
  });
});

describe("Builder — doctype", () => {
  it("includes DOCTYPE when set", () => {
    const builder = new Builder({
      doctype: 'root SYSTEM "root.dtd"',
    });
    const xml = builder.buildObject({ root: "text" });
    expect(xml).toContain('<!DOCTYPE root SYSTEM "root.dtd">');
  });
});

describe("Builder — null/undefined values", () => {
  it("renders self-closing tag for null", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({ root: { empty: null } });
    expect(xml).toContain("<empty/>");
  });
});

describe("Builder — xml declaration options", () => {
  it("custom encoding", () => {
    const builder = new Builder({
      xmldec: { version: "1.0", encoding: "ISO-8859-1" },
    });
    const xml = builder.buildObject({ root: "text" });
    expect(xml).toContain('encoding="ISO-8859-1"');
  });

  it("standalone=false", () => {
    const builder = new Builder({
      xmldec: { version: "1.0", standalone: false },
    });
    const xml = builder.buildObject({ root: "text" });
    expect(xml).toContain('standalone="no"');
  });
});

describe("Builder — round-trip with Parser", () => {
  it("parse → build produces valid XML", async () => {
    const xml = '<root id="1"><child>text</child></root>';
    const parsed = await parseStringPromise(xml);
    const builder = new Builder({ headless: true });
    const rebuilt = builder.buildObject(parsed as Record<string, unknown>);
    expect(rebuilt).toContain("<root");
    expect(rebuilt).toContain('id="1"');
    expect(rebuilt).toContain("<child>text</child>");
  });

  it("parse → build → parse round-trip", async () => {
    const xml = "<items><item>a</item><item>b</item></items>";
    const parsed1 = await parseStringPromise(xml);
    const builder = new Builder({ headless: true, renderOpts: { pretty: false } });
    const rebuilt = builder.buildObject(parsed1 as Record<string, unknown>);
    const parsed2 = await parseStringPromise(rebuilt);
    expect(parsed2).toEqual(parsed1);
  });
});
