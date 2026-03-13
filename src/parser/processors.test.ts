import { describe, it, expect } from "vitest";
import {
  normalize,
  firstCharLowerCase,
  stripPrefix,
  parseNumbers,
  parseBooleans,
} from "./processors.js";
import { Parser } from "./parser.js";

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

describe("Built-in processors", () => {
  describe("normalize", () => {
    it("lowercases a string", () => {
      expect(normalize("Hello World")).toBe("hello world");
    });

    it("handles empty string", () => {
      expect(normalize("")).toBe("");
    });

    it("handles already lowercase", () => {
      expect(normalize("abc")).toBe("abc");
    });
  });

  describe("firstCharLowerCase", () => {
    it("lowercases first character", () => {
      expect(firstCharLowerCase("Hello")).toBe("hello");
    });

    it("handles single character", () => {
      expect(firstCharLowerCase("A")).toBe("a");
    });

    it("handles empty string", () => {
      expect(firstCharLowerCase("")).toBe("");
    });

    it("preserves rest of string", () => {
      expect(firstCharLowerCase("FooBar")).toBe("fooBar");
    });
  });

  describe("stripPrefix", () => {
    it("removes namespace prefix", () => {
      expect(stripPrefix("ns:element")).toBe("element");
    });

    it("returns original when no prefix", () => {
      expect(stripPrefix("element")).toBe("element");
    });

    it("handles multiple colons", () => {
      expect(stripPrefix("a:b:c")).toBe("b:c");
    });
  });

  describe("parseNumbers", () => {
    it("converts integer strings", () => {
      expect(parseNumbers("42")).toBe(42);
    });

    it("converts float strings", () => {
      expect(parseNumbers("3.14")).toBe(3.14);
    });

    it("converts negative numbers", () => {
      expect(parseNumbers("-7")).toBe(-7);
    });

    it("returns original for non-numeric strings", () => {
      expect(parseNumbers("hello")).toBe("hello");
    });

    it("returns original for whitespace-only", () => {
      expect(parseNumbers("  ")).toBe("  ");
    });

    it("returns original for empty string", () => {
      expect(parseNumbers("")).toBe("");
    });
  });

  describe("parseBooleans", () => {
    it("converts 'true' to true", () => {
      expect(parseBooleans("true")).toBe(true);
    });

    it("converts 'false' to false", () => {
      expect(parseBooleans("false")).toBe(false);
    });

    it("case insensitive", () => {
      expect(parseBooleans("TRUE")).toBe(true);
      expect(parseBooleans("False")).toBe(false);
    });

    it("returns original for non-boolean strings", () => {
      expect(parseBooleans("yes")).toBe("yes");
      expect(parseBooleans("1")).toBe("1");
    });
  });
});

describe("Parser — explicitChildren", () => {
  it("separates children from attributes", async () => {
    const xml = '<root><a id="1">text</a><b>more</b></root>';
    const result = await parse(xml, { explicitChildren: true });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    // Children stored under childkey
    expect(root).toHaveProperty("$$");
    expect(root.$$).toBeInstanceOf(Array);
  });

  it("preserves child order with preserveChildrenOrder", async () => {
    const xml = "<root><b>1</b><a>2</a><b>3</b></root>";
    const result = await parse(xml, {
      explicitChildren: true,
      preserveChildrenOrder: true,
    });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    const children = root.$$ as Record<string, unknown>[];
    expect(children).toHaveLength(3);
    expect(children[0]["#name"]).toBe("b");
    expect(children[1]["#name"]).toBe("a");
    expect(children[2]["#name"]).toBe("b");
  });

  it("custom childkey", async () => {
    const xml = "<root><a>1</a></root>";
    const result = await parse(xml, {
      explicitChildren: true,
      childkey: "children",
    });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    expect(root).toHaveProperty("children");
  });
});

describe("Parser — charsAsChildren", () => {
  it("treats text nodes as children", async () => {
    const xml = "<root>hello<child>world</child></root>";
    const result = await parse(xml, {
      explicitChildren: true,
      charsAsChildren: true,
    });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    const children = root.$$ as Record<string, unknown>[];
    // Should have text node and element node
    expect(children.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Parser — includeWhiteChars", () => {
  it("excludes whitespace-only text by default", async () => {
    const xml = "<root>  <child>text</child>  </root>";
    const result = await parse(xml, { trim: true });
    const root = (result as Record<string, unknown[]>).root[0] as Record<
      string,
      unknown
    >;
    // Whitespace-only text should not appear
    expect(root).not.toHaveProperty("_");
  });
});

describe("Parser — processors integration", () => {
  it("uses normalize processor on tag names", async () => {
    const xml = "<ROOT><CHILD>text</CHILD></ROOT>";
    const result = await parse(xml, { tagNameProcessors: [normalize] });
    expect(result).toEqual({ root: [{ child: ["text"] }] });
  });

  it("uses firstCharLowerCase processor", async () => {
    const xml = "<Root><ChildElement>text</ChildElement></Root>";
    const result = await parse(xml, {
      tagNameProcessors: [firstCharLowerCase],
    });
    expect(result).toEqual({ root: [{ childElement: ["text"] }] });
  });

  it("uses stripPrefix processor", async () => {
    const xml = "<ns:root><ns:item>text</ns:item></ns:root>";
    const result = await parse(xml, {
      tagNameProcessors: [stripPrefix],
      strict: false,
    });
    expect(result).toEqual({ root: [{ item: ["text"] }] });
  });

  it("chains multiple processors", async () => {
    const xml = "<NS:MyTag>text</NS:MyTag>";
    const result = await parse(xml, {
      tagNameProcessors: [stripPrefix, firstCharLowerCase],
      strict: false,
    });
    expect(result).toEqual({ myTag: ["text"] });
  });
});
