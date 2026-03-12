import { describe, it, expect } from "vitest";
import { stripBOM } from "./bom.js";

describe("stripBOM", () => {
  it("strips UTF-8 BOM", () => {
    expect(stripBOM("\uFEFFhello")).toBe("hello");
  });

  it("returns string unchanged without BOM", () => {
    expect(stripBOM("hello")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(stripBOM("")).toBe("");
  });

  it("handles BOM-only string", () => {
    expect(stripBOM("\uFEFF")).toBe("");
  });
});
