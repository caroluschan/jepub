import type { ChatMessage } from '../types';

export type LlmProgress = (percent: number | null) => void;

type WorkerResponse =
  | { type: 'downloading'; file?: string; loaded?: number; total?: number; percent?: number }
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'token'; id: number; token: string }
  | { type: 'done'; id: number; text: string }
  | { type: 'error'; id?: number; message: string }
  | { type: 'cleared' };

interface PendingGeneration {
  onToken: (token: string) => void;
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export class LlmClient {
  private worker: Worker | null = null;
  private ready = false;
  private loadPromise: Promise<void> | null = null;
  private loadResolve: (() => void) | null = null;
  private loadReject: ((error: Error) => void) | null = null;
  private progress: LlmProgress | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingGeneration>();
  private clearResolve: (() => void) | null = null;

  private ensureWorker(): Worker {
    if (this.worker !== null) return this.worker;
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event.data);
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'The local model worker failed.');
      this.failAll(error);
    };
    this.worker = worker;
    return worker;
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === 'downloading') {
      const percent =
        typeof message.percent === 'number'
          ? Math.max(0, Math.min(100, message.percent * 100))
          : typeof message.loaded === 'number' && typeof message.total === 'number' && message.total > 0
            ? Math.max(0, Math.min(100, (message.loaded / message.total) * 100))
            : null;
      this.progress?.(percent);
      return;
    }
    if (message.type === 'loading') {
      this.progress?.(null);
      return;
    }
    if (message.type === 'ready') {
      this.ready = true;
      this.loadResolve?.();
      this.loadResolve = null;
      this.loadReject = null;
      this.progress?.(100);
      return;
    }
    if (message.type === 'token') {
      this.pending.get(message.id)?.onToken(message.token);
      return;
    }
    if (message.type === 'done') {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      pending?.resolve(message.text);
      return;
    }
    if (message.type === 'error') {
      const error = new Error(message.message);
      if (typeof message.id === 'number') {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        pending?.reject(error);
      } else {
        this.loadReject?.(error);
        this.loadReject = null;
        this.loadResolve = null;
        this.loadPromise = null;
        this.ready = false;
        this.failAll(error);
      }
      return;
    }
    if (message.type === 'cleared') {
      this.clearResolve?.();
      this.clearResolve = null;
    }
  }

  private failAll(error: Error): void {
    this.loadReject?.(error);
    this.loadReject = null;
    this.loadResolve = null;
    this.loadPromise = null;
    this.ready = false;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  load(onProgress: LlmProgress): Promise<void> {
    if (this.ready) {
      onProgress(100);
      return Promise.resolve();
    }
    if (this.loadPromise !== null) {
      this.progress = onProgress;
      return this.loadPromise;
    }
    this.progress = onProgress;
    this.loadPromise = new Promise<void>((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
      this.ensureWorker().postMessage({ type: 'load' });
    }).catch((error: unknown) => {
      this.ready = false;
      this.loadPromise = null;
      throw error instanceof Error ? error : new Error('The local model could not be loaded.');
    });
    return this.loadPromise;
  }

  generate(
    messages: ChatMessage[],
    onToken: (token: string) => void,
    maxTokens = 220,
  ): Promise<string> {
    if (!this.ready) return Promise.reject(new Error('The local model is not ready yet.'));
    const id = this.nextId++;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { onToken, resolve, reject });
      this.ensureWorker().postMessage({
        type: 'generate',
        id,
        messages,
        maxTokens,
      });
    });
  }

  clearCache(): Promise<void> {
    if (this.worker === null) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.clearResolve = resolve;
      this.worker?.postMessage({ type: 'clear-cache' });
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.loadPromise = null;
    this.loadResolve = null;
    this.loadReject = null;
    this.progress = null;
    this.pending.clear();
  }
}
