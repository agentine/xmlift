/**
 * Edge-case tests — empty docs, whitespace, Unicode, CDATA, comments, PIs,
 * malformed XML in lenient mode, large documents.
 */
import { describe, it, expect } from "vitest";
import { parseStringPromise, SaxParser } from "../index.js";
import { Builder } from "../builder/builder.js";

// ---------------------------------------------------------------------------
// Empty / whitespace documents
// ---------------------------------------------------------------------------

describe("Edge — empty and whitespace documents", () => {
  it("rejects empty string", async () => {
    await expect(parseStringPromise("")).rejects.toThrow();
  });

  it("rejects whitespace-only string", async () => {
    await expect(parseStringPromise("   \n\t  ")).rejects.toThrow();
  });

  it("parses minimal self-closing element", async () => {
    const result = await parseStringPromise("<r/>");
    const root = (result as Record<string, unknown[]>).r;
    expect(root).toEqual([""]);
  });
});

// ---------------------------------------------------------------------------
// Unicode content
// ---------------------------------------------------------------------------

describe("Edge — Unicode", () => {
  it("handles CJK characters", async () => {
    const xml = "<root>日本語テスト</root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe("日本語テスト");
  });

  it("handles emoji", async () => {
    const xml = "<root>Hello 🌍🎉</root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe("Hello 🌍🎉");
  });

  it("handles numeric character references", async () => {
    const xml = "<root>&#65;&#x42;</root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe("AB");
  });

  it("handles supplementary plane characters via numeric refs", async () => {
    // U+1F600 = 😀
    const xml = "<root>&#x1F600;</root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe("😀");
  });
});

// ---------------------------------------------------------------------------
// CDATA
// ---------------------------------------------------------------------------

describe("Edge — CDATA", () => {
  it("preserves CDATA content", async () => {
    const xml = "<root><![CDATA[<not>xml</not>]]></root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe(
      "<not>xml</not>",
    );
  });

  it("handles empty CDATA", async () => {
    const xml = "<root><![CDATA[]]></root>";
    const result = await parseStringPromise(xml);
    expect(result).toBeDefined();
  });

  it("handles CDATA with special chars", async () => {
    const xml = '<root><![CDATA[a & b < c > d " e \' f]]></root>';
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe(
      "a & b < c > d \" e ' f",
    );
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("Edge — comments", () => {
  it("ignores comments in parsed output", async () => {
    const xml = "<root><!-- this is a comment -->text</root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe("text");
  });

  it("handles multiple comments", async () => {
    const xml =
      "<!-- before --><root><!-- mid -->text<!-- end --></root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// Processing instructions
// ---------------------------------------------------------------------------

describe("Edge — processing instructions", () => {
  it("SAX emits PI events", () => {
    const xml = '<?xml version="1.0"?><root><?mypi data?></root>';
    const sax = new SaxParser();
    const pis: { name: string; body: string }[] = [];
    sax.on("processinginstruction", (pi: { name: string; body: string }) => {
      pis.push(pi);
    });
    sax.feed(xml);
    sax.close();
    // First PI is xml declaration, second is mypi
    expect(pis.some((pi) => pi.name === "mypi")).toBe(true);
  });

  it("PIs do not appear in parsed tree", async () => {
    const xml = "<root><?mypi data?>text</root>";
    const result = await parseStringPromise(xml);
    expect((result as Record<string, string[]>).root[0]).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// Malformed XML — lenient mode
// ---------------------------------------------------------------------------

describe("Edge — lenient mode (strict=false)", () => {
  it("SAX parses unclosed tags without emitting error", () => {
    const xml = "<root><unclosed>text</root>";
    const sax = new SaxParser({ strict: false });
    let hadError = false;
    sax.on("error", () => {
      hadError = true;
    });
    sax.feed(xml);
    sax.close();
    // Lenient SAX parser suppresses errors
    expect(hadError).toBe(false);
  });

  it("handles mismatched case in tag names", async () => {
    const xml = "<Root>text</Root>";
    const result = await parseStringPromise(xml, { strict: false });
    expect(result).toBeDefined();
  });

  it("handles unquoted attribute values", async () => {
    const xml = "<root attr=value>text</root>";
    const result = await parseStringPromise(xml, { strict: false });
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Large documents
// ---------------------------------------------------------------------------

describe("Edge — large documents", () => {
  it("parses document with many elements", async () => {
    const items = Array.from(
      { length: 1000 },
      (_, i) => `<item id="${i}">${i}</item>`,
    ).join("");
    const xml = `<root>${items}</root>`;
    const result = await parseStringPromise(xml);
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown[]
    >;
    expect(root.item).toHaveLength(1000);
  });

  it("parses document with deeply nested structure", async () => {
    let xml = "";
    for (let i = 0; i < 50; i++) xml += `<l${i}>`;
    xml += "deep";
    for (let i = 49; i >= 0; i--) xml += `</l${i}>`;
    const result = await parseStringPromise(xml);
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Builder edge cases
// ---------------------------------------------------------------------------

describe("Edge — Builder", () => {
  it("builds empty object", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({});
    expect(xml).toContain("<root/>");
  });

  it("builds with boolean and number values", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({
      root: { flag: true, count: 42 },
    });
    expect(xml).toContain("<flag>true</flag>");
    expect(xml).toContain("<count>42</count>");
  });

  it("builds nested arrays of objects", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({
      root: {
        item: [
          { $: { id: "1" }, _: "first" },
          { $: { id: "2" }, _: "second" },
        ],
      },
    });
    expect(xml).toContain('id="1"');
    expect(xml).toContain('id="2"');
    expect(xml).toContain("first");
    expect(xml).toContain("second");
  });

  it("escapes special chars in text content", () => {
    const builder = new Builder({ headless: true });
    const xml = builder.buildObject({ root: 'a & b < c > d "e"' });
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
    expect(xml).toContain("&quot;");
  });
});
