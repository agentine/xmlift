/**
 * xml2js-compatible Parser class — builds JavaScript objects from XML using
 * a stack-based tree construction algorithm driven by SAX events.
 */

import { EventEmitter } from "node:events";
import { SaxParser, type SaxTag } from "../sax/parser.js";
import {
  DEFAULTS_0_2,
  type ParserOptions,
  type Processor,
} from "./options.js";
import { ValidationError } from "./errors.js";

/** Property names that could lead to prototype pollution. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

interface StackFrame {
  /** Parsed tag name (after processors). */
  name: string;
  /** The object being built for this element. */
  obj: Record<string, unknown>;
  /** Accumulated text content. */
  text: string;
}

export class Parser extends EventEmitter {
  private opts: Required<ParserOptions>;
  private saxParser!: SaxParser;
  private stack: StackFrame[] = [];
  private result: unknown = null;
  private hadError = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cbEnd?: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _cbError?: (...args: any[]) => void;

  constructor(options?: ParserOptions) {
    super();
    this.opts = { ...DEFAULTS_0_2, ...options };
    this.initSax();
  }

  /** Re-initialize internal parser state. */
  reset(): void {
    this.stack = [];
    this.result = null;
    this.initSax();
    this.removeAllListeners();
  }

  /**
   * Parse an XML string and invoke the callback with the result.
   * Also emits `"end"` with the result on success or `"error"` on failure.
   */
  parseString(
    str: string,
    callback?: (err: Error | null, result?: unknown) => void,
  ): void {
    this.result = null;
    this.stack = [];
    this.hadError = false;
    this.initSax();

    // Remove previous internal callback listeners (if any) but preserve
    // user-registered listeners.
    if (this._cbEnd) this.removeListener("end", this._cbEnd);
    if (this._cbError) this.removeListener("error", this._cbError);
    this._cbEnd = undefined;
    this._cbError = undefined;

    if (callback) {
      let called = false;
      this._cbEnd = (result: unknown) => {
        if (!called) {
          called = true;
          callback(null, result);
        }
      };
      this._cbError = (err: Error) => {
        if (!called) {
          called = true;
          callback(err);
        }
      };
      this.once("end", this._cbEnd);
      this.once("error", this._cbError);
    }

    const doParse = () => {
      try {
        this.saxParser.feed(str);
        this.saxParser.close();
      } catch (err) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
      }
    };

