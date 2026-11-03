const { ipcMain, clipboard } = require('electron');
const { store } = require('./settings');
const { PRICE } = require('./ai');

const HISTORY_LIMIT = 50;
const EMPTY_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  fixes: 0,
  spent: 0,
  since: null,
};

let onChange = () => {};

const costOf = (usage = {}) =>
  (usage.prompt_tokens || 0) * PRICE.input +
  (usage.completion_tokens || 0) * PRICE.output;

// called after every successful fix
function recordFix({ actionLabel, input, output, usage }) {
  const cost = costOf(usage);
  const u = { ...EMPTY_USAGE, ...store.get('usage') };

  store.set('usage', {
    inputTokens: u.inputTokens + (usage?.prompt_tokens || 0),
    outputTokens: u.outputTokens + (usage?.completion_tokens || 0),
    fixes: u.fixes + 1,
    spent: u.spent + cost,
    since: u.since || Date.now(),
  });

  if (store.get('historyEnabled')) {
    const entry = {
      id: `${Date.now()}`,
      ts: Date.now(),
      actionLabel,
      input,
      output,
      cost,
    };
    store.set(
      'history',
      [entry, ...store.get('history')].slice(0, HISTORY_LIMIT),
    );
  }

  onChange();
}

function getUsageSummary() {
  const u = { ...EMPTY_USAGE, ...store.get('usage') };
  const budget = store.get('budget');
  const avgCost = u.fixes ? u.spent / u.fixes : 0.0002; // estimate until we have real data
  const left = Math.max(0, budget - u.spent);
  return { ...u, budget, left, fixesLeft: Math.floor(left / avgCost) };
}

const compact = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`;

function usageLabel() {
  const s = getUsageSummary();
  return `$${s.spent.toFixed(2)} of $${s.budget} used · ~${compact(s.fixesLeft)} fixes left`;
}

function registerUsageIpc(options = {}) {
  if (options.onChange) onChange = options.onChange;

  ipcMain.handle('usage:get', () => ({
    usage: getUsageSummary(),
    history: store.get('history'),
    historyEnabled: store.get('historyEnabled'),
  }));

  ipcMain.handle('usage:setBudget', (_e, amount) => {
    const n = Number(amount);
    if (!(n > 0 && n <= 10000))
      return { ok: false, error: 'Enter an amount above 0' };
    store.set('budget', n);
    onChange();
    return { ok: true, usage: getUsageSummary() };
  });

  ipcMain.handle('usage:reset', () => {
    store.set('usage', { ...EMPTY_USAGE });
    onChange();
    return { ok: true, usage: getUsageSummary() };
  });

  ipcMain.handle('history:clear', () => {
    store.set('history', []);
    return { ok: true };
  });

  ipcMain.handle('history:setEnabled', (_e, on) => {
    store.set('historyEnabled', !!on);
    if (!on) store.set('history', []); // turning off also deletes saved history
    return { ok: true };
  });

  ipcMain.handle('history:copy', async (_e, text) => {
    await clipboard.writeText(String(text));
    return { ok: true };
  });
}

module.exports = { recordFix, usageLabel, registerUsageIpc };
