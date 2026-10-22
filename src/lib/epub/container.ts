import { EpubParseError } from './errors';
import { decodeUriPart } from './paths';
import { hasXmlParseError, parseXmlDocument } from './xml';

export const CONTAINER_PATH = 'META-INF/container.xml';

export function parseContainerXml(xml: string): string {
  // Some valid EPUBs prepend a UTF-8 BOM to container.xml. parseXmlDocument
  // strips a BOM/leading whitespace before the XML declaration.
  const doc = parseXmlDocument(xml);
  if (hasXmlParseError(doc)) {
    throw new EpubParseError('META-INF/container.xml is not valid XML.');
  }

  const rootfiles = Array.from(doc.getElementsByTagName('*')).filter(
    (element) => element.localName === 'rootfile',
  );
  for (const rootfile of rootfiles) {
    const fullPath = rootfile.getAttribute('full-path');
    if (fullPath !== null && fullPath.trim().length > 0) {
      return decodeUriPart(fullPath.trim());
    }
  }

  throw new EpubParseError('META-INF/container.xml has no rootfile.');
}
