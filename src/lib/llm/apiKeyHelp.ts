import type { ByotProviderId } from '../types';

export interface ApiKeyHelpEntry {
  consoleUrl: string;
  docsUrl: string;
  steps: string[];
  note?: string;
}

export const API_KEY_HELP: Record<ByotProviderId, ApiKeyHelpEntry> = {
  openai: {
    consoleUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs/quickstart',
    steps: [
      'Sign in to the OpenAI Platform with your account.',
      'Open API keys and choose Create new secret key.',
      'Name the key, create it, and copy the full value immediately.',
      'Paste it here and confirm your account has API billing or credits.',
    ],
    note: 'The full key is shown only once.',
  },
  anthropic: {
    consoleUrl: 'https://platform.claude.com/settings/keys',
    docsUrl: 'https://platform.claude.com/docs/en/get-api-key',
    steps: [
      'Sign in to the Claude Console.',
      'Open Settings → API keys.',
      'Choose Create key, name it, and set an expiration if you want one.',
      'Copy the key shown at creation and paste it here.',
    ],
    note: 'Anthropic keys usually start with sk-ant-.',
  },
  google: {
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    steps: [
      'Open Google AI Studio and sign in with your Google account.',
      'Open the API keys page and choose Create API key.',
      'Select or create a Google Cloud project for the key.',
      'Copy the key and paste it here.',
    ],
    note: 'Google AI Studio may create a default project and key for new users.',
  },
  openrouter: {
    consoleUrl: 'https://openrouter.ai/settings/keys',
    docsUrl: 'https://openrouter.ai/docs/api-keys',
    steps: [
      'Sign in to OpenRouter.',
      'Open Settings → Keys.',
      'Choose Create key and optionally set a credit limit.',
      'Copy the key and paste it here.',
    ],
    note: 'OpenRouter model IDs include a vendor prefix, such as openai/gpt-4o-mini.',
  },
  groq: {
    consoleUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs/quickstart',
    steps: [
      'Sign in to GroqCloud.',
      'Open API Keys.',
      'Choose Create API Key, name it, and confirm.',
      'Copy the key shown at creation and paste it here.',
    ],
    note: 'Groq keys usually start with gsk_.',
  },
  mistral: {
    consoleUrl: 'https://console.mistral.ai/api-keys',
    docsUrl: 'https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key',
    steps: [
      'Sign in to the Mistral Studio console.',
      'Open API Keys in the sidebar.',
      'Choose Create new key, name it, and set an expiration.',
      'Copy the key immediately and paste it here.',
    ],
    note: 'The full key is shown only once.',
  },
  deepseek: {
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://api-docs.deepseek.com/',
    steps: [
      'Sign in to the DeepSeek platform.',
      'Open API keys in the console.',
      'Choose Create API key, name it, and confirm.',
      'Copy the key shown at creation and paste it here.',
    ],
    note: 'DeepSeek keys usually start with sk-.',
  },
  xai: {
    consoleUrl: 'https://console.x.ai/',
    docsUrl: 'https://docs.x.ai/developers/quickstart',
    steps: [
      'Sign in to the xAI console.',
      'Open the API Keys page for your team.',
      'Create a key and copy it immediately.',
      'Paste it here and confirm the key has access to the model you selected.',
    ],
    note: 'xAI keys usually start with xai-.',
  },
  together: {
    consoleUrl: 'https://api.together.ai/settings/api-keys',
    docsUrl: 'https://docs.together.ai/docs/quickstart',
    steps: [
      'Sign in to Together AI and open your project.',
      'Open the project API keys settings.',
      'Choose Create API Key, name it, and optionally set an expiration.',
      'Copy the key and paste it here.',
    ],
    note: 'Keys are scoped to the project where they were created.',
  },
  cerebras: {
    consoleUrl: 'https://cloud.cerebras.ai/',
    docsUrl: 'https://inference-docs.cerebras.ai/console/api-keys',
    steps: [
      'Sign in to the Cerebras Cloud Console.',
      'Open API Keys in the left navigation.',
      'Choose Generate API Key, name it, and confirm.',
      'Copy the key and paste it here.',
    ],
    note: 'Paid accounts may need to select a project first.',
  },
  perplexity: {
    consoleUrl: 'https://www.perplexity.ai/settings/api',
    docsUrl: 'https://docs.perplexity.ai/guides/getting-started',
    steps: [
      'Sign in to Perplexity and open the API Console.',
      'Add a payment method and API credits if needed.',
      'Open the API Keys tab and choose Generate API Key.',
      'Copy the key and paste it here.',
    ],
    note: 'API credits are separate from a Perplexity Pro subscription.',
  },
  fireworks: {
    consoleUrl: 'https://fireworks.ai/account/api-keys',
    docsUrl: 'https://docs.fireworks.ai/getting-started/quickstart',
    steps: [
      'Sign in to Fireworks AI.',
      'Open your account API keys page.',
      'Create a new API key and name it.',
      'Copy the key and paste it here.',
    ],
    note: 'Fireworks keys often start with fw_.',
  },
  qwen: {
    consoleUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/apiKey',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/get-api-key',
    steps: [
      'Sign in to Alibaba Cloud Model Studio / Bailian.',
      'Select the correct region in the console.',
      'Open API Key and choose Create API Key.',
      'Copy the key and the region-specific API host, then paste the key here.',
    ],
    note: 'Qwen API keys and endpoints are region-specific.',
  },
  custom: {
    consoleUrl: '',
    docsUrl: '',
    steps: [
      'Use an OpenAI-compatible endpoint that allows browser requests.',
      'Enter its base URL, for example https://example.com/v1.',
      'Paste the key required by that endpoint, if any.',
      'Enter the exact model ID provided by the endpoint operator.',
    ],
    note: 'JEPUB makes direct browser requests; the endpoint must allow CORS.',
  },
};
