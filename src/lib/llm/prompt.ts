const JAPANESE_RUBY_PATTERN = /<ruby>[\s\S]*?<\/ruby>/gu;

/**
 * Converts sanitized ruby markup into a compact reading list the local model
 * can anchor to. Keeping the readings out of HTML avoids the model treating
 * markup as prose.
 */
export function readingsFromRuby(html: string | null): string {
  if (html === null || html.length === 0) return '';
  if (typeof DOMParser === 'undefined') return '';

  const document = new DOMParser().parseFromString(html, 'text/html');
  const readings = Array.from(document.querySelectorAll('ruby')).flatMap((ruby) => {
    const reading = ruby.querySelector('rt')?.textContent?.trim() ?? '';
    const base = Array.from(ruby.childNodes)
      .filter((node) => node.nodeName !== 'RT' && node.nodeName !== 'RP')
      .map((node) => node.textContent ?? '')
      .join('')
      .trim();
    if (base.length === 0) return [];
    return [reading.length === 0 ? base : `${base}（${reading}）`];
  });

  return readings.join(' ');
}

export function stripRubyMarkup(html: string | null): string {
  if (html === null || html.length === 0) return '';
  if (typeof DOMParser === 'undefined') return html.replace(JAPANESE_RUBY_PATTERN, '');
  const document = new DOMParser().parseFromString(html, 'text/html');
  return document.body.textContent ?? '';
}

export interface SentencePromptInput {
  sentence: string;
  readings?: string | null;
  romaji?: string | null;
  translation?: string | null;
}

export function buildSentencePrompt({
  sentence,
  readings,
  romaji,
  translation,
}: SentencePromptInput): string {
  const lines = [
    'Help me understand this Japanese sentence as a learner.',
    '',
    `Sentence: ${sentence}`,
  ];
  if (readings !== null && readings !== undefined && readings.length > 0) {
    lines.push(`Readings: ${readings}`, 'Use these readings exactly.');
  }
  if (romaji !== null && romaji !== undefined && romaji.length > 0) {
    lines.push(`Romaji: ${romaji}`);
  }
  if (translation !== null && translation !== undefined && translation.length > 0) {
    lines.push(`Existing translation: ${translation}`);
  }
  lines.push(
    '',
    'Give a concise breakdown by phrase (particle, verb form, and meaning), then a natural English translation. Do not invent readings.',
  );
  return lines.join('\n');
}
