import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AiMode, ChatMessage, LlmSupport } from '../../lib/types';
import { detectLlmSupport } from '../../lib/llm/capabilities';
import { LlmClient } from '../../lib/llm/client';
import { byotBaseUrl, generateByot, getByotProvider } from '../../lib/llm/byot';
import { useOnline } from '../../lib/network/useOnline';
import { useSettings } from '../settings/SettingsProvider';

export type LlmPhase = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

interface LlmContextValue {
  support: LlmSupport | null;
  localSupported: boolean;
  mode: AiMode;
  byotConfigured: boolean;
  online: boolean;
  canUse: boolean;
  checking: boolean;
  phase: LlmPhase;
  progress: number | null;
  error: string | null;
  ensureReady: () => Promise<void>;
  generate: (
    messages: ChatMessage[],
    onToken: (token: string) => void,
  ) => Promise<string>;
  resetModel: () => Promise<void>;
}

const LlmContext = createContext<LlmContextValue | null>(null);

function unsupportedFallback(): LlmSupport {
  return {
    supported: false,
    reason: 'unknown',
    maxBufferSize: null,
    maxStorageBufferBindingSize: null,
    freeStorage: null,
  };
}

export function LlmProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const online = useOnline();
  const [support, setSupport] = useState<LlmSupport | null>(null);
  const [checking, setChecking] = useState(true);
  const [phase, setPhase] = useState<LlmPhase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<LlmClient | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const readyRef = useRef(false);
  const supportRef = useRef<LlmSupport | null>(null);
  const localSupported = support?.supported === true;
  const mode: AiMode = settings.aiMode === 'local' && !localSupported ? 'off' : settings.aiMode;
  const provider = getByotProvider(settings.aiProvider);
  const selectedModel = settings.aiModel.trim() || provider.defaultModel;
  const hasKey = settings.aiApiKey.trim().length > 0 || settings.aiProvider === 'custom';
  const hasBaseUrl = settings.aiProvider !== 'custom' || settings.aiBaseUrl.trim().length > 0;
  const byotConfigured = selectedModel.length > 0 && hasKey && hasBaseUrl;
  const canUse = mode === 'local' ? localSupported : mode === 'byot' ? byotConfigured : false;

  useEffect(() => {
    let active = true;
    void detectLlmSupport()
      .then((result) => {
        if (!active) return;
        supportRef.current = result;
        setSupport(result);
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;
        const result = unsupportedFallback();
        supportRef.current = result;
        setSupport(result);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    },
    [],
  );

  const ensureReady = useCallback(async (): Promise<void> => {
    if (readyRef.current) return;
    const currentSupport = supportRef.current;
    if (currentSupport === null || !currentSupport.supported) {
      throw new Error('On-device AI is not available on this device.');
    }
    if (loadPromiseRef.current !== null) return loadPromiseRef.current;

    if (clientRef.current === null) clientRef.current = new LlmClient();
    const client = clientRef.current;
    setError(null);
    setPhase('downloading');
    setProgress(0);

    const promise = client
      .load((percent) => {
        setProgress(percent);
        setPhase(percent === null ? 'loading' : 'downloading');
      })
      .then(() => {
        readyRef.current = true;
        setPhase('ready');
        setProgress(100);
      })
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error ? cause.message : 'The local AI model could not be loaded.';
        setPhase('error');
        setError(message);
        setProgress(null);
        throw cause;
      })
      .finally(() => {
        loadPromiseRef.current = null;
      });

    loadPromiseRef.current = promise;
    return promise;
  }, []);

  const generate = useCallback(
    async (messages: ChatMessage[], onToken: (token: string) => void): Promise<string> => {
      if (mode === 'byot') {
        if (!online) throw new Error('BYOT needs an internet connection.');
        if (!byotConfigured) throw new Error('Set up BYOT in AI settings first.');
        byotBaseUrl({
          provider: settings.aiProvider,
          apiKey: settings.aiApiKey,
          model: selectedModel,
          baseUrl: settings.aiBaseUrl,
        });
        return generateByot(
          {
            provider: settings.aiProvider,
            apiKey: settings.aiApiKey,
            model: selectedModel,
            baseUrl: settings.aiBaseUrl,
          },
          messages,
          onToken,
        );
      }
      if (mode !== 'local') throw new Error('AI is turned off.');
      await ensureReady();
      const client = clientRef.current;
      if (client === null) throw new Error('The local AI model is not available.');
      return client.generate(messages, onToken);
    },
    [byotConfigured, ensureReady, mode, online, selectedModel, settings.aiApiKey, settings.aiBaseUrl, settings.aiProvider],
  );

  const resetModel = useCallback(async (): Promise<void> => {
    await clientRef.current?.clearCache();
    readyRef.current = false;
    loadPromiseRef.current = null;
    setPhase('idle');
    setProgress(null);
    setError(null);
  }, []);

  const value = useMemo<LlmContextValue>(
    () => ({
      support,
      localSupported,
      mode,
      byotConfigured,
      online,
      canUse,
      checking,
      phase,
      progress,
      error,
      ensureReady,
      generate,
      resetModel,
    }),
    [byotConfigured, canUse, checking, ensureReady, error, generate, localSupported, mode, online, phase, progress, resetModel, support],
  );

  return <LlmContext.Provider value={value}>{children}</LlmContext.Provider>;
}

export function useLlm(): LlmContextValue {
  const context = useContext(LlmContext);
  if (context === null) {
    throw new Error('useLlm must be used inside a LlmProvider.');
  }
  return context;
}
