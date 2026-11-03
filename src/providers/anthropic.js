const Anthropic = require('@anthropic-ai/sdk');

// Structured outputs guarantee valid JSON. "text" is listed first so it streams first,
// which is what lets the popup show the fix as it's written.
const SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    why: { type: 'array', items: { type: 'string' } },
  },
  required: ['text', 'why'],
  additionalProperties: false,
};

// If a safety classifier declines, these models can hand the request to another
// Claude model in the same call. Haiku has no server-side fallback.
const HAS_FALLBACK = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

async function stream({ apiKey, model, system, text, signal, onDelta }) {
  const client = new Anthropic({ apiKey, timeout: 30000, maxRetries: 1 });

  const response = client.beta.messages.stream(
    {
      model,
      max_tokens: 16000, // includes thinking, which is always on for current models
      system,
      messages: [{ role: 'user', content: text }],
      // a text fix doesn't need deep reasoning, and low effort keeps the popup fast
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      ...(HAS_FALLBACK.has(model) && {
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      }),
    },
    { signal },
  );

  for await (const event of response) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    )
      onDelta(event.delta.text);
  }

  const message = await response.finalMessage();
  if (message.stop_reason === 'refusal')
    throw Object.assign(new Error('Claude declined to edit this text'), {
      code: 'MODEL_REFUSED',
    });
  if (message.stop_reason === 'max_tokens')
    throw new Error('The reply was cut off. Try a shorter text.');

  // with a fallback, each model that ran reports its own usage (and price)
  const { usage } = message;
  const ran = (usage.iterations || []).filter(
    (i) => i.type === 'message' || i.type === 'fallback_message',
  );
  return ran.length
    ? ran.map((i) => ({
        model: i.model || model,
        input: i.input_tokens,
        output: i.output_tokens,
      }))
    : [{ model, input: usage.input_tokens, output: usage.output_tokens }];
}

// free call, used to verify a key before saving
async function test({ apiKey, model }) {
  const client = new Anthropic({ apiKey, timeout: 15000, maxRetries: 0 });
  await client.models.retrieve(model);
}

module.exports = { stream, test };
