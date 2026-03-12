/**
 * XML namespace resolution — prefix-to-URI mapping with scope push/pop.
 * Pure class, no I/O.
 */

export interface ResolvedName {
  local: string;
  prefix: string;
  uri: string;
}

const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

export class NamespaceContext {
  private scopes: Map<string, string>[] = [];

  constructor() {
    // Pre-bound prefixes per XML Namespaces spec
    const builtins = new Map<string, string>();
    builtins.set("xml", XML_NS);
    builtins.set("xmlns", XMLNS_NS);
    this.scopes.push(builtins);
  }

  /**
   * Push a new scope. Call when entering an element.
   * Pass any xmlns attributes found on this element.
   */
  push(nsDeclarations?: Record<string, string>): void {
    const scope = new Map<string, string>();
    if (nsDeclarations) {
      for (const [prefix, uri] of Object.entries(nsDeclarations)) {
        scope.set(prefix, uri);
      }
    }
    this.scopes.push(scope);
  }

  /**
   * Pop the current scope. Call when leaving an element.
   */
  pop(): void {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  /**
   * Register a namespace declaration found on the current element.
   * Call with prefix="" for default namespace (xmlns="...").
   * Call with prefix="foo" for xmlns:foo="...".
   */
  addNamespace(prefix: string, uri: string): void {
    const current = this.scopes[this.scopes.length - 1];
    current.set(prefix, uri);
  }

  /**
   * Resolve a namespace prefix to its URI.
   * Returns null if prefix is not bound.
   */
  resolvePrefix(prefix: string): string | null {
    // Walk scopes from innermost to outermost
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const uri = this.scopes[i].get(prefix);
      if (uri !== undefined) return uri;
    }
    return null;
  }

  /**
   * Check if an attribute name is an xmlns declaration.
   * Returns the prefix being declared, or null if not an xmlns attr.
   * "xmlns" -> "" (default namespace)
   * "xmlns:foo" -> "foo"
   */
  static parseXmlnsAttr(attrName: string): string | null {
    if (attrName === "xmlns") return "";
    if (attrName.startsWith("xmlns:")) return attrName.slice(6);
    return null;
  }
}

/**
 * Resolve the namespace of an element tag name.
 * Unprefixed elements use the default namespace (prefix "").
 */
export function getElementNS(
  tagName: string,
  ctx: NamespaceContext
): ResolvedName {
  const colonIdx = tagName.indexOf(":");
  if (colonIdx === -1) {
    // Unprefixed — use default namespace
    const uri = ctx.resolvePrefix("") ?? "";
    return { local: tagName, prefix: "", uri };
  }
  const prefix = tagName.slice(0, colonIdx);
  const local = tagName.slice(colonIdx + 1);
  const uri = ctx.resolvePrefix(prefix) ?? "";
  return { local, prefix, uri };
}

/**
 * Resolve the namespace of an attribute name.
 * Unprefixed attributes do NOT inherit the default namespace (per spec).
 */
export function getAttrNS(
  attrName: string,
  ctx: NamespaceContext
): ResolvedName {
  const colonIdx = attrName.indexOf(":");
  if (colonIdx === -1) {
    // Unprefixed attributes have no namespace
    return { local: attrName, prefix: "", uri: "" };
  }
  const prefix = attrName.slice(0, colonIdx);
  const local = attrName.slice(colonIdx + 1);
  const uri = ctx.resolvePrefix(prefix) ?? "";
  return { local, prefix, uri };
}
