import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach } from 'vitest';

// jsdom's Blob is not structured-cloneable by Node, which breaks Blob storage in
// fake-indexeddb. Node's Blob/File are cloneable and behave identically for the tests.
Object.defineProperty(globalThis, 'Blob', {
  value: NodeBlob,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'File', {
  value: NodeFile,
  configurable: true,
  writable: true,
});

if (typeof globalThis.crypto?.subtle === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

if (typeof URL.createObjectURL !== 'function') {
  let objectUrlCounter = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => `blob:jepub-test/${(objectUrlCounter += 1)}`,
    configurable: true,
    writable: true,
  });
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    configurable: true,
    writable: true,
  });
}

class IntersectionObserverStub {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: IntersectionObserverStub,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});
