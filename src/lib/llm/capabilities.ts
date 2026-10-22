import type { LlmSupport, LlmUnsupportedReason } from '../types';

const MEGABYTE = 1024 * 1024;
const MIN_OS_IOS = 26;
const MIN_OS_ANDROID = 12;
const MIN_STORAGE_BUFFER_BINDING = 512 * MEGABYTE;
const MIN_MAX_BUFFER = 768 * MEGABYTE;
const MIN_FREE_STORAGE = 1536 * MEGABYTE;

interface AdapterLimits {
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
}

export interface LlmAdapterProbe {
  limits: AdapterLimits;
}

export interface LlmStorageProbe {
  usage: number;
  quota: number;
}

export interface LlmProbe {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  hasGpu: boolean;
  adapter: LlmAdapterProbe | null;
  storage: LlmStorageProbe | null;
}

interface GpuNavigator {
  gpu?: {
    requestAdapter(): Promise<LlmAdapterProbe | null>;
  };
}

function makeSupport(
  supported: boolean,
  reason: LlmUnsupportedReason | null,
  adapter: LlmAdapterProbe | null,
  storage: LlmStorageProbe | null,
): LlmSupport {
  return {
    supported,
    reason,
    maxBufferSize: adapter?.limits.maxBufferSize ?? null,
    maxStorageBufferBindingSize: adapter?.limits.maxStorageBufferBindingSize ?? null,
    freeStorage:
      storage === null ? null : Math.max(0, storage.quota - storage.usage),
  };
}

function isIos(probe: LlmProbe): boolean {
  return (
    /iPad|iPhone|iPod/u.test(probe.userAgent) ||
    (/Macintosh/u.test(probe.userAgent) && probe.maxTouchPoints > 1)
  );
}

function isAndroid(probe: LlmProbe): boolean {
  return /Android/u.test(probe.userAgent);
}

function iosMajorVersion(probe: LlmProbe): number | null {
  const osMatch = probe.userAgent.match(/(?:CPU|iPhone|iPad|iPod).*?OS (\d+)[._]/u);
  if (osMatch?.[1] !== undefined) return Number(osMatch[1]);
  // iPadOS 13+ reports a desktop-class UA. Safari's Version token is the only
  // reliable version marker there.
  const versionMatch = probe.userAgent.match(/Version\/(\d+)(?:[._]|$)/u);
  return versionMatch?.[1] === undefined ? null : Number(versionMatch[1]);
}

function androidMajorVersion(probe: LlmProbe): number | null {
  const match = probe.userAgent.match(/Android\s+(\d+)/u);
  return match?.[1] === undefined ? null : Number(match[1]);
}

export function evaluateLlmSupport(probe: LlmProbe): LlmSupport {
  if (!probe.hasGpu || probe.adapter === null) {
    return makeSupport(false, 'no-webgpu', null, probe.storage);
  }

  if (isIos(probe)) {
    const version = iosMajorVersion(probe);
    if (version !== null && version < MIN_OS_IOS) {
      return makeSupport(false, 'os-version', probe.adapter, probe.storage);
    }
  }

  if (isAndroid(probe)) {
    const version = androidMajorVersion(probe);
    if (version !== null && version < MIN_OS_ANDROID) {
      return makeSupport(false, 'os-version', probe.adapter, probe.storage);
    }
  }

  const limits = probe.adapter.limits;
  if (
    limits.maxBufferSize < MIN_MAX_BUFFER ||
    limits.maxStorageBufferBindingSize < MIN_STORAGE_BUFFER_BINDING
  ) {
    return makeSupport(false, 'storage-buffer', probe.adapter, probe.storage);
  }

  if (probe.storage !== null) {
    const free = probe.storage.quota - probe.storage.usage;
    if (free < MIN_FREE_STORAGE) {
      return makeSupport(false, 'storage-space', probe.adapter, probe.storage);
    }
  }

  return makeSupport(true, null, probe.adapter, probe.storage);
}

function readNavigatorProbe(): {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
} {
  if (typeof navigator === 'undefined') {
    return { userAgent: '', platform: '', maxTouchPoints: 0 };
  }
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

/** Reads live browser capabilities. No model code or network request runs here. */
export async function detectLlmSupport(): Promise<LlmSupport> {
  const base = readNavigatorProbe();
  const gpuNavigator = navigator as Navigator & GpuNavigator;
  if (gpuNavigator.gpu === undefined) {
    return evaluateLlmSupport({
      ...base,
      hasGpu: false,
      adapter: null,
      storage: null,
    });
  }

  let adapter: LlmAdapterProbe | null = null;
  try {
    adapter = await gpuNavigator.gpu.requestAdapter();
  } catch {
    adapter = null;
  }

  let storage: LlmStorageProbe | null = null;
  try {
    if (typeof navigator.storage?.estimate === 'function') {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.usage === 'number' && typeof estimate.quota === 'number') {
        storage = { usage: estimate.usage, quota: estimate.quota };
      }
    }
  } catch {
    storage = null;
  }

  return evaluateLlmSupport({
    ...base,
    hasGpu: true,
    adapter,
    storage,
  });
}

export const LLM_LIMITS = {
  minIos: MIN_OS_IOS,
  minAndroid: MIN_OS_ANDROID,
  minStorageBufferBinding: MIN_STORAGE_BUFFER_BINDING,
  minMaxBuffer: MIN_MAX_BUFFER,
  minFreeStorage: MIN_FREE_STORAGE,
} as const;
