import { useState } from 'react';

const NO_STATUS = { type: '', msg: '' };

// provider: one entry of ai.providers (id, label, keyHint, keyPlaceholder, keyUrl)
export default function ApiKeySection({ provider, onSaved }) {
  const { id, label, keyHint: hint, keyPlaceholder, keyUrl } = provider;
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(''); // '' | 'saving' | 'removing'
  const [saveStatus, setSaveStatus] = useState(NO_STATUS);
  const [removeStatus, setRemoveStatus] = useState(NO_STATUS);

  const save = async () => {
    const key = value.trim();
    if (!key) return;
    setBusy('saving');
    setSaveStatus(NO_STATUS);
    setRemoveStatus(NO_STATUS);
    try {
      const res = await window.polish.setApiKey(id, key);
      if (res.ok) {
        setValue('');
        onSaved(res.ai);
        setSaveStatus({ type: 'ok', msg: 'Key verified and saved ✓' });
      } else {
        setSaveStatus({ type: 'err', msg: res.error });
      }
    } catch (e) {
      setSaveStatus({ type: 'err', msg: e.message });
    } finally {
      setBusy(''); // always reset the button
    }
  };

  const remove = async () => {
    if (
      !confirm(
        `Remove the saved ${label} key? Polish can't use ${label} until you add one again.`,
      )
    )
      return;
    setBusy('removing');
    setSaveStatus(NO_STATUS);
    setRemoveStatus(NO_STATUS);
    try {
      const res = await window.polish.setApiKey(id, '');
      onSaved(res.ai);
      setRemoveStatus({ type: 'ok', msg: 'Key removed' });
    } catch (e) {
      setRemoveStatus({ type: 'err', msg: e.message });
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <section>
        <h2>Saved {label} key</h2>
        <p className="sub">Stored encrypted on this device only.</p>
        {hint ? (
          <div className="key-row saved-key">
            <code>{hint}</code>
            <button className="btn" disabled={!!busy} onClick={remove}>
              {busy === 'removing' ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ) : (
          <p className="muted">No key saved yet.</p>
        )}
        {removeStatus.msg && (
          <div className={removeStatus.type}>{removeStatus.msg}</div>
        )}
      </section>

      <section>
        <h2>{hint ? 'Replace key' : 'Add key'}</h2>
        <p className="sub">
          Paste your {label} API key. It's checked with {label} before saving.{' '}
          {keyUrl && (
            <button
              className="link"
              onClick={() => window.polish.openExternal(keyUrl)}
            >
              Get a key →
            </button>
          )}
        </p>
        <div className="key-row">
          <input
            type="password"
            placeholder={keyPlaceholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && save()}
          />
          <button
            className="btn primary"
            disabled={!value.trim() || !!busy}
            onClick={save}
          >
            {busy === 'saving' ? 'Checking…' : 'Save'}
          </button>
        </div>
        {saveStatus.msg && (
          <div className={saveStatus.type}>{saveStatus.msg}</div>
        )}
      </section>
    </>
  );
}
