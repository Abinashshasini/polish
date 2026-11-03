// What each provider offers. Prices are USD per million tokens (list prices).
const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    needsKey: true,
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-5.4-nano',
    models: [
      {
        id: 'gpt-5.4-nano',
        label: 'GPT-5.4 nano',
        note: 'Fast and cheap',
        price: { input: 0.2, output: 1.25 },
      },
    ],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    needsKey: true,
    keyPlaceholder: 'sk-ant-...',
    keyUrl: 'https://platform.claude.com/settings/keys',
    defaultModel: 'claude-opus-5-5',
    models: [
      {
        id: 'claude-opus-5-5',
        label: 'Claude Opus 5.5',
        note: 'Most capable',
        price: { input: 4, output: 20 },
      },
      {
        id: 'claude-sonnet-5-5',
        label: 'Claude Sonnet 5.5',
        note: 'Balanced',
        price: { input: 2, output: 10 },
      },
      {
        id: 'claude-haiku-5-5',
        label: 'Claude Haiku 5.5',
        note: 'Fastest and cheapest',
        price: { input: 0.1, output: 0.5 },
      },
    ],
  },
  ollama: {
    label: 'Ollama (local)',
    needsKey: false,
    defaultModel: '', // whatever the user has pulled; picked in Settings
    models: [],
  },
};

// models a refused Claude request can be rerouted to (see providers/anthropic.js)
const FALLBACK_PRICES = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
};

function priceOf(provider, model) {
  if (provider === 'ollama') return { input: 0, output: 0 }; // runs locally
  const listed = PROVIDERS[provider]?.models.find((m) => m.id === model);
  return listed?.price || FALLBACK_PRICES[model] || { input: 0, output: 0 };
}

// usage: [{ model, input, output }], one entry per model that ran (fallbacks add entries)
const costOf = (provider, usage = []) =>
  usage.reduce((sum, u) => {
    const p = priceOf(provider, u.model);
    return sum + (u.input * p.input + u.output * p.output) / 1e6;
  }, 0);

module.exports = { PROVIDERS, costOf };
