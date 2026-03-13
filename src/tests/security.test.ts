/**
 * Security tests — prototype pollution, entity bombs, depth limits, BOM.
 */
import { describe, it, expect } from "vitest";
import {
  parseStringPromise,
  SaxParser,
  stripBOM,
} from "../index.js";

// ---------------------------------------------------------------------------
// Prototype pollution
// ---------------------------------------------------------------------------

describe("Security — prototype pollution", () => {
  it("blocks __proto__ as tag name", async () => {
    const xml = "<root><__proto__><polluted>yes</polluted></__proto__></root>";
    const result = (await parseStringPromise(xml)) as Record<string, unknown>;
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).not.toHaveProperty("__proto__");
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("blocks constructor as tag name", async () => {
    const xml = "<root><constructor>evil</constructor></root>";
    const result = (await parseStringPromise(xml)) as Record<string, unknown>;
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).not.toHaveProperty("constructor");
  });

  it("blocks prototype as tag name", async () => {
    const xml = "<root><prototype>evil</prototype></root>";
    const result = (await parseStringPromise(xml)) as Record<string, unknown>;
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).not.toHaveProperty("prototype");
  });

  it("blocks __proto__ as attribute name", async () => {
    const xml = '<root __proto__="evil">text</root>';
    const result = (await parseStringPromise(xml)) as Record<string, unknown>;
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    const attrs = root["$"] as Record<string, unknown> | undefined;
    if (attrs) {
      expect(attrs).not.toHaveProperty("__proto__");
    }
  });

  it("allows dangerous keys when allowDangerousKeys=true", async () => {
    const xml = "<root><__proto__>val</__proto__></root>";
    const result = (await parseStringPromise(xml, {
      allowDangerousKeys: true,
    })) as Record<string, unknown>;
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("__proto__");
  });
});

// ---------------------------------------------------------------------------
// Entity expansion limits
// ---------------------------------------------------------------------------

describe("Security — entity expansion", () => {
  it("respects maxEntityExpansions", () => {
    // Build an input with many entity references
    const entities = Array.from({ length: 50 }, () => "&amp;").join("");
    const xml = `<root>${entities}</root>`;
    const sax = new SaxParser({
      maxEntityExpansions: 10,
    });
    let errorEmitted = false;
    sax.on("error", () => {
      errorEmitted = true;
    });
    sax.feed(xml);
    sax.close();
    expect(errorEmitted).toBe(true);
  });

  it("allows normal entity count", async () => {
    const xml = "<root>a&amp;b&lt;c&gt;d</root>";
    const result = await parseStringPromise(xml);
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Max depth enforcement
// ---------------------------------------------------------------------------

describe("Security — max depth", () => {
  it("rejects deeply nested XML", () => {
    // Build XML nested 250 levels deep
    let xml = "";
    for (let i = 0; i < 250; i++) xml += `<l${i}>`;
    xml += "text";
    for (let i = 249; i >= 0; i--) xml += `</l${i}>`;

    const sax = new SaxParser({ maxDepth: 200 });
    const errors: string[] = [];
    sax.on("error", (err: Error) => {
      errors.push(err.message);
    });
    sax.feed(xml);
    sax.close();
    // First error should be the depth exceeded error
    expect(errors.some((m) => m.includes("Maximum XML depth exceeded"))).toBe(
      true,
    );
  });

  it("allows XML within depth limit", async () => {
    let xml = "";
    for (let i = 0; i < 10; i++) xml += `<l${i}>`;
    xml += "text";
    for (let i = 9; i >= 0; i--) xml += `</l${i}>`;

    const result = await parseStringPromise(xml);
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// BOM handling
// ---------------------------------------------------------------------------

describe("Security — BOM variants", () => {
  it("strips UTF-8 BOM", () => {
    const bom = "\uFEFF";
    expect(stripBOM(bom + "hello")).toBe("hello");
  });

  it("parses XML with BOM prefix", async () => {
    const xml = "\uFEFF<root>text</root>";
    const result = await parseStringPromise(xml);
    expect(result).toBeDefined();
    const root = (result as Record<string, unknown[]>).root;
    expect(root).toEqual(["text"]);
  });

  it("handles no BOM", () => {
    expect(stripBOM("hello")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(stripBOM("")).toBe("");
  });
});
