const path = require('path');
const { Tray, Menu, nativeImage } = require('electron');

const isMac = process.platform === 'darwin';
let tray = null; // keep a reference, or it gets garbage-collected and disappears
let opts = null;

function createTray(options) {
  opts = options;
  const file = isMac ? 'iconTemplate.png' : 'tray.png';
  tray = new Tray(
    nativeImage.createFromPath(path.join(__dirname, '../assets', file)),
  );

  // Windows shows the menu on right-click only; open it on left-click too
  if (!isMac) tray.on('click', () => tray.popUpContextMenu());

  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const { paused, launchAtLogin, canLaunchAtLogin, usageLabel } =
    opts.getState();

  tray.setToolTip(paused ? 'Polish (paused)' : 'Polish');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: paused ? 'Polish: paused' : 'Polish: running', enabled: false },
      { label: usageLabel, enabled: false },
      { type: 'separator' },
      { label: 'Settings…', click: opts.onSettings },
      { label: 'Setup guide…', click: opts.onOnboarding },
      { type: 'separator' },
      {
        label: 'Pause hotkeys',
        type: 'checkbox',
        checked: paused,
        click: opts.onTogglePause,
      },
      {
        label: canLaunchAtLogin
          ? 'Launch at login'
          : 'Launch at login (after install)',
        type: 'checkbox',
        checked: launchAtLogin,
        click: (item) => opts.onToggleLaunchAtLogin(item.checked),
      },
      { type: 'separator' },
      { label: 'Quit Polish', click: opts.onQuit },
    ]),
  );
}

module.exports = { createTray, refreshTray };
