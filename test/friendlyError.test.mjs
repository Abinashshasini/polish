import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { friendlyError } = require('../src/errors.js');

// errors shaped like the ones the OpenAI SDK and Node's fetch throw
const apiError = (status, code) => Object.assign(new Error('api'), { status, code });
const withCause = (code, nested = false) =>
  Object.assign(new Error('fetch failed'), {
    cause: nested ? { cause: { code } } : { code },
  });
const named = (name) => {
  const Err = { [name]: class extends Error {} }[name];
  return new Err('x');
};

describe('friendlyError', () => {
  it('explains a bad or revoked key', () => {
    expect(friendlyError(apiError(401))).toMatch(/invalid or was revoked/);
  });

  it('tells "out of credit" apart from plain rate limiting', () => {
    expect(friendlyError(apiError(429, 'insufficient_quota'))).toMatch(
      /out of OpenAI credit/,
    );
    expect(friendlyError(apiError(429))).toMatch(/Too many requests/);
  });

  it('reads the quota code from the nested error body too', () => {
    const err = Object.assign(new Error('api'), {
      status: 429,
      error: { code: 'insufficient_quota' },
    });
    expect(friendlyError(err)).toMatch(/out of OpenAI credit/);
  });

  it('flags a retired model', () => {
    expect(friendlyError(apiError(404))).toMatch(/model is unavailable/);
  });

  it('blames OpenAI for 5xx errors', () => {
    expect(friendlyError(apiError(500))).toMatch(/OpenAI is having problems/);
    expect(friendlyError(apiError(503))).toMatch(/OpenAI is having problems/);
  });

  it('recognises timeouts by error class or message', () => {
    expect(friendlyError(named('APIConnectionTimeoutError'))).toMatch(/too long/);
    expect(friendlyError(new Error('Key check timed out'))).toMatch(/too long/);
  });

  it('spots corporate TLS interception (e.g. Zscaler)', () => {
    expect(friendlyError(withCause('SELF_SIGNED_CERT_IN_CHAIN'))).toMatch(
      /network security tool/,
    );
    expect(
      friendlyError(withCause('UNABLE_TO_GET_ISSUER_CERT_LOCALLY', true)),
    ).toMatch(/network security tool/);
  });

  it('reports connection problems', () => {
    expect(friendlyError(withCause('ENOTFOUND'))).toMatch(/Can't reach OpenAI/);
    expect(friendlyError(withCause('ECONNRESET', true))).toMatch(
      /Can't reach OpenAI/,
    );
    expect(friendlyError(named('APIConnectionError'))).toMatch(
      /Can't reach OpenAI/,
    );
  });

  it('explains malformed AI replies', () => {
    let err;
    try {
      JSON.parse('{"text": "unterminated');
    } catch (e) {
      err = e;
    }
    expect(friendlyError(err)).toMatch(/unexpected reply/);
  });

  it('falls back to the original message, then to a generic one', () => {
    expect(friendlyError(new Error('Action not found'))).toBe('Action not found');
    expect(friendlyError(undefined)).toBe('Something went wrong. Please retry.');
    expect(friendlyError({})).toBe('Something went wrong. Please retry.');
  });
});
