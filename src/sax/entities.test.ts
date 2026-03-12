import { describe, it, expect } from "vitest";
import { resolveEntity, expandEntities } from "./entities.js";

describe("resolveEntity", () => {
  it("resolves predefined XML entities", () => {
    expect(resolveEntity("amp", {})).toBe("&");
    expect(resolveEntity("lt", {})).toBe("<");
    expect(resolveEntity("gt", {})).toBe(">");
    expect(resolveEntity("apos", {})).toBe("'");
    expect(resolveEntity("quot", {})).toBe('"');
  });

  it("resolves decimal numeric entities", () => {
    expect(resolveEntity("#65", {})).toBe("A");
    expect(resolveEntity("#97", {})).toBe("a");
  });

  it("resolves hex numeric entities", () => {
    expect(resolveEntity("#x41", {})).toBe("A");
    expect(resolveEntity("#x61", {})).toBe("a");
    expect(resolveEntity("#x1F600", {})).toBe("\u{1F600}");
  });

  it("resolves custom entities", () => {
    expect(
      resolveEntity("foo", { customEntities: { foo: "bar" } })
    ).toBe("bar");
  });

  it("throws on unknown entity in strict mode", () => {
    expect(() => resolveEntity("unknown", { strict: true })).toThrow();
  });

  it("returns raw reference in lenient mode for unknown entity", () => {
    expect(resolveEntity("unknown", { strict: false })).toBe(
      "&unknown;"
    );
  });
});

describe("expandEntities", () => {
  it("expands multiple entities in text", () => {
    expect(expandEntities("a &amp; b &lt; c", {})).toBe("a & b < c");
  });

  it("expands numeric entities in text", () => {
    expect(expandEntities("&#65;&#66;&#67;", {})).toBe("ABC");
  });

  it("handles text without entities", () => {
    expect(expandEntities("hello world", {})).toBe("hello world");
  });

  it("enforces maxEntityExpansionDepth", () => {
    expect(() =>
      expandEntities("&a;", {
        strict: true,
        customEntities: { a: "&b;", b: "&a;" },
        maxEntityExpansionDepth: 2,
      })
    ).toThrow();
  });

  it("enforces maxEntityExpansions", () => {
    // Create a string with many entity references
    const input = "&amp;".repeat(100);
    expect(() =>
      expandEntities(input, {
        strict: true,
        maxEntityExpansions: 10,
      })
    ).toThrow();
  });
});
