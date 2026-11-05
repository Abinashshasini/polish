const Store = require('electron-store');
const { safeStorage } = require('electron');
const { PROVIDERS } = require('./providers/catalog');

const DEFAULT_ACTIONS = [
  {
    id: 'spelling',
    label: 'Fix spelling',
    hotkey: 'Alt+Shift+S',
    enabled: true,
    prompt: 'Fix only spelling mistakes. Do not change grammar or wording.',
  },
  {
    id: 'grammar',
    label: 'Fix grammar',
    hotkey: 'Alt+Shift+G',
    enabled: true,
    prompt:
      'Fix all spelling and grammar mistakes, including tense. The result must be correct, natural English. Keep the original meaning and tone, and change wording only where needed.',
  },
  {
    id: 'casual',
    label: 'Casual 😊',
    hotkey: '',
    enabled: true,
    prompt:
      'Fix all mistakes and rewrite it in a relaxed, friendly tone, like a Slack message to a teammate.',
  },
  {
    id: 'professional',
    label: 'Professional 💼',
    hotkey: '',
    enabled: true,
    prompt:
      'Fix all mistakes and rewrite it in a clear, polite, professional tone, like a work email.',
  },
  {
    id: 'fun',
    label: 'Fun 🎉',
    hotkey: '',
    enabled: true,
    prompt:
      'Fix all mistakes and rewrite it in a playful, light tone with some personality. Emojis allowed sparingly.',
  },
];

const store = new Store({
  defaults: {
    actions: DEFAULT_ACTIONS,
    menuHotkey: 'Alt+Shift+Space', // opens the popup to pick an action
    provider: 'openai',
    apiKeysEnc: {}, // { [provider]: base64 of the keychain-encrypted key }
    models: {}, // { [provider]: model id }, empty = provider default
    budget: 5,
    usage: { inputTokens: 0, outputTokens: 0, fixes: 0, spent: 0, since: null },
    history: [],
    historyEnabled: true,
    onboarded: false,
  },
});

// migrate hotkeys saved in Step 6
if (store.has('hotkeys')) {
  const old = store.get('hotkeys');
  store.set(
    'actions',
    store.get('actions').map((a) => ({ ...a, hotkey: old[a.id] ?? a.hotkey })),
  );
  store.delete('hotkeys');
}

// migrate the single OpenAI key from before providers existed
if (store.has('apiKeyEnc')) {
  const old = store.get('apiKeyEnc');
  if (old) store.set('apiKeysEnc.openai', old);
  store.delete('apiKeyEnc');
}

// ---------- provider + model ----------

const getProvider = () => {
  const id = store.get('provider');
  return PROVIDERS[id] ? id : 'openai';
};

const getModel = (provider) =>
  store.get(`models.${provider}`) || PROVIDERS[provider].defaultModel;

// ---------- API keys (encrypted with OS keychain) ----------
// Newer Electron has async safeStorage APIs; older versions only have the sync ones.

async function isEncryptionAvailable() {
  if (typeof safeStorage.isAsyncEncryptionAvailable === 'function') {
    return safeStorage.isAsyncEncryptionAvailable();
  }
  return safeStorage.isEncryptionAvailable();
}

async function encrypt(text) {
  if (typeof safeStorage.encryptStringAsync === 'function') {
    return safeStorage.encryptStringAsync(text);
  }
  return safeStorage.encryptString(text);
}

async function decrypt(buffer) {
  if (typeof safeStorage.decryptStringAsync === 'function') {
    const out = await safeStorage.decryptStringAsync(buffer);
    return typeof out === 'string' ? out : out?.result; // async version returns { result, ... }
  }
  return safeStorage.decryptString(buffer);
}

async function setApiKey(provider, key) {
  if (!(await isEncryptionAvailable())) {
    throw new Error('Secure storage is not available on this system');
  }
  const encrypted = await encrypt(key);
  store.set(
    `apiKeysEnc.${provider}`,
    Buffer.from(encrypted).toString('base64'),
  );
}

function clearApiKey(provider) {
  store.delete(`apiKeysEnc.${provider}`);
}

const ENV_KEYS = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };

async function getApiKey(provider) {
  const enc = store.get(`apiKeysEnc.${provider}`);
  if (enc) {
    try {
      const key = await decrypt(Buffer.from(enc, 'base64'));
      if (typeof key === 'string' && key) return key;
    } catch {
      /* fall through */
    }
  }
  return process.env[ENV_KEYS[provider]] || ''; // dev fallback
}

const keyHint = (key) =>
  typeof key === 'string' && key ? `${key.slice(0, 3)}…${key.slice(-4)}` : '';

module.exports = {
  store,
  DEFAULT_ACTIONS,
  getProvider,
  getModel,
  setApiKey,
  clearApiKey,
  getApiKey,
  keyHint,
};
