import type { ByotProviderId, ChatMessage } from '../types';
import { TUTOR_SYSTEM_PROMPT } from './prompt';

export interface ByotConfig {
  provider: ByotProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
}

type ProviderKind = 'openai' | 'anthropic' | 'google';

export interface ByotProviderDefinition {
  id: ByotProviderId;
  label: string;
  kind: ProviderKind;
  defaultModel: string;
  baseUrl: string;
}

export const BYOT_PROVIDERS: readonly ByotProviderDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    defaultModel: 'claude-3-5-haiku-latest',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    kind: 'google',
    defaultModel: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    defaultModel: 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai',
    defaultModel: 'mistral-small-latest',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'xai',
    label: 'xAI',
    kind: 'openai',
    defaultModel: 'grok-3-mini',
    baseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'together',
    label: 'Together AI',
    kind: 'openai',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    kind: 'openai',
    defaultModel: 'llama-3.3-70b',
    baseUrl: 'https://api.cerebras.ai/v1',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    kind: 'openai',
    defaultModel: 'sonar',
    baseUrl: 'https://api.perplexity.ai',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    kind: 'openai',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
  },
  {
    id: 'qwen',
    label: 'Qwen / DashScope',
    kind: 'openai',
    defaultModel: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible',
    kind: 'openai',
    defaultModel: '',
    baseUrl: '',
  },
];

export function getByotProvider(id: ByotProviderId): ByotProviderDefinition {
  const found = BYOT_PROVIDERS.find((provider) => provider.id === id);
  if (found !== undefined) return found;
  const first = BYOT_PROVIDERS[0];
  if (first !== undefined) return first;
  throw new Error('No BYOT providers are configured.');
}

export function byotBaseUrl(config: ByotConfig): string {
  const provider = getByotProvider(config.provider);
  const raw = config.provider === 'custom' ? config.baseUrl : provider.baseUrl;
  const trimmed = raw.trim().replace(/\/+$/u, '');
  if (!/^https?:\/\//u.test(trimmed)) {
    throw new Error('Enter a valid provider base URL.');
  }
  return trimmed;
}

export function byotModel(config: ByotConfig): string {
  return config.model.trim() || getByotProvider(config.provider).defaultModel;
}

function authHeaders(config: ByotConfig): Record<string, string> {
  const provider = getByotProvider(config.provider);
  const key = config.apiKey.trim();
  if (provider.kind === 'google') return {};
  if (provider.kind === 'anthropic') {
    if (key.length === 0) throw new Error('An API key is required.');
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  if (key.length === 0 && config.provider !== 'openrouter') {
    throw new Error('An API key is required.');
  }
  return key.length === 0 ? {} : { Authorization: `Bearer ${key}` };
}

function modelsUrl(config: ByotConfig): string {
  const base = byotBaseUrl(config);
  if (getByotProvider(config.provider).kind === 'google') {
    if (config.apiKey.trim().length === 0) throw new Error('An API key is required.');
    return `${base}/models?key=${encodeURIComponent(config.apiKey.trim())}`;
  }
  return `${base}/models`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readModelIds(payload: unknown, config: ByotConfig): string[] {
  const record = asRecord(payload);
  if (record === null) return [];
  const rawModels = config.provider === 'google' ? record['models'] : record['data'];
  if (!Array.isArray(rawModels)) return [];

  const modelNames: string[] = [];
  for (const entry of rawModels) {
    const item = asRecord(entry);
    if (item === null) continue;
    if (config.provider === 'google') {
      const name = item['name'];
      const methods = item['supportedGenerationMethods'];
      if (
        typeof name === 'string' &&
        Array.isArray(methods) &&
        methods.some((method) => method === 'generateContent')
      ) {
        modelNames.push(name.replace(/^models\//u, ''));
      }
    } else {
      const id = item['id'];
      if (typeof id === 'string') modelNames.push(id);
    }
  }
  return [...new Set(modelNames)].sort((left, right) => left.localeCompare(right));
}

export async function fetchByotModels(config: ByotConfig): Promise<string[]> {
  const response = await fetch(modelsUrl(config), {
    headers: authHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`Could not load models (${response.status}).`);
  }
  const payload: unknown = await response.json();
  return readModelIds(payload, config);
}

function chatUrl(config: ByotConfig, model: string): string {
  const base = byotBaseUrl(config);
  const provider = getByotProvider(config.provider);
  if (provider.kind === 'google') {
    if (config.apiKey.trim().length === 0) throw new Error('An API key is required.');
    return `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.apiKey.trim())}`;
  }
  if (provider.kind === 'anthropic') return `${base}/messages`;
  return `${base}/chat/completions`;
}

function chatBody(config: ByotConfig, model: string, messages: ChatMessage[]): unknown {
  const recent = messages.slice(-12);
  const provider = getByotProvider(config.provider);
  if (provider.kind === 'anthropic') {
    return {
      model,
      system: TUTOR_SYSTEM_PROMPT,
      messages: recent.map((message) => ({ role: message.role, content: message.content })),
      max_tokens: 800,
      temperature: 0.3,
      stream: true,
    };
  }
  if (provider.kind === 'google') {
    return {
      systemInstruction: { parts: [{ text: TUTOR_SYSTEM_PROMPT }] },
      contents: recent.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
    };
  }
  return {
    model,
    messages: [
      { role: 'system', content: TUTOR_SYSTEM_PROMPT },
      ...recent.map((message) => ({ role: message.role, content: message.content })),
    ],
    temperature: 0.3,
    max_tokens: 800,
    stream: true,
  };
}

function tokenFromChunk(config: ByotConfig, payload: unknown): string {
  const record = asRecord(payload);
  if (record === null) return '';
  const provider = getByotProvider(config.provider);
  if (provider.kind === 'anthropic') {
    const delta = asRecord(record['delta']);
    return typeof delta?.['text'] === 'string' ? delta['text'] : '';
  }
  if (provider.kind === 'google') {
    const candidates = record['candidates'];
    if (!Array.isArray(candidates)) return '';
    const content = asRecord(asRecord(candidates[0])?.['content']);
    const parts = content?.['parts'];
    if (!Array.isArray(parts)) return '';
    return parts
      .map((part) => {
        const text = asRecord(part)?.['text'];
        return typeof text === 'string' ? text : '';
      })
      .join('');
  }
  const choices = record['choices'];
  if (!Array.isArray(choices)) return '';
  const delta = asRecord(asRecord(choices[0])?.['delta']);
  const content = delta?.['content'];
  return typeof content === 'string' ? content : '';
}

async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onPayload: (payload: unknown) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line: string): void => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data.length === 0 || data === '[DONE]') return;
    try {
      onPayload(JSON.parse(data) as unknown);
    } catch {
      // Ignore malformed SSE frames and keep consuming the stream.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() ?? '';
    for (const line of lines) processLine(line);
  }
  buffer += decoder.decode();
  for (const line of buffer.split(/\r?\n/u)) processLine(line);
}

export async function generateByot(
  config: ByotConfig,
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('BYOT needs an internet connection.');
  }
  const model = byotModel(config);
  if (model.length === 0) throw new Error('Choose or enter a model.');
  const response = await fetch(chatUrl(config, model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(config),
    },
    body: JSON.stringify(chatBody(config, model, messages)),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(detail.length > 0 ? detail : `The provider rejected the request (${response.status}).`);
  }
  if (response.body === null) throw new Error('The provider returned an empty response.');

  let output = '';
  await consumeSse(response.body, (payload) => {
    const token = tokenFromChunk(config, payload);
    if (token.length === 0) return;
    output += token;
    onToken(token);
  });
  return output;
}
