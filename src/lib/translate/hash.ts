import { DEFAULT_TRANSLATION_TARGET, getTranslationLanguage } from './languages';

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export async function translationKey(
  text: string,
  targetLanguage: string = DEFAULT_TRANSLATION_TARGET,
): Promise<string> {
  const target = getTranslationLanguage(targetLanguage).code;
  const encoded = new TextEncoder().encode(`v1|${target}|${text}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}