    if (this.opts.async) {
      setImmediate(doParse);
    } else {
      doParse();
    }
  }

  /**
   * Parse an XML string, returning a Promise.
   */
  parseStringPromise(str: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.parseString(str, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  // -------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------

  private initSax(): void {
    this.saxParser = new SaxParser({
      strict: this.opts.strict,
      xmlns: this.opts.xmlns,
    });

    this.saxParser.on("opentag", (tag: SaxTag) => this.onOpenTag(tag));
    this.saxParser.on("closetag", (name: string) => this.onCloseTag(name));
    this.saxParser.on("text", (text: string) => this.onText(text));
    this.saxParser.on("cdata", (text: string) => this.onText(text));
    this.saxParser.on("error", (err: Error) => {
      this.hadError = true;
      this.emit("error", err);
    });
    this.saxParser.on("end", () => {
      // If parsing ended without producing a result and no error was
      // emitted yet, treat it as an error (e.g. unclosed tags).
      if (this.result === null && !this.hadError) {
        this.emit("error", new Error("XML parse error: unexpected end of input"));
      }
    });
  }

  /** Check if a property name is safe (prototype-pollution guard). */
  private isSafeKey(key: string): boolean {
    if (this.opts.allowDangerousKeys) return true;
    return !DANGEROUS_KEYS.has(key);
  }

  /** Apply an array of processor functions to a value. */
  private applyProcessors(
    processors: Processor[] | null,
    value: string,
    name?: string,
  ): string {
    if (!processors) return value;
    let result = value;
    for (const fn of processors) {
      result = fn(result, name);
    }
    return result;
  }

  /** Process text according to trim/normalize options. */
  private processText(text: string): string {
    if (this.opts.trim) {
      text = text.trim();
    }
    if (this.opts.normalize) {
      text = text.replace(/\s+/g, " ");
    }
    return text;
  }

  /** Create a safe object (no prototype chain). */
  private createObj(): Record<string, unknown> {
    return Object.create(null) as Record<string, unknown>;
  }

  private onOpenTag(tag: SaxTag): void {
    let tagName = tag.name;

    // Apply tag name processors.
    tagName = this.applyProcessors(this.opts.tagNameProcessors, tagName);

    if (this.opts.normalizeTags) {
      tagName = tagName.toLowerCase();
    }

    if (!this.isSafeKey(tagName)) {
      return; // silently skip dangerous tag names
    }

    const obj = this.createObj();

    // Handle attributes.
    if (!this.opts.ignoreAttrs) {
      const attrEntries = Object.entries(tag.attributes);
      if (attrEntries.length > 0) {
        if (this.opts.mergeAttrs) {
          // Merge attributes directly into the element object.
          for (const [rawName, rawValue] of attrEntries) {
            const attrName = this.applyProcessors(
              this.opts.attrNameProcessors,
              rawName,
            );
            if (!this.isSafeKey(attrName)) continue;
            const attrValue = this.applyProcessors(
              this.opts.attrValueProcessors,
              rawValue,
              attrName,
            );
            if (this.opts.explicitArray) {
              obj[attrName] = [attrValue];
            } else {
              obj[attrName] = attrValue;
            }
          }
        } else {
          // Store under attrkey.
          const attrsObj = this.createObj();
          for (const [rawName, rawValue] of attrEntries) {
            const attrName = this.applyProcessors(
              this.opts.attrNameProcessors,
              rawName,
            );
            if (!this.isSafeKey(attrName)) continue;
            const attrValue = this.applyProcessors(
              this.opts.attrValueProcessors,
              rawValue,
              attrName,
            );
            attrsObj[attrName] = attrValue;
          }
          obj[this.opts.attrkey] = attrsObj;
        }
      }
    }

    // Handle xmlns info.
    if (this.opts.xmlns && tag.ns) {
      obj[this.opts.xmlnskey] = {
        uri: tag.ns.uri,
        local: tag.ns.local,
      };
    }

    this.stack.push({ name: tagName, obj, text: "" });
  }

  private onText(text: string): void {
    if (this.stack.length === 0) return;
    const frame = this.stack[this.stack.length - 1];
    frame.text += text;
  }

  private onCloseTag(_name: string): void {
    const frame = this.stack.pop();
    if (!frame) return;

    const { name: tagName, obj } = frame;
    let text = this.processText(frame.text);
    text = this.applyProcessors(this.opts.valueProcessors, text, tagName);

    // Determine the element value.
    const hasChildren = Object.keys(obj).some(
      (k) => k !== this.opts.attrkey && k !== this.opts.xmlnskey,
    );
    const hasAttrs = this.opts.attrkey in obj;
    const hasText = text.length > 0;

    if (!hasChildren && !hasAttrs && !hasText) {
      // Empty element — use emptyTag value.
      this.assignToParent(tagName, this.opts.emptyTag);
      return;
    }

    // Place text content.
    if (hasText) {
      if (
        this.opts.explicitCharkey ||
        hasChildren ||
        hasAttrs
      ) {
        obj[this.opts.charkey] = text;
      } else {
        // Simple text-only element — assign text directly unless explicitArray.
        this.assignToParent(tagName, text);
        return;
      }
    }

    // Assign this element object to its parent.
    this.assignToParent(tagName, obj);
  }

  /** Add a child value to the parent frame, or set as result if at root. */
  private assignToParent(tagName: string, value: unknown): void {
    // Apply validator if configured.
    if (this.opts.validator) {
      const xpath = "/" + this.stack.map((f) => f.name).join("/") + "/" + tagName;
      try {
        value = this.opts.validator(xpath, undefined, value);
      } catch (err) {
        if (err instanceof ValidationError) {
          this.emit("error", err);
          return;
        }
        throw err;
      }
    }

    if (this.stack.length > 0) {
      // Add to parent object.
      const parent = this.stack[this.stack.length - 1].obj;

      if (this.opts.explicitArray) {
        if (tagName in parent) {
          (parent[tagName] as unknown[]).push(value);
        } else {
          parent[tagName] = [value];
        }
      } else {
        if (tagName in parent) {
          // Convert to array on collision.
          const existing = parent[tagName];
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            parent[tagName] = [existing, value];
          }
        } else {
          parent[tagName] = value;
        }
      }
    } else {
      // Root element.
      let result: unknown;
      if (this.opts.explicitRoot) {
        const root = this.createObj();
        if (this.opts.explicitArray) {
          root[tagName] = [value];
        } else {
          root[tagName] = value;
        }
        result = root;
      } else {
        result = value;
      }
      this.result = result;
      this.emit("end", this.result);
    }
  }
}
