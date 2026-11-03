const openai = require('./openai');

// Ollama serves an OpenAI-compatible API on this machine, so text never leaves it
const BASE_URL = 'http://127.0.0.1:11434';

const stream = (opts) =>
  openai.stream(
    { ...opts, apiKey: 'ollama' }, // required by the SDK, ignored by Ollama
    { baseURL: `${BASE_URL}/v1`, timeout: 120000 }, // first run loads the model into memory
  );

// names of the models the user has pulled, e.g. "llama3.2:latest"
async function listModels() {
  const res = await fetch(`${BASE_URL}/api/tags`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw Object.assign(new Error('Ollama error'), { status: res.status });
  const { models = [] } = await res.json();
  return models.map((m) => m.name);
}

async function test({ model }) {
  const models = await listModels();
  if (!models.includes(model))
    throw Object.assign(new Error(`Model "${model}" isn't installed`), {
      code: 'OLLAMA_MODEL_MISSING',
    });
}

module.exports = { stream, test, listModels };
