import { describe, it, expect } from "vitest";
import { SaxParser, type SaxTag } from "./parser.js";
import {
  NamespaceContext,
  getElementNS,
  getAttrNS,
} from "./namespaces.js";

describe("NamespaceContext", () => {
  it("resolves default namespace", () => {
    const ctx = new NamespaceContext();
    ctx.push();
    ctx.addNamespace("", "http://example.com");
    const ns = getElementNS("foo", ctx);
    expect(ns.uri).toBe("http://example.com");
    expect(ns.local).toBe("foo");
    expect(ns.prefix).toBe("");
  });

  it("resolves prefixed namespace", () => {
    const ctx = new NamespaceContext();
    ctx.push();
    ctx.addNamespace("ns", "http://ns.example.com");
    const ns = getElementNS("ns:bar", ctx);
    expect(ns.uri).toBe("http://ns.example.com");
    expect(ns.local).toBe("bar");
    expect(ns.prefix).toBe("ns");
  });

  it("pops namespace scope correctly", () => {
    const ctx = new NamespaceContext();
    ctx.push();
    ctx.addNamespace("", "http://outer.com");
    ctx.push();
    ctx.addNamespace("", "http://inner.com");
    expect(getElementNS("foo", ctx).uri).toBe("http://inner.com");
    ctx.pop();
    expect(getElementNS("foo", ctx).uri).toBe("http://outer.com");
  });

  it("unprefixed attributes have no namespace", () => {
    const ctx = new NamespaceContext();
    ctx.push();
    ctx.addNamespace("", "http://example.com");
    const ns = getAttrNS("id", ctx);
    expect(ns.uri).toBe("");
    expect(ns.local).toBe("id");
  });

  it("prefixed attributes resolve to namespace", () => {
    const ctx = new NamespaceContext();
    ctx.push();
    ctx.addNamespace("xlink", "http://www.w3.org/1999/xlink");
    const ns = getAttrNS("xlink:href", ctx);
    expect(ns.uri).toBe("http://www.w3.org/1999/xlink");
    expect(ns.local).toBe("href");
    expect(ns.prefix).toBe("xlink");
  });

  it("parseXmlnsAttr detects xmlns declarations", () => {
    expect(NamespaceContext.parseXmlnsAttr("xmlns")).toBe("");
    expect(NamespaceContext.parseXmlnsAttr("xmlns:foo")).toBe("foo");
    expect(NamespaceContext.parseXmlnsAttr("id")).toBeNull();
    expect(NamespaceContext.parseXmlnsAttr("xmlnsfoo")).toBeNull();
  });

  it("xml prefix is pre-bound", () => {
    const ctx = new NamespaceContext();
    const ns = getElementNS("xml:lang", ctx);
    expect(ns.uri).toBe("http://www.w3.org/XML/1998/namespace");
  });
});

describe("SaxParser with xmlns", () => {
  it("resolves element namespace", () => {
    const parser = new SaxParser({ xmlns: true });
    const tags: SaxTag[] = [];
    parser.on("opentag", (tag: SaxTag) => tags.push(tag));

    parser.feed('<root xmlns="http://example.com"><child/></root>');
    parser.close();

    expect(tags).toHaveLength(2);
    expect(tags[0].ns?.uri).toBe("http://example.com");
    expect(tags[1].ns?.uri).toBe("http://example.com");
  });

  it("resolves prefixed element namespace", () => {
    const parser = new SaxParser({ xmlns: true });
    const tags: SaxTag[] = [];
    parser.on("opentag", (tag: SaxTag) => tags.push(tag));

    parser.feed(
      '<x:root xmlns:x="http://x.com"><x:child/></x:root>'
    );
    parser.close();

    expect(tags[0].ns?.uri).toBe("http://x.com");
    expect(tags[0].ns?.prefix).toBe("x");
    expect(tags[1].ns?.uri).toBe("http://x.com");
  });

  it("does not leak namespace scope to siblings", () => {
    const parser = new SaxParser({ xmlns: true });
    const tags: SaxTag[] = [];
    parser.on("opentag", (tag: SaxTag) => tags.push(tag));

    parser.feed(
      '<root><a xmlns:x="http://x.com"/><b/></root>'
    );
    parser.close();

    // b should NOT have the x namespace from a's scope
    const bTag = tags.find((t) => t.name === "b")!;
    // b has no prefix, so ns resolves with no default ns → empty uri
    expect(bTag.ns?.uri).toBe("");
  });

  it("resolves attribute namespaces", () => {
    const parser = new SaxParser({ xmlns: true });
    const tags: SaxTag[] = [];
    parser.on("opentag", (tag: SaxTag) => tags.push(tag));

    parser.feed(
      '<root xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="url"/>'
    );
    parser.close();

    expect(tags[0].attributeNS?.["xlink:href"]?.uri).toBe(
      "http://www.w3.org/1999/xlink"
    );
    expect(tags[0].attributeNS?.["xlink:href"]?.local).toBe("href");
  });
});
