import { describe, expect, it } from 'vitest';
import { formatAccelerator, toAccelerator } from '../renderer/hotkeys.js';

// minimal KeyboardEvent stand-in
const key = (code, mods = {}, keyValue = code) => ({
  code,
  key: keyValue,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('toAccelerator', () => {
  it('waits while only modifiers are held', () => {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta'])
      expect(toAccelerator(key(`${k}Left`, { altKey: true }, k), 'darwin')).toBeNull();
  });

  it('uses the physical key, not the typed character (Option+G = ©)', () => {
    const e = key('KeyG', { altKey: true, shiftKey: true }, '©');
    expect(toAccelerator(e, 'darwin')).toBe('Alt+Shift+G');
  });

  it('maps the Meta key per platform', () => {
    const e = key('KeyK', { metaKey: true });
    expect(toAccelerator(e, 'darwin')).toBe('Command+K');
    expect(toAccelerator(e, 'win32')).toBe('Super+K');
  });

  it('orders modifiers consistently', () => {
    const e = key('KeyA', {
      metaKey: true,
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(toAccelerator(e, 'darwin')).toBe('Command+Control+Alt+Shift+A');
  });

  it('rejects plain keys and Shift-only combos (they would block typing)', () => {
    expect(toAccelerator(key('KeyG'), 'darwin')).toBeNull();
    expect(toAccelerator(key('KeyG', { shiftKey: true }), 'darwin')).toBeNull();
  });

  it('allows function keys on their own', () => {
    expect(toAccelerator(key('F5'), 'win32')).toBe('F5');
    expect(toAccelerator(key('F12', { shiftKey: true }), 'win32')).toBe(
      'Shift+F12',
    );
  });

  it('handles digits and punctuation', () => {
    expect(toAccelerator(key('Digit1', { ctrlKey: true }), 'win32')).toBe(
      'Control+1',
    );
    expect(toAccelerator(key('Slash', { altKey: true }), 'win32')).toBe('Alt+/');
    expect(toAccelerator(key('Space', { ctrlKey: true }), 'win32')).toBe(
      'Control+Space',
    );
  });

  it('ignores keys it cannot map', () => {
    expect(toAccelerator(key('NumpadAdd', { ctrlKey: true }), 'win32')).toBeNull();
  });
});

describe('formatAccelerator', () => {
  it('uses symbols on macOS', () => {
    expect(formatAccelerator('Alt+Shift+G', 'darwin')).toBe('⌥⇧G');
    expect(formatAccelerator('Command+Control+K', 'darwin')).toBe('⌘⌃K');
  });

  it('uses readable names on Windows', () => {
    expect(formatAccelerator('Control+Super+Alt+K', 'win32')).toBe(
      'Ctrl + Win + Alt + K',
    );
  });

  it('returns an empty string for no hotkey', () => {
    expect(formatAccelerator('', 'darwin')).toBe('');
    expect(formatAccelerator(undefined, 'win32')).toBe('');
  });

  it('round-trips with toAccelerator', () => {
    const accel = toAccelerator(key('KeyS', { altKey: true, shiftKey: true }), 'darwin');
    expect(formatAccelerator(accel, 'darwin')).toBe('⌥⇧S');
  });
});
