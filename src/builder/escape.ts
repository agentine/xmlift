/**
 * XML escaping utilities for the Builder.
 */

/** Escape special characters for XML text content. */
export function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap text in a CDATA section. If the text contains `]]>`, split into
 * multiple CDATA sections to avoid premature termination.
 */
export function wrapCDATA(str: string): string {
  // Split on ]]> and rejoin with separate CDATA sections
  const parts = str.split("]]>");
  return parts
    .map((part, i) => {
      if (i < parts.length - 1) {
        return `<![CDATA[${part}]]]]><![CDATA[>`;
      }
      return `<![CDATA[${part}]]>`;
    })
    .join("");
}

/** Check if text needs XML escaping (contains &, <, >, ", or '). */
export function needsEscape(str: string): boolean {
  return /[&<>"']/.test(str);
}
