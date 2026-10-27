import type { ChatMessage } from '../types';
import { TUTOR_SYSTEM_PROMPT } from './prompt';

const OVH_ENDPOINT = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions';
const OVH_MODEL = 'mistral@latest';

function contentFrom(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const choices = (payload as Record<string, unknown>)['choices'];
  if (!Array.isArray(choices)) return '';
  const first = choices[0];
  if (typeof first !== 'object' || first === null) return '';
  const message = (first as Record<string, unknown>)['message'];
  if (typeof message !== 'object' || message === null) return '';
  const content = (message as Record<string, unknown>)['content'];
  return typeof content === 'string' ? content : '';
}

export async function generateOvh(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  maxTokens = 800,
): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('OVHcloud needs an internet connection.');
  }
  const response = await fetch(OVH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: OVH_MODEL,
      messages: [
        { role: 'system', content: TUTOR_SYSTEM_PROMPT },
        ...messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(detail.length > 0 ? detail : `OVHcloud rejected the request (${response.status}).`);
  }
  const payload: unknown = await response.json();
  const content = contentFrom(payload);
  if (content.length === 0) throw new Error('OVHcloud returned an empty response.');
  onToken(content);
  return content;
}
