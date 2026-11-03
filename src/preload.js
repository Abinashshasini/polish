const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('polish', {
  platform: process.platform,

  // popup
  onOpen: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('open', handler);
    return () => ipcRenderer.removeListener('open', handler);
  },
  startFix: (requestId, actionId, text) =>
    ipcRenderer.send('fix:start', { requestId, actionId, text }),
  cancelFix: () => ipcRenderer.send('fix:cancel'),
  onFixEvent: (cb) => {
    const chunk = (_e, d) => cb('chunk', d);
    const done = (_e, d) => cb('done', d);
    const error = (_e, d) => cb('error', d);
    ipcRenderer.on('fix:chunk', chunk);
    ipcRenderer.on('fix:done', done);
    ipcRenderer.on('fix:error', error);
    return () => {
      ipcRenderer.removeListener('fix:chunk', chunk);
      ipcRenderer.removeListener('fix:done', done);
      ipcRenderer.removeListener('fix:error', error);
    };
  },
  replace: (text) => ipcRenderer.invoke('replace', text),
  copy: (text) => ipcRenderer.invoke('copy', text),
  close: () => ipcRenderer.invoke('close'),

  // settings
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setApiKey: (key) => ipcRenderer.invoke('settings:setApiKey', key),
  pauseHotkeys: () => ipcRenderer.invoke('hotkeys:pause'),
  resumeHotkeys: () => ipcRenderer.invoke('hotkeys:resume'),
  setLaunchAtLogin: (on) => ipcRenderer.invoke('settings:setLaunchAtLogin', on),
  openLoginItems: () => ipcRenderer.invoke('settings:openLoginItems'),
  quit: () => ipcRenderer.invoke('app:quit'),
  getUsage: () => ipcRenderer.invoke('usage:get'),
  setBudget: (amount) => ipcRenderer.invoke('usage:setBudget', amount),
  resetUsage: () => ipcRenderer.invoke('usage:reset'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  setHistoryEnabled: (on) => ipcRenderer.invoke('history:setEnabled', on),
  copyText: (text) => ipcRenderer.invoke('history:copy', text),

  // onboarding
  getOnboardingInfo: () => ipcRenderer.invoke('onboarding:getInfo'),
  testPaste: () => ipcRenderer.invoke('onboarding:testPaste'),
  openAccessibility: () => ipcRenderer.invoke('onboarding:openAccessibility'),
  finishOnboarding: () => ipcRenderer.invoke('onboarding:finish'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onOnboardingFixed: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('onboarding:fixed', handler);
    return () => ipcRenderer.removeListener('onboarding:fixed', handler);
  },
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});
