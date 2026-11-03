import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// src/ is CommonJS (Electron main process), so load it the way Electron does
const require = createRequire(import.meta.url);
const { extractPartialText } = require('../src/ai.js');

describe('extractPartialText', () => {
  it('returns null until the "text" key has arrived', () => {
    expect(extractPartialText('')).toBeNull();
    expect(extractPartialText('{')).toBeNull();
    expect(extractPartialText('{"te')).toBeNull();
    expect(extractPartialText('{"text":')).toBeNull();
  });

  it('returns an empty string once the value has opened', () => {
    expect(extractPartialText('{"text":"')).toBe('');
  });

  it('returns the unfinished value while streaming', () => {
    expect(extractPartialText('{"text":"Hel')).toBe('Hel');
    expect(extractPartialText('{"text": "Hello wor')).toBe('Hello wor');
  });

  it('stops at the closing quote and ignores what follows', () => {
    expect(extractPartialText('{"text":"Hello","why":["x"]}')).toBe('Hello');
  });

  it('tolerates whitespace around the colon', () => {
    expect(extractPartialText('{ "text"  :   "Hi')).toBe('Hi');
  });

  it('decodes simple escapes', () => {
    expect(extractPartialText('{"text":"a\\nb\\tc\\"d\\\\e\\/f')).toBe(
      'a\nb\tc"d\\e/f',
    );
  });

  it('does not end the value on an escaped quote', () => {
    expect(extractPartialText('{"text":"say \\"hi\\" now"}')).toBe(
      'say "hi" now',
    );
  });

  it('waits when the stream ends mid-escape', () => {
    expect(extractPartialText('{"text":"line\\')).toBe('line');
  });

  it('decodes \\u escapes, waiting for all four hex digits', () => {
    expect(extractPartialText('{"text":"caf\\u00')).toBe('caf');
    expect(extractPartialText('{"text":"caf\\u00e')).toBe('caf');
    expect(extractPartialText('{"text":"caf\\u00e9')).toBe('café');
  });

  it('rebuilds emoji from surrogate pairs', () => {
    expect(extractPartialText('{"text":"hi \\ud83d\\ude00"}')).toBe('hi 😀');
  });

  it('passes raw (unescaped) unicode straight through', () => {
    expect(extractPartialText('{"text":"नमस्ते 👋')).toBe('नमस्ते 👋');
  });

  it('matches what JSON.parse gives for the finished string', () => {
    const value = 'Tabs\there, "quotes", back\\slash, emoji 🎉, é';
    const raw = JSON.stringify({ text: value, why: [] });
    expect(extractPartialText(raw)).toBe(value);
  });

  it('never runs ahead of JSON.parse on any prefix of the stream', () => {
    const value = 'He said "hi"\nthen left é 🎉';
    const raw = JSON.stringify({ text: value, why: ['tense'] });
    for (let i = 0; i <= raw.length; i++) {
      const partial = extractPartialText(raw.slice(0, i));
      if (partial !== null) expect(value.startsWith(partial)).toBe(true);
    }
  });
});
