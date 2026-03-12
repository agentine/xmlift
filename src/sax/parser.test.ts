import { describe, it, expect } from "vitest";
import { SaxParser, type SaxTag } from "./parser.js";

function collectEvents(
  xml: string,
  options?: { strict?: boolean; xmlns?: boolean; maxDepth?: number }
) {
  const events: Array<{ event: string; data: unknown }> = [];
  const errors: Error[] = [];
  const parser = new SaxParser(options);

  parser.on("opentag", (tag: SaxTag) =>
    events.push({ event: "opentag", data: { ...tag } })
  );
  parser.on("closetag", (name: string) =>
    events.push({ event: "closetag", data: name })
  );
  parser.on("text", (text: string) =>
    events.push({ event: "text", data: text })
  );
  parser.on("cdata", (data: string) =>
    events.push({ event: "cdata", data })
  );
  parser.on("comment", (text: string) =>
    events.push({ event: "comment", data: text })
  );
  parser.on("processinginstruction", (pi: unknown) =>
    events.push({ event: "processinginstruction", data: pi })
  );
  parser.on("doctype", (dt: string) =>
    events.push({ event: "doctype", data: dt })
  );
  parser.on("end", () => events.push({ event: "end", data: null }));
  parser.on("error", (err: Error) => errors.push(err));

  parser.feed(xml);
  parser.close();
  return { events, errors };
}

describe("SaxParser", () => {
  describe("basic parsing", () => {
    it("parses a simple document", () => {
      const { events } = collectEvents("<root><child/></root>");
      const opens = events.filter((e) => e.event === "opentag");
      const closes = events.filter((e) => e.event === "closetag");
      expect(opens).toHaveLength(2);
      expect(closes).toHaveLength(2);
      expect((opens[0].data as SaxTag).name).toBe("root");
      expect((opens[1].data as SaxTag).name).toBe("child");
    });

    it("parses text content with entity expansion", () => {
      const { events } = collectEvents("<a>foo &amp; bar</a>");
      const text = events.find((e) => e.event === "text");
      expect(text?.data).toBe("foo & bar");
    });

    it("expands numeric entities", () => {
      const { events } = collectEvents("<a>&#65;&#x42;</a>");
      const text = events.find((e) => e.event === "text");
      expect(text?.data).toBe("AB");
    });

    it("parses attributes with entity expansion", () => {
      const { events } = collectEvents('<a x="1&amp;2"/>');
      const tag = events.find((e) => e.event === "opentag")
        ?.data as SaxTag;
      expect(tag.attributes.x).toBe("1&2");
    });

    it("parses CDATA", () => {
      const { events } = collectEvents(
        "<a><![CDATA[<not>xml</not>]]></a>"
      );
      const cdata = events.find((e) => e.event === "cdata");
      expect(cdata?.data).toBe("<not>xml</not>");
    });

    it("parses comments", () => {
      const { events } = collectEvents("<a><!-- hello --></a>");
      const comment = events.find((e) => e.event === "comment");
      expect(comment?.data).toBe(" hello ");
    });

    it("parses processing instructions", () => {
      const { events } = collectEvents(
        '<?xml version="1.0"?><root/>'
      );
      const pi = events.find((e) => e.event === "processinginstruction");
      expect(pi?.data).toEqual({
        name: "xml",
        body: 'version="1.0"',
      });
    });

    it("parses DOCTYPE", () => {
      const { events } = collectEvents("<!DOCTYPE html><html/>");
      const dt = events.find((e) => e.event === "doctype");
      expect(dt?.data).toBe("html");
    });

    it("parses DOCTYPE with internal subset (nested brackets)", () => {
      const xml =
        '<!DOCTYPE root [ <!ELEMENT root (#PCDATA)> ]><root/>';
      const { events } = collectEvents(xml);
      const dt = events.find((e) => e.event === "doctype");
      expect((dt?.data as string)).toContain("<!ELEMENT root");
    });

    it("emits end event on close", () => {
      const { events } = collectEvents("<a/>");
      expect(events[events.length - 1].event).toBe("end");
    });
  });

  describe("BOM handling", () => {
    it("strips UTF-8 BOM from input", () => {
      const { events } = collectEvents("\uFEFF<root/>");
      const opens = events.filter((e) => e.event === "opentag");
      expect(opens).toHaveLength(1);
      expect((opens[0].data as SaxTag).name).toBe("root");
    });
  });

  describe("depth limiting", () => {
    it("enforces maxDepth", () => {
      const deep = "<a>".repeat(5) + "</a>".repeat(5);
      const { errors } = collectEvents(deep, { maxDepth: 3 });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Maximum XML depth");
    });

    it("does not error within maxDepth", () => {
      const xml = "<a><b><c/></b></a>";
      const { errors } = collectEvents(xml, { maxDepth: 10 });
      expect(errors).toHaveLength(0);
    });
  });

  describe("strict mode — tag matching", () => {
    it("emits error on mismatched close tag", () => {
      const { errors } = collectEvents("<a></b>", { strict: true });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Mismatched close tag");
    });

    it("does not error on matched tags", () => {
      const { errors } = collectEvents("<a><b></b></a>", {
        strict: true,
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("lenient mode", () => {
    it("suppresses errors for mismatched tags", () => {
      const { errors } = collectEvents("<a></b>", { strict: false });
      expect(errors).toHaveLength(0);
    });

    it("still emits close events for unmatched tags", () => {
      const { events } = collectEvents("<a></b></a>", {
        strict: false,
      });
      const closes = events.filter((e) => e.event === "closetag");
      expect(closes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("negative depth guard", () => {
    it("does not go negative on extra close tags (lenient)", () => {
      // This should not throw
      const { errors } = collectEvents("</a></b></c>", {
        strict: false,
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("self-closing tags", () => {
    it("emits opentag and closetag for self-closing", () => {
      const { events } = collectEvents("<br/>");
      const open = events.find((e) => e.event === "opentag");
      const close = events.find((e) => e.event === "closetag");
      expect(open).toBeDefined();
      expect(close).toBeDefined();
      expect((open!.data as SaxTag).name).toBe("br");
      expect(close!.data).toBe("br");
    });
  });

  describe("reset", () => {
    it("allows reuse after reset", () => {
      const parser = new SaxParser({ strict: true });
      const tags: string[] = [];
      parser.on("opentag", (tag: SaxTag) => tags.push(tag.name));

      parser.feed("<a/>");
      parser.close();
      expect(tags).toEqual(["a"]);

      parser.reset();
      tags.length = 0;

      parser.feed("<b/>");
      parser.close();
      expect(tags).toEqual(["b"]);
    });
  });
});
