import { useEffect, useState } from 'react';
import { formatAccelerator } from '../hotkeys';

const isMac = window.polish.platform === 'darwin';
const mod = isMac ? '⌘' : 'Ctrl+';

export default function GeneralSection({
  actions,
  menuHotkey,
  launchAtLogin,
  canLaunchAtLogin,
  status,
  onChange,
  onOpenTab,
}) {
  const withHotkeys = actions.filter((a) => a.enabled && a.hotkey);
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.polish.getVersion().then(setVersion);
  }, []);

  const steps = [
    {
      title: 'Copy your text',
      body: (
        <>
          Select text in any app and press <kbd>{mod}C</kbd>.
        </>
      ),
    },
    {
      title: 'Press a hotkey',
      body: withHotkeys.length || menuHotkey ? (
        <div className="hotkey-list">
          {menuHotkey && (
            <span className="hotkey-chip">
              <kbd>{formatAccelerator(menuHotkey)}</kbd> Pick from menu
            </span>
          )}
          {withHotkeys.map((a) => (
            <span key={a.id} className="hotkey-chip">
              <kbd>{formatAccelerator(a.hotkey)}</kbd> {a.label}
            </span>
          ))}
        </div>
      ) : (
        <>
          No hotkeys set yet.{' '}
          <button className="link" onClick={() => onOpenTab('Actions')}>
            Set one in Actions →
          </button>
        </>
      ),
    },
    {
      title: 'Check the fix',
      body: (
        <>
          An action's hotkey starts the fix right away. From the menu, use{' '}
          <kbd>↑</kbd> <kbd>↓</kbd> or <kbd>1</kbd>–<kbd>9</kbd>, then{' '}
          <kbd>Enter</kbd>. On the result, <kbd>D</kbd> shows changes,{' '}
          <kbd>W</kbd> explains why, <kbd>R</kbd> retries.
        </>
      ),
    },
    {
      title: 'Replace',
      body: (
        <>
          Press <kbd>Enter</kbd> to paste the fix back where your text was, or
          click Copy to paste it yourself. <kbd>Esc</kbd> closes the popup.
        </>
      ),
    },
  ];

  return (
    <>
      <section>
        <h2>How to use Polish</h2>
        <ol className="card steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="step-num">{i + 1}</span>
              <div>
                <div className="step-title">{s.title}</div>
                <div className="step-body">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="sub tip">
          Polish runs in the {isMac ? 'menu bar' : 'system tray'} (✦). Pause
          hotkeys from there, or change them in the Actions tab.
        </p>
      </section>

      <section>
        <h2>Startup</h2>
        <div className="card">
          <label className="card-row">
            <div>
              <div className="row-title">Launch at login</div>
              <div className="row-sub">
                Start Polish automatically when you sign in.
              </div>
            </div>
            <input
              type="checkbox"
              className="switch"
              checked={launchAtLogin}
              onChange={(e) => onChange(e.target.checked)}
            />
          </label>

          {launchAtLogin && !canLaunchAtLogin && (
            <div className="row-note">
              Saved. This takes effect once Polish is installed (it's off while
              running in development).
            </div>
          )}
          {launchAtLogin && status === 'requires-approval' && (
            <div className="row-note">
              macOS needs your OK: allow Polish under Login Items.{' '}
              <button
                className="link"
                onClick={() => window.polish.openLoginItems()}
              >
                Open Login Items →
              </button>
            </div>
          )}
          {launchAtLogin && status === 'failed' && (
            <div className="row-note err">
              The system didn't accept the login item. Make sure Polish is in
              your Applications folder, then toggle this again.
            </div>
          )}
        </div>
      </section>

      <section>
        <h2>About</h2>
        <div className="card">
          <div className="card-row">
            <div className="row-title">Version</div>
            <span className="muted">{version ? `v${version}` : '…'}</span>
          </div>
          <div className="card-row row-divider">
            <div>
              <div className="row-title">Quit Polish</div>
              <div className="row-sub">
                Hotkeys stop until you open Polish again from{' '}
                {isMac ? 'Applications or Spotlight' : 'the Start menu'}.
              </div>
            </div>
            <button
              className="btn nowrap"
              onClick={() => window.polish.quit()}
            >
              Quit
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
