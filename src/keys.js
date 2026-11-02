const { exec } = require('child_process');

const isMac = process.platform === 'darwin';
const run = (cmd) =>
  new Promise((resolve, reject) =>
    exec(cmd, (err) => (err ? reject(err) : resolve())),
  );

function paste() {
  if (isMac) {
    return run(
      `osascript -e 'tell application "System Events" to keystroke "v" using command down'`,
    );
  }
  return run(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { paste, sleep };
