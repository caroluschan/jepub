import {
  AutoTokenizer,
  Qwen3_5ForCausalLM,
  TextStreamer,
  env,
} from '@huggingface/transformers';
import type { ChatMessage } from '../types';

const MODEL_ID = 'onnx-community/Qwen3.5-0.8B-ONNX';
const SYSTEM_PROMPT =
  'You are JEPUB\'s concise Japanese tutor. Explain Japanese grammar and meaning in English using the readings and romaji supplied by the reader. Never invent a kanji reading. If the supplied material is insufficient, say so briefly. Keep answers under 220 words.';

interface ProgressInfo {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
  progress?: number;
}

type WorkerRequest =
  | { type: 'load' }
  | { type: 'generate'; id: number; messages: ChatMessage[]; maxTokens: number }
  | { type: 'clear-cache' }
  | { type: 'dispose' };

type WorkerResponse =
  | { type: 'downloading'; file?: string; loaded?: number; total?: number; percent?: number }
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'token'; id: number; token: string }
  | { type: 'done'; id: number; text: string }
  | { type: 'error'; id?: number; message: string }
  | { type: 'cleared' };

type Tokenizer = Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
type Model = Awaited<ReturnType<typeof Qwen3_5ForCausalLM.from_pretrained>>;

const workerScope = self as unknown as {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

let tokenizer: Tokenizer | null = null;
let model: Model | null = null;
let loadPromise: Promise<void> | null = null;
let generating = false;

function configureRuntime(): void {
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
  const wasm = env.backends.onnx.wasm;
  if (wasm !== undefined) {
    wasm.wasmPaths = {
      mjs: `${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.asyncify.wasm`,
    };
  }
}

function reportProgress(progress: unknown): void {
  if (typeof progress !== 'object' || progress === null) return;
  const info = progress as ProgressInfo;
  if (info.status === 'progress') {
    workerScope.postMessage({
      type: 'downloading',
      ...(info.file === undefined ? {} : { file: info.file }),
      ...(info.loaded === undefined ? {} : { loaded: info.loaded }),
      ...(info.total === undefined ? {} : { total: info.total }),
      ...(info.progress === undefined ? {} : { percent: info.progress }),
    });
    return;
  }
  if (info.status === 'done') {
    workerScope.postMessage({ type: 'loading' });
  }
}

async function loadModel(): Promise<void> {
  if (tokenizer !== null && model !== null) {
    workerScope.postMessage({ type: 'ready' });
    return;
  }
  if (loadPromise !== null) return loadPromise;

  loadPromise = (async () => {
    configureRuntime();
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
      progress_callback: reportProgress,
    });
    model = await Qwen3_5ForCausalLM.from_pretrained(MODEL_ID, {
      device: 'webgpu',
      dtype: {
        embed_tokens: 'q4f16',
        decoder_model_merged: 'q4f16',
        vision_encoder: 'q4f16',
      },
      progress_callback: reportProgress,
    });
    workerScope.postMessage({ type: 'ready' });
  })().catch((error: unknown) => {
    loadPromise = null;
    tokenizer = null;
    model = null;
    throw error;
  });

  return loadPromise;
}

async function generate(id: number, messages: ChatMessage[], maxTokens: number): Promise<void> {
  if (generating) {
    workerScope.postMessage({
      type: 'error',
      id,
      message: 'The local model is already working on another answer.',
    });
    return;
  }
  generating = true;
  try {
    await loadModel();
    if (tokenizer === null || model === null) throw new Error('The local model is not loaded.');

    const chat = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...messages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
    ];
    const templateOptions = {
      tokenize: false,
      add_generation_prompt: true,
      enable_thinking: false,
    } as unknown as Parameters<typeof tokenizer.apply_chat_template>[1];
    const prompt = tokenizer.apply_chat_template(chat, templateOptions) as string;
    const inputs = await tokenizer(prompt);
    let output = '';
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => {
        output += token;
        workerScope.postMessage({ type: 'token', id, token });
      },
    });
    await model.generate({
      ...inputs,
      max_new_tokens: maxTokens,
      do_sample: false,
      streamer,
    });
    workerScope.postMessage({ type: 'done', id, text: output });
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      id,
      message: error instanceof Error ? error.message : 'The local model failed.',
    });
  } finally {
    generating = false;
  }
}

async function clearModelCache(): Promise<void> {
  if (typeof caches !== 'undefined') {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.includes('transformers') || name.includes('onnx'))
        .map((name) => caches.delete(name)),
    );
  }
  tokenizer = null;
  model = null;
  loadPromise = null;
  workerScope.postMessage({ type: 'cleared' });
}

workerScope.onmessage = (event) => {
  const request = event.data;
  if (request.type === 'load') {
    void loadModel().catch((error: unknown) => {
      workerScope.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'The local model could not be loaded.',
      });
    });
    return;
  }
  if (request.type === 'generate') {
    void generate(request.id, request.messages, request.maxTokens);
    return;
  }
  if (request.type === 'clear-cache') {
    void clearModelCache().catch((error: unknown) => {
      workerScope.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'The model cache could not be cleared.',
      });
    });
    return;
  }
  tokenizer = null;
  model = null;
  loadPromise = null;
};
