const OpenAI = require('openai');

// clientOptions lets Ollama reuse this with its OpenAI-compatible endpoint
async function stream(
  { apiKey, model, system, text, signal, onDelta },
  clientOptions = {},
) {
  const client = new OpenAI({
    apiKey,
    timeout: 30000,
    maxRetries: 1,
    ...clientOptions,
  });

  const response = await client.chat.completions.create(
    {
      model,
      stream: true,
      stream_options: { include_usage: true }, // token usage arrives in the last chunk
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
    },
    { signal },
  );

  let usage = null;
  for await (const chunk of response) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) onDelta(delta);
    if (chunk.usage) usage = chunk.usage;
  }

  return usage
    ? [
        {
          model,
          input: usage.prompt_tokens || 0,
          output: usage.completion_tokens || 0,
        },
      ]
    : [];
}

// free call, used to verify a key before saving
async function test({ apiKey, model }) {
  const client = new OpenAI({ apiKey, timeout: 15000, maxRetries: 0 });
  await client.models.retrieve(model);
}

module.exports = { stream, test };
