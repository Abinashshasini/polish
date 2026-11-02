require('dotenv').config();
const path = require('path');
const {
  app,
  globalShortcut,
  clipboard,
  BrowserWindow,
  ipcMain,
  screen,
  Notification,
  shell,
} = require('electron');
const { diffWords } = require('diff');
const { streamFix, testKey } = require('./ai');
const { friendlyError } = require('./errors');
const { paste, sleep } = require('./keys');
const { createTray, refreshTray } = require('./tray');
const { recordFix, usageLabel, registerUsageIpc } = require('./usage');
const {
  store,
  DEFAULT_ACTIONS,
  setApiKey,
  clearApiKey,
  getApiKey,
  keyHint,
} = require('./settings');

// only one copy of the app at a time
if (!app.requestSingleInstanceLock()) app.exit(0);

const isMac = process.platform === 'darwin';
const isDev = !!process.env.VITE_DEV_SERVER_URL;
const PRELOAD = path.join(__dirname, 'preload.js');
let popup;
let settingsWin;
let onboardingWin;
let paused = false;

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);

const isAlive = (win) => win && !win.isDestroyed();

// ---------- launch at login ----------

const canLaunchAtLogin = () => app.isPackaged;
const getLaunchAtLogin = () => app.getLoginItemSettings().openAtLogin;

function setLaunchAtLogin(on) {
  if (canLaunchAtLogin()) app.setLoginItemSettings({ openAtLogin: !!on });
  refreshTray();
}

// ---------- windows ----------

function loadRenderer(win, hash = '') {
  if (isDev)
    win.loadURL(process.env.VITE_DEV_SERVER_URL + (hash ? `#${hash}` : ''));
  else win.loadFile(path.join(__dirname, '../dist/index.html'), { hash });
}

function createPopup() {
  popup = new BrowserWindow({
    width: 440,
    height: 460,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: { preload: PRELOAD },
  });
  popup.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  loadRenderer(popup);
  popup.on('blur', () => popup.hide());
  popup.on('hide', () => cancelCurrent()); // never pay for unseen results
}

function openSettings() {
  if (isAlive(settingsWin)) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 620,
    height: 720,
    title: 'Polish Settings',
    webPreferences: { preload: PRELOAD },
  });
  loadRenderer(settingsWin, 'settings');
  if (isDev) settingsWin.webContents.openDevTools({ mode: 'detach' });
  if (isMac) app.focus({ steal: true });
  settingsWin.on('closed', () => {
    settingsWin = null;
    registerHotkeys();
  });
}

function openOnboarding() {
  if (isAlive(onboardingWin)) {
    onboardingWin.show();
    onboardingWin.focus();
    return;
  }
  onboardingWin = new BrowserWindow({
    width: 560,
    height: 640,
    title: 'Welcome to Polish',
    resizable: false,
    webPreferences: { preload: PRELOAD },
  });
  loadRenderer(onboardingWin, 'onboarding');
  if (isMac) app.focus({ steal: true });
  onboardingWin.on('closed', () => {
    onboardingWin = null;
  });
}

async function openPopup(actionId) {
  const text = String((await clipboard.readText()) || '').trim();

  const { x, y } = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint({ x, y });
  const [w, h] = popup.getSize();
  popup.setPosition(
    Math.min(x, workArea.x + workArea.width - w),
    Math.min(y + 12, workArea.y + workArea.height - h),
  );

  const actions = store
    .get('actions')
    .filter((a) => a.enabled)
    .map(({ id, label }) => ({ id, label }));

  popup.webContents.send('open', { text, actionId, actions });
  if (isMac) app.focus({ steal: true });
  popup.show();
  popup.focus();
}

function hidePopup() {
  popup.hide();
  // only hand focus back to the previous app if none of our other windows is open
  const otherWindowOpen = BrowserWindow.getAllWindows().some(
    (w) => w !== popup && !w.isDestroyed() && w.isVisible(),
  );
  if (isMac && !otherWindowOpen) app.hide();
}

// ---------- hotkeys ----------

