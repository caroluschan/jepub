/**
 * Strips a leading UTF-8 BOM and leading whitespace before XML parsing.
 *
 * Some real-world EPUBs prefix container.xml, the package document, or a
 * navigation document with U+FEFF. DOMParser rejects any character—including a
 * BOM—before the XML declaration, so normalize once at the boundary.
 */
export function stripXmlPrefix(xml: string): string {
  return xml.replace(/^\uFEFF/u, '').replace(/^\s+/u, '');
}

export function parseXmlDocument(
  xml: string,
  mimeType: DOMParserSupportedType = 'application/xml',
): Document {
  return new DOMParser().parseFromString(stripXmlPrefix(xml), mimeType);
}

export function hasXmlParseError(doc: Document): boolean {
  return doc.getElementsByTagName('parsererror').length > 0;
}
