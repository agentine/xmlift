/**
 * xml2js-compatible Builder — converts JavaScript objects back to XML strings.
 */

import { escapeXML, wrapCDATA, needsEscape } from "./escape.js";

export interface XmlDeclaration {
  version?: string;
  encoding?: string;
  standalone?: boolean;
}

export interface RenderOptions {
  pretty?: boolean;
  indent?: string;
  newline?: string;
}

export interface BuilderOptions {
  /** Default root element name. Default: `"root"`. */
  rootName?: string;
  /** XML declaration attributes. */
  xmldec?: XmlDeclaration;
  /** DOCTYPE string to include. Default: `null`. */
  doctype?: string | null;
  /** Rendering/formatting options. */
  renderOpts?: RenderOptions;
  /** Omit XML declaration. Default: `false`. */
  headless?: boolean;
  /** Wrap text needing escaping in CDATA instead. Default: `false`. */
  cdata?: boolean;
  /** Key for attributes (must match Parser). Default: `"$"`. */
  attrkey?: string;
  /** Key for text content (must match Parser). Default: `"_"`. */
  charkey?: string;
}

const DEFAULT_OPTIONS: Required<BuilderOptions> = {
  rootName: "root",
  xmldec: { version: "1.0", encoding: "UTF-8", standalone: true },
  doctype: null,
  renderOpts: { pretty: true, indent: "  ", newline: "\n" },
  headless: false,
  cdata: false,
  attrkey: "$",
  charkey: "_",
};

export class Builder {
  private opts: Required<BuilderOptions>;
  private pretty: boolean;
  private indent: string;
  private newline: string;

  constructor(options?: BuilderOptions) {
    this.opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      xmldec: { ...DEFAULT_OPTIONS.xmldec, ...options?.xmldec },
      renderOpts: { ...DEFAULT_OPTIONS.renderOpts, ...options?.renderOpts },
    };
    this.pretty = this.opts.renderOpts.pretty ?? true;
    this.indent = this.opts.renderOpts.indent ?? "  ";
    this.newline = this.opts.renderOpts.newline ?? "\n";
  }

  /**
   * Build an XML string from a JavaScript object.
   *
   * If the object has exactly one key, that key is used as the root element
   * name. Otherwise, the `rootName` option is used.
   */
  buildObject(obj: unknown): string {
    const parts: string[] = [];

    // XML declaration
    if (!this.opts.headless) {
      const dec = this.opts.xmldec;
      let xmldec = `<?xml version="${dec.version ?? "1.0"}"`;
      if (dec.encoding) {
        xmldec += ` encoding="${dec.encoding}"`;
      }
      if (dec.standalone !== undefined) {
        xmldec += ` standalone="${dec.standalone ? "yes" : "no"}"`;
      }
      xmldec += "?>";
      parts.push(xmldec);
    }

    // DOCTYPE
    if (this.opts.doctype) {
      parts.push(`<!DOCTYPE ${this.opts.doctype}>`);
    }

    // Determine root element name and value
    let rootName: string;
    let rootValue: unknown;

    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      const keys = Object.keys(obj);
      if (keys.length === 1) {
        // Auto-detect root name from single key
        rootName = keys[0];
        rootValue = (obj as Record<string, unknown>)[rootName];
        // If wrapped in an array (from explicitArray), unwrap
        if (Array.isArray(rootValue) && rootValue.length === 1) {
          rootValue = rootValue[0];
        }
      } else {
        rootName = this.opts.rootName;
        rootValue = obj;
      }
    } else {
      rootName = this.opts.rootName;
      rootValue = obj;
    }

    parts.push(this.renderElement(rootName, rootValue, 0));

    return parts.join(this.pretty ? this.newline : "") + (this.pretty ? this.newline : "");
  }

  // -----------------------------------------------------------------
  // Private rendering
  // -----------------------------------------------------------------

  private renderElement(
    name: string,
    value: unknown,
    level: number,
  ): string {
    const prefix = this.pretty ? this.indent.repeat(level) : "";

    // Null / undefined → self-closing
    if (value === null || value === undefined) {
      return `${prefix}<${name}/>`;
    }

    // Array → render each element separately
    if (Array.isArray(value)) {
      return value
        .map((item) => this.renderElement(name, item, level))
        .join(this.pretty ? this.newline : "");
    }

    // Primitive (string, number, boolean)
    if (typeof value !== "object") {
      const text = this.renderText(String(value));
      return `${prefix}<${name}>${text}</${name}>`;
    }

    // Object
    const obj = value as Record<string, unknown>;
    const attrStr = this.renderAttributes(obj[this.opts.attrkey] as Record<string, unknown> | undefined);
    const charContent = obj[this.opts.charkey];

    // Collect child element keys (exclude attrkey and charkey)
    const childKeys = Object.keys(obj).filter(
      (k) => k !== this.opts.attrkey && k !== this.opts.charkey,
    );

    // No children — text-only or empty
    if (childKeys.length === 0) {
      if (charContent !== undefined && charContent !== null) {
        const text = this.renderText(String(charContent));
        return `${prefix}<${name}${attrStr}>${text}</${name}>`;
      }
      if (attrStr) {
        return `${prefix}<${name}${attrStr}/>`;
      }
      return `${prefix}<${name}/>`;
    }

    // Has children
    const nl = this.pretty ? this.newline : "";
    const parts: string[] = [];
    parts.push(`${prefix}<${name}${attrStr}>`);

    // Text content before children
    if (charContent !== undefined && charContent !== null) {
      const text = this.renderText(String(charContent));
      if (this.pretty) {
        parts.push(`${this.indent.repeat(level + 1)}${text}`);
      } else {
        parts.push(text);
      }
    }

    // Render child elements
    for (const key of childKeys) {
      const childValue = obj[key];
      if (Array.isArray(childValue)) {
        for (const item of childValue) {
          parts.push(this.renderElement(key, item, level + 1));
        }
      } else {
        parts.push(this.renderElement(key, childValue, level + 1));
      }
    }

    parts.push(`${prefix}</${name}>`);
    return parts.join(nl);
  }

  private renderAttributes(
    attrs: Record<string, unknown> | undefined,
  ): string {
    if (!attrs) return "";
    const parts: string[] = [];
    for (const [key, val] of Object.entries(attrs)) {
      parts.push(` ${key}="${escapeXML(String(val))}"`);
    }
    return parts.join("");
  }

  private renderText(text: string): string {
    if (this.opts.cdata && needsEscape(text)) {
      return wrapCDATA(text);
    }
    return escapeXML(text);
  }
}
