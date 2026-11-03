import { useState } from 'react';

const NO_STATUS = { type: '', msg: '' };

export default function ApiKeySection({ hint, onSaved }) {
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
      const res = await window.polish.setApiKey(key);
      if (res.ok) {
        setValue('');
        onSaved(res.hint);
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
    if (!confirm('Remove the saved API key? Polish will stop working until you add one again.'))
      return;
    setBusy('removing');
    setSaveStatus(NO_STATUS);
    setRemoveStatus(NO_STATUS);
    try {
      const res = await window.polish.setApiKey('');
      onSaved(res.hint);
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
        <h2>Saved key</h2>
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
          Paste an OpenAI API key. It's checked with OpenAI before saving.
        </p>
        <div className="key-row">
          <input
            type="password"
            placeholder="sk-..."
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
