import { EpubParseError } from './errors';
import { decodeUriPart } from './paths';

export const CONTAINER_PATH = 'META-INF/container.xml';

export function parseContainerXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
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
