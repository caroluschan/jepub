const IMAGE_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

export function extensionOf(path: string): string {
  const clean = path.split(/[?#]/u)[0] ?? '';
  const dot = clean.lastIndexOf('.');
  return dot < 0 ? '' : clean.slice(dot + 1).toLowerCase();
}

export function mimeForPath(path: string): string {
  const ext = extensionOf(path);
  return IMAGE_MIME[ext] ?? 'application/octet-stream';
}

export function normalizePosix(path: string): string {
  const parts = path.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part.length === 0 || part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

export interface SplitHref {
  path: string;
  fragment: string | null;
}

export function splitHref(href: string): SplitHref {
  let value = href.trim();
  const hashIndex = value.indexOf('#');
  let fragment: string | null = null;
  if (hashIndex >= 0) {
    fragment = value.slice(hashIndex + 1);
    value = value.slice(0, hashIndex);
  }
  const queryIndex = value.indexOf('?');
  if (queryIndex >= 0) value = value.slice(0, queryIndex);
  return { path: value, fragment };
}

export function decodeUriPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveZipPath(baseDir: string, href: string): string {
  const { path } = splitHref(href);
  const decoded = decodeUriPart(path);
  if (decoded.startsWith('/')) return normalizePosix(decoded);
  return normalizePosix(baseDir.length > 0 ? `${baseDir}/${decoded}` : decoded);
}

export function buildCaseInsensitiveLookup(paths: Iterable<string>): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const path of paths) {
    const key = path.toLowerCase();
    if (!lookup.has(key)) lookup.set(key, path);
  }
  return lookup;
}

export function findActualPath(lookup: Map<string, string>, path: string): string | null {
  return lookup.get(path.toLowerCase()) ?? null;
}
