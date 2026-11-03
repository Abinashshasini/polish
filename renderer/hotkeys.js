const isMac = window.polish.platform === 'darwin';

const CODE_MAP = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
};

// use e.code (physical key), because on Mac Option+G types "©" in e.key
function keyFromCode(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
  return CODE_MAP[code] || null;
}

// KeyboardEvent → Electron accelerator, e.g. "Alt+Shift+G"
export function toAccelerator(e) {
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return null; // still holding modifiers
  const key = keyFromCode(e.code);
  if (!key) return null;

  const mods = [];
  if (e.metaKey) mods.push(isMac ? 'Command' : 'Super');
  if (e.ctrlKey) mods.push('Control');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  const hasStrongModifier = e.metaKey || e.ctrlKey || e.altKey; // Shift alone would block typing
  const isFKey = /^F\d+$/.test(key);
  if (!hasStrongModifier && !isFKey) return null;

  return [...mods, key].join('+');
}

const MAC_SYMBOLS = { Command: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧' };

// "Alt+Shift+G" → "⌥⇧G" on Mac, "Alt + Shift + G" on Windows
export function formatAccelerator(accel) {
  if (!accel) return '';
  const parts = accel.split('+');
  if (isMac) return parts.map((p) => MAC_SYMBOLS[p] || p).join('');
  return parts
    .map((p) => (p === 'Super' ? 'Win' : p === 'Control' ? 'Ctrl' : p))
    .join(' + ');
}
