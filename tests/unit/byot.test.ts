import { describe, expect, it } from 'vitest';
import { byotBaseUrl, byotModel, getByotProvider } from '../../src/lib/llm/byot';

describe('BYOT provider configuration', () => {
  it('BYOT-PROVIDERS exposes a base URL and default model', () => {
    expect(getByotProvider('openai').baseUrl).toBe('https://api.openai.com/v1');
    expect(getByotProvider('openai').defaultModel.length).toBeGreaterThan(0);
    expect(getByotProvider('custom').baseUrl).toBe('');
    expect(getByotProvider('deepseek').baseUrl).toBe('https://api.deepseek.com/v1');
    expect(getByotProvider('deepseek').defaultModel).toBe('deepseek-chat');
  });

  it('BYOT-BASE normalizes custom base URLs and rejects invalid values', () => {
    expect(
      byotBaseUrl({ provider: 'custom', apiKey: '', model: 'x', baseUrl: 'https://example.test/v1/' }),
    ).toBe('https://example.test/v1');
    expect(() =>
      byotBaseUrl({ provider: 'custom', apiKey: '', model: 'x', baseUrl: 'example.test' }),
    ).toThrow('valid provider base URL');
  });

  it('BYOT-MODEL falls back to the provider default', () => {
    expect(byotModel({ provider: 'openai', apiKey: 'k', model: '', baseUrl: '' })).toBe(
      getByotProvider('openai').defaultModel,
    );
    expect(byotModel({ provider: 'openai', apiKey: 'k', model: 'custom-model', baseUrl: '' })).toBe(
      'custom-model',
    );
  });
});
