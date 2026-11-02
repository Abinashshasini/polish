import { useEffect, useRef, useState } from 'react';
import ApiKeySection from '../settings/ApiKeySection';
import { formatAccelerator } from '../../src/hotkeys';
import '../settings/Settings.css';
import './Onboarding.css';

const SAMPLE =
  'hey team, i has finished the report yesterday and send it to manager. pls check when u gets time';

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState(null);
  const [pasteState, setPasteState] = useState('idle'); // idle | testing | ok | failed
  const [pasteError, setPasteError] = useState('');
  const [copied, setCopied] = useState(false);
  const [fixed, setFixed] = useState(false);
  const testBoxRef = useRef(null);

  useEffect(() => {
    window.polish.getOnboardingInfo().then(setInfo);
  }, []);

  useEffect(() => window.polish.onOnboardingFixed(() => setFixed(true)), []);

  if (!info) return null;
  const isMac = info.platform === 'darwin';

  const testPaste = async () => {
    setPasteState('testing');
    setPasteError('');
    const box = testBoxRef.current;
    box.value = '';
    box.focus(); // the simulated paste lands in the focused box

    const res = await window.polish.testPaste();
    await new Promise((r) => setTimeout(r, 200));

    if (res.ok && box.value.includes('works')) {
      setPasteState('ok');
    } else {
      setPasteState('failed');
      setPasteError(
        res.ok
          ? 'Nothing was pasted. Click inside the box and test again.'
          : 'macOS blocked it. Allow access below, then test again.',
      );
    }
  };

  const copySample = async () => {
    await window.polish.copyText(SAMPLE);
    setCopied(true);
  };

  return (
    <div className="settings onboarding">
      <div className="dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h1>Welcome to Polish ✦</h1>
          <p className="lead">
            Fix spelling, grammar, and tone in any app. Copy text, press a
            hotkey, done.
          </p>

          <ApiKeySection
            hint={info.apiKeyHint}
            onSaved={(hint) => setInfo((i) => ({ ...i, apiKeyHint: hint }))}
          />
          <p className="sub">
            Don't have a key?{' '}
            <button
              className="link"
              onClick={() =>
                window.polish.openExternal(
                  'https://platform.openai.com/api-keys',
                )
              }
            >
              Get one from OpenAI →
            </button>{' '}
            About $5 of credit lasts a long time.
          </p>

          <div className="nav">
            <span />
            <button
              className="btn primary"
              disabled={!info.apiKeyHint}
              onClick={() => setStep(1)}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1>Allow auto-replace</h1>
          <p className="lead">
            {isMac
              ? 'To paste fixed text back into your apps, Polish needs Accessibility access. Without it, you can still use Copy and paste yourself.'
              : 'No setup needed on Windows. You can test it below.'}
          </p>

          <textarea
            ref={testBoxRef}
            className="test-box"
            rows={2}
            placeholder="The test result appears here"
          />

          <div className="key-row">
            <button
              className="btn primary"
              onClick={testPaste}
              disabled={pasteState === 'testing'}
            >
              {pasteState === 'testing' ? 'Testing…' : 'Test auto-replace'}
            </button>
            {isMac && pasteState === 'failed' && (
              <button
                className="btn"
                onClick={() => window.polish.openAccessibility()}
              >
                Open Accessibility settings
              </button>
            )}
          </div>

          {pasteState === 'ok' && (
            <div className="ok">Auto-replace works ✓</div>
          )}
          {pasteState === 'failed' && <div className="err">{pasteError}</div>}
          {isMac && pasteState === 'failed' && (
            <p className="sub">
              In the list, turn on{' '}
              <strong>{info.isDev ? 'Terminal (or VS Code)' : 'Polish'}</strong>
              , then test again. You may need to restart Polish after allowing
              it.
            </p>
          )}

          <div className="nav">
            <button className="link" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button className="btn primary" onClick={() => setStep(2)}>
              {pasteState === 'ok' ? 'Next →' : 'Skip for now →'}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1>Try it</h1>
          <p className="lead">Here's a messy message. Let's fix it.</p>

          <div className="sample">{SAMPLE}</div>

          <ol className="try-steps">
            <li>
              <button className="btn" onClick={copySample}>
                {copied ? 'Copied ✓' : 'Copy this text'}
              </button>
            </li>
            <li>
              Press{' '}
              {info.hotkey ? (
                <kbd>{formatAccelerator(info.hotkey)}</kbd>
              ) : (
                'your hotkey (set one in Settings → Actions)'
              )}{' '}
              to open Polish
            </li>
            <li>
              Press <kbd>Enter</kbd> to fix it
            </li>
          </ol>

          {fixed ? (
            <div className="celebrate">
              🎉 You did it! Polish is ready. It lives in your{' '}
              {isMac ? 'menu bar' : 'system tray'} (✦).
            </div>
          ) : (
            <p className="sub">Waiting for your first fix…</p>
          )}

          <div className="nav">
            <button className="link" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button
              className="btn primary"
              onClick={() => window.polish.finishOnboarding()}
            >
              {fixed ? 'Finish' : 'Skip & finish'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
