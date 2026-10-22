import type { KnowledgeKind, KnowledgeRecord } from '../types';

export function fingerprintFor(kind: KnowledgeKind, sentence: string, value: string): string {
  return `${kind}\u0000${sentence}\u0000${value}`;
}

export function makeKnowledgeRecord(
  input: Omit<KnowledgeRecord, 'id' | 'createdAt' | 'fingerprint'>,
  value: string,
): KnowledgeRecord {
  return {
    ...input,
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
    fingerprint: fingerprintFor(input.kind, input.sentence, value),
  };
}