function registerHotkeys(actions = store.get('actions')) {
  globalShortcut.unregisterAll();
  const failed = [];
  for (const a of actions) {
    if (!a.enabled || !a.hotkey) continue;
    try {
      if (!globalShortcut.register(a.hotkey, () => openPopup(a.id)))
        failed.push(a.id);
    } catch {
      failed.push(a.id);
    }
  }
  if (paused) globalShortcut.unregisterAll(); // still validated above, just not active
  return failed;
}

function setPaused(value) {
  paused = value;
  registerHotkeys();
  refreshTray();
}

function saveActions(actions) {
  store.set('actions', actions);
  registerHotkeys(actions);
  return { ok: true, actions };
}

// ---------- fix (streaming) ----------

const MAX_CHARS = 4000;
let current = null; // { id, controller }

function cancelCurrent() {
  if (current) {
    current.controller.abort();
    current = null;
  }
}

ipcMain.on('fix:start', async (e, { requestId, actionId, text }) => {
  cancelCurrent();
  const controller = new AbortController();
  current = { id: requestId, controller };

  const send = (channel, payload) => {
    if (!e.sender.isDestroyed())
      e.sender.send(channel, { requestId, ...payload });
  };

  try {
    const action = store.get('actions').find((a) => a.id === actionId);
    if (!action) throw new Error('Action not found');
    if (text.length > MAX_CHARS) {
      throw new Error(
        `Text is too long (max ${MAX_CHARS.toLocaleString()} characters).`,
      );
    }

    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('Add your OpenAI API key in Settings first.');

    const out = await streamFix(apiKey, action.prompt, text, {
      signal: controller.signal,
      onText: (partial) => send('fix:chunk', { text: partial }),
    });

    recordFix({
      actionLabel: action.label,
      input: text,
      output: out.text,
      usage: out.usage,
    });

    const parts = diffWords(text, out.text).map((p) => ({
      value: p.value,
      added: !!p.added,
      removed: !!p.removed,
    }));
    send('fix:done', { result: { ...out, parts } });

    // let the setup guide celebrate the first fix
    if (isAlive(onboardingWin))
      onboardingWin.webContents.send('onboarding:fixed');
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error('Fix failed:', err);
    send('fix:error', { message: friendlyError(err) });
  } finally {
    if (current?.id === requestId) current = null;
  }
});

ipcMain.on('fix:cancel', () => cancelCurrent());

// ---------- IPC: popup ----------

ipcMain.handle('copy', async (_e, text) => {
  await clipboard.writeText(text);
  hidePopup();
});

ipcMain.handle('replace', async (_e, text) => {
  await clipboard.writeText(text);
  hidePopup();
  await sleep(200);
  try {
    await paste();
  } catch (err) {
    console.error('Auto-paste failed:', err.message);
    new Notification({
      title: 'Polish: copied ✓',
      body: `Press ${isMac ? 'Cmd+V' : 'Ctrl+V'} to paste. (Enable Accessibility for auto-replace.)`,
    }).show();
  }
});

ipcMain.handle('close', () => hidePopup());

// ---------- IPC: settings ----------

ipcMain.handle('open-settings', () => {
  popup.hide();
  openSettings();
});

ipcMain.handle('settings:get', async () => ({
  actions: store.get('actions'),
  apiKeyHint: keyHint(await getApiKey()),
  launchAtLogin: getLaunchAtLogin(),
  canLaunchAtLogin: canLaunchAtLogin(),
}));

ipcMain.handle('settings:setLaunchAtLogin', (_e, on) => {
  setLaunchAtLogin(on);
  return { ok: true, launchAtLogin: getLaunchAtLogin() };
});

ipcMain.handle('settings:setApiKey', async (_e, rawKey) => {
  const key = String(rawKey || '').trim();

  if (!key) {
    clearApiKey();
    return { ok: true, hint: keyHint(await getApiKey()) };
  }

  try {
    await withTimeout(testKey(key), 15000, 'Key check');
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }

  try {
    await withTimeout(setApiKey(key), 15000, 'Saving to Keychain');
  } catch (err) {
    return { ok: false, error: err.message };
  }

  return { ok: true, hint: keyHint(key) };
});

