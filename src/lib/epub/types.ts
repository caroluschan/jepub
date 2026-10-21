export interface ManifestItem {
  id: string;
  href: string;
  path: string;
  mediaType: string;
  properties: string[];
}

export interface SpineEntry {
  idref: string;
  path: string;
  mediaType: string;
}

export interface OpfDocument {
  title: string;
  author: string;
  language: string;
  coverPath: string | null;
  manifest: ManifestItem[];
  spine: SpineEntry[];
  tocId: string | null;
}
