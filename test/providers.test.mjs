import http from 'node:http';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { streamFix } = require('../src/ai.js');
const { friendlyError } = require('../src/errors.js');

// A local stand-in for the provider APIs. The real SDKs talk to it through their
// *_BASE_URL env vars, so the adapters run unchanged.
let server;
let lastRequest;
let reply; // (req, res) => void, set per test

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastRequest = { url: req.url, headers: req.headers, body: JSON.parse(body || '{}') };
      reply(req, res);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.ANTHROPIC_BASE_URL = base;
  process.env.OPENAI_BASE_URL = `${base}/v1`;
});

afterAll(() => server.close());
beforeEach(() => (lastRequest = null));

const sse = (res, events) => {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const [event, data] of events)
    res.write(`${event ? `event: ${event}\n` : ''}data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
  res.end();
};

// the model's JSON reply, split into small pieces like a real stream
const REPLY = JSON.stringify({ text: 'I have finished the report.', why: ['has → have'] });
const pieces = REPLY.match(/.{1,7}/gs);

const anthropicStream = (stopReason, usage = { input_tokens: 50, output_tokens: 20 }) => [
  ['message_start', {
    type: 'message_start',
    message: {
      id: 'msg_1', type: 'message', role: 'assistant', model: lastRequest.body.model,
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: usage.input_tokens, output_tokens: 1 },
    },
  }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
  ...pieces.map((p) => ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p } }]),
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: usage.output_tokens, ...(usage.iterations && { iterations: usage.iterations }) },
  }],
  ['message_stop', { type: 'message_stop' }],
];

const run = (provider, model, onText = () => {}) =>
  streamFix({ provider, model, apiKey: 'test-key' }, 'Fix grammar.', 'I has finished the report.', {
    signal: new AbortController().signal,
    onText,
  });

describe('Anthropic adapter', () => {
  it('streams the fix, and reports usage and cost', async () => {
    reply = (_req, res) => sse(res, anthropicStream('end_turn'));
    const partials = [];
    const out = await run('anthropic', 'claude-opus-5-5', (t) => partials.push(t));

    expect(out.text).toBe('I have finished the report.');
    expect(out.why).toEqual(['has → have']);
    expect(out.usage).toEqual([{ model: 'claude-opus-5-5', input: 50, output: 20 }]);
    expect(out.cost).toBeCloseTo((50 * 4 + 20 * 20) / 1e6, 10);
    // the popup saw the text grow, never more than the final text
    expect(partials.length).toBeGreaterThan(2);
    for (const p of partials) expect(out.text.startsWith(p)).toBe(true);
  });

  it('asks for schema-constrained JSON at low effort, with refusal fallback', async () => {
    reply = (_req, res) => sse(res, anthropicStream('end_turn'));
    await run('anthropic', 'claude-opus-5-5');

    const { body, headers } = lastRequest;
    expect(body.output_config.effort).toBe('low');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(Object.keys(body.output_config.format.schema.properties)).toEqual(['text', 'why']);
    expect(body.fallbacks).toBe('default');
    expect(headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    // SDK 1.x sends the key as a bearer token; older ones used x-api-key
    expect(headers.authorization || headers['x-api-key']).toMatch(/test-key$/);
    expect(body.messages).toEqual([{ role: 'user', content: 'I has finished the report.' }]);
  });

  it('does not request a fallback for Haiku (it has none)', async () => {
    reply = (_req, res) => sse(res, anthropicStream('end_turn'));
    await run('anthropic', 'claude-haiku-5-5');
    expect(lastRequest.body.fallbacks).toBeUndefined();
    expect(lastRequest.headers['anthropic-beta']).toBeUndefined();
  });

  it('prices each model that ran when a fallback kicked in', async () => {
    reply = (_req, res) =>
      sse(res, anthropicStream('end_turn', {
        input_tokens: 60,
        output_tokens: 15,
        iterations: [
          { type: 'message', model: 'claude-opus-5-5', input_tokens: 50, output_tokens: 5, cache_creation: null, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          { type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: 60, output_tokens: 15, cache_creation: null, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        ],
      }));
    const out = await run('anthropic', 'claude-opus-5-5');
    expect(out.usage.map((u) => u.model)).toEqual(['claude-opus-5-5', 'claude-opus-4-8']);
    expect(out.cost).toBeCloseTo((50 * 4 + 5 * 20 + 60 * 5 + 15 * 25) / 1e6, 10);
  });

  it('turns a refusal into a clear message instead of a parse error', async () => {
    reply = (_req, res) => sse(res, anthropicStream('refusal'));
    const err = await run('anthropic', 'claude-opus-5-5').catch((e) => e);
    expect(err.code).toBe('MODEL_REFUSED');
    expect(friendlyError(err, 'anthropic')).toMatch(/declined to edit/);
  });

  it('surfaces a bad key as a 401', async () => {
    reply = (_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    };
    const err = await run('anthropic', 'claude-opus-5-5').catch((e) => e);
    expect(friendlyError(err, 'anthropic')).toMatch(/invalid or was revoked/);
  });
});

describe('OpenAI adapter', () => {
  it('streams the fix, and reports usage and cost', async () => {
    reply = (_req, res) =>
      sse(res, [
        ...pieces.map((p) => [null, { id: 'c1', object: 'chat.completion.chunk', created: 0, model: 'gpt-5.4-nano', choices: [{ index: 0, delta: { content: p }, finish_reason: null }] }]),
        [null, { id: 'c1', object: 'chat.completion.chunk', created: 0, model: 'gpt-5.4-nano', choices: [], usage: { prompt_tokens: 40, completion_tokens: 30, total_tokens: 70 } }],
        [null, '[DONE]'],
      ]);
    const out = await run('openai', 'gpt-5.4-nano');

    expect(out.text).toBe('I have finished the report.');
    expect(out.usage).toEqual([{ model: 'gpt-5.4-nano', input: 40, output: 30 }]);
    expect(out.cost).toBeCloseTo((40 * 0.2 + 30 * 1.25) / 1e6, 10);
    expect(lastRequest.body.response_format).toEqual({ type: 'json_object' });
    expect(lastRequest.body.messages[0].role).toBe('system');
  });
});
