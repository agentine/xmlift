/**
 * SAX parser — composes tokenizer, entities, BOM, and namespaces into an
 * EventEmitter-style streaming XML parser.
 */

import { EventEmitter } from "node:events";
import { Tokenizer, TokenType } from "./tokenizer.js";
import { expandEntities, type EntityOptions } from "./entities.js";
import { stripBOM } from "./bom.js";
import {
  NamespaceContext,
  getElementNS,
  getAttrNS,
  type ResolvedName,
} from "./namespaces.js";

export interface SaxTag {
  name: string;
  attributes: Record<string, string>;
  ns?: ResolvedName;
}

export interface SaxProcessingInstruction {
  name: string;
  body: string;
}

export interface SaxParserOptions {
  strict?: boolean;
  xmlns?: boolean;
  maxDepth?: number;
  maxEntityExpansionDepth?: number;
  maxEntityExpansions?: number;
  customEntities?: Record<string, string>;
}

const DEFAULT_MAX_DEPTH = 200;

export class SaxParser extends EventEmitter {
  private tokenizer: Tokenizer;
  private strict: boolean;
  private xmlnsEnabled: boolean;
  private maxDepth: number;
  private entityOptions: EntityOptions;
  private nsContext: NamespaceContext;
  private depth = 0;
  private firstFeed = true;

  // Track current tag being built (accumulate attributes)
  private currentTag: SaxTag | null = null;
  private currentTagName = "";

  constructor(options?: SaxParserOptions) {
    super();
    this.strict = options?.strict ?? true;
    this.xmlnsEnabled = options?.xmlns ?? false;
    this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.entityOptions = {
      strict: this.strict,
      customEntities: options?.customEntities,
      maxEntityExpansionDepth: options?.maxEntityExpansionDepth,
      maxEntityExpansions: options?.maxEntityExpansions,
    };
    this.nsContext = new NamespaceContext();

    this.tokenizer = new Tokenizer((token) => {
      try {
        this.handleToken(token.type, token.value, token.name);
      } catch (err) {
        this.handleError(err as Error);
      }
    }, { strict: this.strict });
  }

  feed(chunk: string): void {
    if (this.firstFeed) {
      chunk = stripBOM(chunk);
      this.firstFeed = false;
    }
    try {
      this.tokenizer.feed(chunk);
    } catch (err) {
      this.handleError(err as Error);
    }
  }

  close(): void {
    try {
      this.tokenizer.close();
    } catch (err) {
      this.handleError(err as Error);
    }
    this.emit("end");
  }

  private handleError(err: Error): void {
    if (this.strict) {
      this.emit("error", err);
    } else {
      this.emit("error", err);
    }
  }

  private expandText(text: string): string {
    return expandEntities(text, this.entityOptions);
  }

  private handleToken(type: TokenType, value: string, name?: string): void {
    switch (type) {
      case TokenType.OpenTag:
        this.flushCurrentTag();
        this.currentTagName = name ?? value;
        this.currentTag = {
          name: this.currentTagName,
          attributes: Object.create(null) as Record<string, string>,
        };
        break;

      case TokenType.Attribute:
        if (this.currentTag && name) {
          const attrValue = this.expandText(value);

          // Check for xmlns declarations
          if (this.xmlnsEnabled) {
            const nsPrefix = NamespaceContext.parseXmlnsAttr(name);
            if (nsPrefix !== null) {
              this.nsContext.addNamespace(nsPrefix, attrValue);
            }
          }

          this.currentTag.attributes[name] = attrValue;
        }
        break;

      case TokenType.SelfCloseTag:
        this.flushCurrentTag();
        // If currentTag was already flushed by OpenTag handler,
        // we need to emit close for the self-closing tag
        this.emit("closetag", name ?? value);
        if (this.xmlnsEnabled) {
          this.nsContext.pop();
        }
        this.depth--;
        break;

      case TokenType.CloseTag: {
        this.flushCurrentTag();
        const closeName = name ?? value;
        this.emit("closetag", closeName);
        if (this.xmlnsEnabled) {
          this.nsContext.pop();
        }
        this.depth--;
        break;
      }

      case TokenType.Text: {
        this.flushCurrentTag();
        const text = this.expandText(value);
        if (text.length > 0) {
          this.emit("text", text);
        }
        break;
      }

      case TokenType.CDATA:
        this.flushCurrentTag();
        this.emit("cdata", value);
        break;

      case TokenType.Comment:
        this.flushCurrentTag();
        this.emit("comment", value);
        break;

      case TokenType.ProcessingInstruction:
        this.flushCurrentTag();
        this.emit("processinginstruction", {
          name: name ?? "",
          body: value,
        } satisfies SaxProcessingInstruction);
        break;

      case TokenType.DocType:
        this.flushCurrentTag();
        this.emit("doctype", value);
        break;
    }
  }

  private flushCurrentTag(): void {
    if (!this.currentTag) return;

    const tag = this.currentTag;
    this.currentTag = null;

    this.depth++;
    if (this.depth > this.maxDepth) {
      throw new Error(
        `Maximum XML depth exceeded (${this.maxDepth})`
      );
    }

    if (this.xmlnsEnabled) {
      this.nsContext.push();
      // Re-register xmlns attrs on the new scope
      for (const [attrName, attrValue] of Object.entries(tag.attributes)) {
        const nsPrefix = NamespaceContext.parseXmlnsAttr(attrName);
        if (nsPrefix !== null) {
          this.nsContext.addNamespace(nsPrefix, attrValue);
        }
      }
      tag.ns = getElementNS(tag.name, this.nsContext);

      // Resolve attribute namespaces — attach ns info per attribute
      for (const attrName of Object.keys(tag.attributes)) {
        getAttrNS(attrName, this.nsContext);
      }
    }

    this.emit("opentag", tag);
  }
}
