import { describe, expect, it } from 'vitest';
import { evaluateLlmSupport, LLM_LIMITS } from '../../src/lib/llm/capabilities';
import type { LlmProbe } from '../../src/lib/llm/capabilities';

const MEGABYTE = 1024 * 1024;
const GIGABYTE = 1024 * MEGABYTE;

function probe(overrides: Partial<LlmProbe> = {}): LlmProbe {
  return {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    hasGpu: true,
    adapter: {
      limits: {
        maxBufferSize: 4 * GIGABYTE,
        maxStorageBufferBindingSize: 2 * GIGABYTE,
      },
    },
    storage: { usage: 0, quota: 4 * GIGABYTE },
    ...overrides,
  };
}

describe('local AI capabilities', () => {
  it('LLM-GATE accepts a capable desktop browser', () => {
    const result = evaluateLlmSupport(probe());
    expect(result.supported).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.maxBufferSize).toBe(4 * GIGABYTE);
    expect(result.freeStorage).toBe(4 * GIGABYTE);
  });

  it('LLM-GATE rejects a browser without WebGPU', () => {
    expect(evaluateLlmSupport(probe({ hasGpu: false, adapter: null })).reason).toBe('no-webgpu');
    expect(evaluateLlmSupport(probe({ adapter: null })).reason).toBe('no-webgpu');
  });

  it('LLM-GATE enforces the iOS 26 minimum', () => {
    const oldIos = probe({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 25_0 like Mac OS X) AppleWebKit/605.1.15 Version/25.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    expect(evaluateLlmSupport(oldIos).reason).toBe('os-version');
    expect(evaluateLlmSupport({ ...oldIos, userAgent: oldIos.userAgent.replace('25_0', '26_0').replace('Version/25.0', 'Version/26.0') }).supported).toBe(true);
  });

  it('LLM-GATE enforces the Android 12 minimum', () => {
    const oldAndroid = probe({
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    });
    expect(evaluateLlmSupport(oldAndroid).reason).toBe('os-version');
    expect(evaluateLlmSupport({ ...oldAndroid, userAgent: oldAndroid.userAgent.replace('Android 11', 'Android 12') }).supported).toBe(true);
  });

  it('LLM-GATE rejects storage buffers below the model threshold', () => {
    const result = evaluateLlmSupport(
      probe({
        adapter: {
          limits: {
            maxBufferSize: LLM_LIMITS.minMaxBuffer - 1,
            maxStorageBufferBindingSize: LLM_LIMITS.minStorageBufferBinding - 1,
          },
        },
      }),
    );
    expect(result.reason).toBe('storage-buffer');
  });

  it('LLM-GATE rejects too little free storage', () => {
    const result = evaluateLlmSupport(
      probe({
        storage: { usage: 3 * GIGABYTE, quota: 4 * GIGABYTE },
      }),
    );
    expect(result.reason).toBe('storage-space');
  });
});
