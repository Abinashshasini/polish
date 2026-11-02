import { useState } from 'react';

export default function ApiKeySection({ hint, onSaved }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  const submit = async (key) => {
    setSaving(true);
    setStatus({ type: '', msg: '' });
    try {
      const res = await window.polish.setApiKey(key);
      if (res.ok) {
        setValue('');
        onSaved(res.hint);
        setStatus({
          type: 'ok',
          msg: key ? 'Key verified and saved ✓' : 'Key removed',
        });
      } else {
        setStatus({ type: 'err', msg: res.error });
      }
    } catch (e) {
      setStatus({ type: 'err', msg: e.message });
    } finally {
      setSaving(false); // always reset the button
    }
  };

  return (
    <section>
      <h2>OpenAI API key</h2>
      <p className="sub">
        Stored encrypted on this device only.{' '}
        {hint ? (
          <>
            Current: <code>{hint}</code>
          </>
        ) : (
          'No key saved yet.'
        )}
      </p>
      <div className="key-row">
        <input
          type="password"
          placeholder="sk-..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && value && submit(value)}
        />
        <button
          className="btn primary"
          disabled={!value || saving}
          onClick={() => submit(value)}
        >
          {saving ? 'Checking…' : 'Save'}
        </button>
        {hint && (
          <button className="btn" disabled={saving} onClick={() => submit('')}>
            Remove
          </button>
        )}
      </div>
      {status.msg && <div className={status.type}>{status.msg}</div>}
    </section>
  );
}
