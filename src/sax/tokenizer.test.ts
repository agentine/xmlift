import { describe, it, expect } from "vitest";
import { Tokenizer, TokenType, type Token } from "./tokenizer.js";

function tokenize(xml: string, strict = true): Token[] {
  const tokens: Token[] = [];
  const t = new Tokenizer((tok) => tokens.push(tok), { strict });
  t.feed(xml);
  t.close();
  return tokens;
}

describe("Tokenizer", () => {
  it("tokenizes a simple element", () => {
    const tokens = tokenize("<hello/>");
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe(TokenType.OpenTag);
    expect(tokens[0].name).toBe("hello");
    expect(tokens[1].type).toBe(TokenType.SelfCloseTag);
  });

  it("tokenizes open and close tags", () => {
    const tokens = tokenize("<a></a>");
    const types = tokens.map((t) => t.type);
    expect(types).toEqual([TokenType.OpenTag, TokenType.CloseTag]);
    expect(tokens[0].name).toBe("a");
    expect(tokens[1].name).toBe("a");
  });

  it("tokenizes text content", () => {
    const tokens = tokenize("<a>hello world</a>");
    expect(tokens[1].type).toBe(TokenType.Text);
    expect(tokens[1].value).toBe("hello world");
  });

  it("tokenizes attributes", () => {
    const tokens = tokenize('<a x="1" y="2"/>');
    const attrs = tokens.filter((t) => t.type === TokenType.Attribute);
    expect(attrs).toHaveLength(2);
    expect(attrs[0].name).toBe("x");
    expect(attrs[0].value).toBe("1");
    expect(attrs[1].name).toBe("y");
    expect(attrs[1].value).toBe("2");
  });

  it("tokenizes single-quoted attributes", () => {
    const tokens = tokenize("<a x='val'/>");
    const attr = tokens.find((t) => t.type === TokenType.Attribute)!;
    expect(attr.name).toBe("x");
    expect(attr.value).toBe("val");
  });

  it("tokenizes CDATA sections", () => {
    const tokens = tokenize("<a><![CDATA[raw <data>]]></a>");
    const cdata = tokens.find((t) => t.type === TokenType.CDATA)!;
    expect(cdata.value).toBe("raw <data>");
  });

  it("tokenizes comments", () => {
    const tokens = tokenize("<a><!-- a comment --></a>");
    const comment = tokens.find((t) => t.type === TokenType.Comment)!;
    expect(comment.value).toBe(" a comment ");
  });

  it("tokenizes processing instructions", () => {
    const tokens = tokenize('<?xml version="1.0"?>');
    const pi = tokens.find(
      (t) => t.type === TokenType.ProcessingInstruction
    )!;
    expect(pi.name).toBe("xml");
    expect(pi.value).toBe('version="1.0"');
  });

  it("tokenizes DOCTYPE without internal subset", () => {
    const tokens = tokenize("<!DOCTYPE html>");
    const dt = tokens.find((t) => t.type === TokenType.DocType)!;
    expect(dt.value).toBe("html");
  });

  it("tokenizes DOCTYPE with nested brackets", () => {
    const xml =
      '<!DOCTYPE root [ <!ELEMENT root (#PCDATA)> <!ATTLIST root id CDATA ""> ]>';
    const tokens = tokenize(xml);
    const dt = tokens.find((t) => t.type === TokenType.DocType)!;
    expect(dt.value).toContain("<!ELEMENT root");
    expect(dt.value).toContain("<!ATTLIST root");
    // The '>' inside [...] should NOT terminate the DOCTYPE
    expect(dt.value).toContain("]");
  });

  it("handles nested elements", () => {
    const tokens = tokenize("<a><b><c/></b></a>");
    const opens = tokens.filter((t) => t.type === TokenType.OpenTag);
    const closes = tokens.filter(
      (t) =>
        t.type === TokenType.CloseTag || t.type === TokenType.SelfCloseTag
    );
    expect(opens).toHaveLength(3);
    expect(closes).toHaveLength(3);
  });

  it("tracks position (line, column, offset)", () => {
    const tokens = tokenize("<a>\n<b/>\n</a>");
    // <a> is at line 1
    expect(tokens[0].position.line).toBe(1);
    // <b/> is at line 2
    const openB = tokens.find(
      (t) => t.type === TokenType.OpenTag && t.name === "b"
    )!;
    expect(openB.position.line).toBe(2);
  });

  it("tokenizes chunked input correctly", () => {
    const tokens: Token[] = [];
    const t = new Tokenizer((tok) => tokens.push(tok), { strict: true });
    t.feed("<hel");
    t.feed("lo ");
    t.feed('x="');
    t.feed('1"/');
    t.feed(">");
    t.close();
    expect(tokens[0].type).toBe(TokenType.OpenTag);
    expect(tokens[0].name).toBe("hello");
    const attr = tokens.find((t) => t.type === TokenType.Attribute)!;
    expect(attr.name).toBe("x");
    expect(attr.value).toBe("1");
  });

  it("handles empty text between tags", () => {
    const tokens = tokenize("<a></a>");
    const texts = tokens.filter((t) => t.type === TokenType.Text);
    expect(texts).toHaveLength(0);
  });

  it("lenient mode allows unquoted attributes", () => {
    const tokens = tokenize("<a x=hello/>", false);
    const attr = tokens.find((t) => t.type === TokenType.Attribute)!;
    expect(attr.name).toBe("x");
    expect(attr.value).toBe("hello");
  });

  it("handles supplementary-plane characters in tag names", () => {
    // U+10000 (Linear B Syllable B008 A) is a valid NameStartChar
    const name = "\u{10000}";
    const tokens = tokenize(`<${name}/>`);
    expect(tokens[0].type).toBe(TokenType.OpenTag);
    expect(tokens[0].name).toBe(name);
  });

  it("tracks position correctly across newlines", () => {
    const tokens = tokenize("<a>\ntext\n<b/>\n</a>");
    // <a> at line 1, col 1
    expect(tokens[0].position).toEqual({ line: 1, column: 1, offset: 0 });
    // text starts with \n at end of line 1
    const text = tokens.find((t) => t.type === TokenType.Text)!;
    expect(text.position.line).toBe(1);
    // <b/> at line 3, col 1
    const openB = tokens.find(
      (t) => t.type === TokenType.OpenTag && t.name === "b"
    )!;
    expect(openB.position).toEqual({ line: 3, column: 1, offset: 9 });
    // </a> at line 4, col 1
    const closeA = tokens.find(
      (t) => t.type === TokenType.CloseTag && t.name === "a"
    )!;
    expect(closeA.position).toEqual({ line: 4, column: 1, offset: 14 });
  });
});