ipcMain.handle('settings:saveAction', (_e, input) => {
  const label = String(input.label || '')
    .trim()
    .slice(0, 40);
  const prompt = String(input.prompt || '')
    .trim()
    .slice(0, 1000);
  if (!label || !prompt)
    return { ok: false, error: 'Name and instruction are both required' };

  const actions = store.get('actions');
  const exists = input.id && actions.some((a) => a.id === input.id);
  const next = exists
    ? actions.map((a) => (a.id === input.id ? { ...a, label, prompt } : a))
    : [
        ...actions,
        {
          id: `custom-${Date.now()}`,
          label,
          prompt,
          hotkey: '',
          enabled: true,
        },
      ];

  return saveActions(next);
});

ipcMain.handle('settings:toggleAction', (_e, id) =>
  saveActions(
    store
      .get('actions')
      .map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
  ),
);

ipcMain.handle('settings:deleteAction', (_e, id) => {
  const actions = store.get('actions');
  if (actions.length <= 1)
    return { ok: false, error: 'Keep at least one action' };
  return saveActions(actions.filter((a) => a.id !== id));
});

ipcMain.handle('settings:resetActions', () => saveActions(DEFAULT_ACTIONS));

ipcMain.handle('settings:setHotkey', (_e, id, accel) => {
  const current = store.get('actions');

  if (accel) {
    const clash = current.find((a) => a.id !== id && a.hotkey === accel);
    if (clash) return { ok: false, error: `Already used by "${clash.label}"` };
  }

  const next = current.map((a) => (a.id === id ? { ...a, hotkey: accel } : a));
  const failed = registerHotkeys(next);
  if (failed.includes(id)) {
    registerHotkeys(current);
    return { ok: false, error: 'Taken by another app or not allowed' };
  }

  store.set('actions', next);
  return { ok: true, actions: next };
});

ipcMain.handle('hotkeys:pause', () => globalShortcut.unregisterAll());
ipcMain.handle('hotkeys:resume', () => {
  registerHotkeys();
});

// ---------- IPC: onboarding ----------

ipcMain.handle('onboarding:getInfo', async () => {
  const actions = store.get('actions');
  const pick =
    actions.find((a) => a.id === 'grammar' && a.enabled && a.hotkey) ||
    actions.find((a) => a.enabled && a.hotkey);
  return {
    platform: process.platform,
    isDev,
    apiKeyHint: keyHint(await getApiKey()),
    hotkey: pick?.hotkey || '',
  };
});

// pastes a test string into whatever is focused (the onboarding window's test box)
ipcMain.handle('onboarding:testPaste', async () => {
  const original = String((await clipboard.readText()) || '');
  await clipboard.writeText('Auto-replace works ✓');
  try {
    await paste();
    await sleep(300);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await clipboard.writeText(original); // give the user's clipboard back
  }
});

ipcMain.handle('onboarding:openAccessibility', () => {
  if (isMac) {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    );
  }
});

ipcMain.handle('onboarding:finish', () => {
  store.set('onboarded', true);
  if (isAlive(onboardingWin)) onboardingWin.close();
});

// only allow opening OpenAI pages from the UI
ipcMain.handle('open-external', (_e, url) => {
  if (/^https:\/\/(platform\.)?openai\.com\//.test(String(url)))
    shell.openExternal(url);
});

registerUsageIpc({ onChange: () => refreshTray() });

// ---------- lifecycle ----------

app.on('second-instance', () => openSettings());

app.whenReady().then(async () => {
  app.dock?.hide();
  createPopup();
  createTray({
    getState: () => ({
      paused,
      launchAtLogin: getLaunchAtLogin(),
      canLaunchAtLogin: canLaunchAtLogin(),
      usageLabel: usageLabel(),
    }),
    onSettings: openSettings,
    onOnboarding: openOnboarding,
    onTogglePause: () => setPaused(!paused),
    onToggleLaunchAtLogin: (on) => setLaunchAtLogin(on),
    onQuit: () => app.quit(),
  });
  registerHotkeys();

  if (!store.get('onboarded'))
    openOnboarding(); // first run
  else if (!(await getApiKey())) openSettings(); // key was removed later
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());
