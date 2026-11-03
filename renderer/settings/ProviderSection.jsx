import { useCallback, useEffect, useState } from 'react';
import ApiKeySection from './ApiKeySection';

const BLURBS = {
  openai: 'GPT models. Fast and very cheap.',
  anthropic: 'Claude models. Pick quality or speed below.',
  ollama: 'Runs on this computer. Free, private, works offline.',
};

const NO_STATUS = { type: '', msg: '' };

// ai: { provider, providers: [...], ready } from main's providerState()
export default function ProviderSection({ ai, onChange }) {
  const selected = ai.providers.find((p) => p.id === ai.provider);
  const [ollama, setOllama] = useState({ loading: false, models: [], error: '' });
  const [test, setTest] = useState(NO_STATUS);
  const [testing, setTesting] = useState(false);

  const apply = (res) => {
    if (res?.ok) onChange(res.ai);
    return res;
  };

  const loadOllamaModels = useCallback(async () => {
    setOllama((o) => ({ ...o, loading: true, error: '' }));
    const res = await window.polish.listOllamaModels();
    setOllama({
      loading: false,
      models: res.ok ? res.models : [],
      error: res.ok ? '' : res.error,
    });
    // nothing chosen yet: take the first installed model
    if (res.ok && res.models.length && !selected.model)
      apply(await window.polish.setProviderModel('ollama', res.models[0]));
  }, [selected.model]);

  useEffect(() => {
    if (ai.provider === 'ollama') loadOllamaModels();
    setTest(NO_STATUS);
  }, [ai.provider]);

  const pick = async (id) => {
    if (id !== ai.provider) apply(await window.polish.selectProvider(id));
  };

  const setModel = async (model) => {
    setTest(NO_STATUS);
    apply(await window.polish.setProviderModel(selected.id, model));
  };

  const runTest = async () => {
    setTesting(true);
    setTest(NO_STATUS);
    const res = await window.polish.testProvider(selected.id);
    setTest(
      res.ok
        ? { type: 'ok', msg: `Connected to ${selected.label} ✓` }
        : { type: 'err', msg: res.error },
    );
    setTesting(false);
  };

  const current = selected.models.find((m) => m.id === selected.model);

  const modelOptions =
    selected.id === 'ollama'
      ? ollama.models.map((m) => ({ id: m, label: m }))
      : selected.models;

  return (
    <>
      <section>
        <h2>AI provider</h2>
        <p className="sub">Choose who does the fixing. You can switch any time.</p>
        <div className="provider-list">
          {ai.providers.map((p) => {
            const missingKey = p.needsKey && !p.keyHint;
            return (
              <label
                key={p.id}
                className={`card provider-option ${p.id === ai.provider ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="provider"
                  checked={p.id === ai.provider}
                  onChange={() => pick(p.id)}
                />
                <div>
                  <div className="row-title">
                    {p.label}
                    {missingKey && <span className="badge">Needs key</span>}
                  </div>
                  <div className="row-sub">{BLURBS[p.id]}</div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Model</h2>
        {selected.id === 'ollama' && !ollama.loading && ollama.error ? (
          <OllamaSetup error={ollama.error} onRetry={loadOllamaModels} />
        ) : selected.id === 'ollama' &&
          !ollama.loading &&
          !ollama.models.length ? (
          <OllamaSetup
            error="Ollama is running, but no models are installed yet."
            onRetry={loadOllamaModels}
          />
        ) : (
          <div className="key-row">
            <div className="select-wrap">
              <select
                className="select"
                value={selected.model}
                disabled={ollama.loading && selected.id === 'ollama'}
                onChange={(e) => setModel(e.target.value)}
              >
                {selected.id === 'ollama' && ollama.loading && (
                  <option>Looking for models…</option>
                )}
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {selected.id === 'ollama' && (
              <button className="btn nowrap" onClick={loadOllamaModels}>
                Refresh
              </button>
            )}
            <button
              className="btn nowrap"
              disabled={testing || (selected.needsKey && !selected.keyHint)}
              onClick={runTest}
            >
              {testing ? 'Testing…' : 'Test'}
            </button>
          </div>
        )}
        {(selected.id === 'ollama'
          ? !ollama.error && ollama.models.length > 0
          : current) && (
          <p className="model-meta">
            {selected.id === 'ollama'
              ? 'Runs on this computer · free'
              : `${current.note} · $${current.price.input} in / $${current.price.output} out per 1M tokens`}
          </p>
        )}
        {test.msg && <div className={test.type}>{test.msg}</div>}
      </section>

      {selected.needsKey && (
        <ApiKeySection key={selected.id} provider={selected} onSaved={onChange} />
      )}
    </>
  );
}

function OllamaSetup({ error, onRetry }) {
  return (
    <div className="card">
      <div className="err">{error}</div>
      <ol className="setup-steps">
        <li>
          Install Ollama from{' '}
          <button
            className="link"
            onClick={() => window.polish.openExternal('https://ollama.com/download')}
          >
            ollama.com
          </button>{' '}
          and open it.
        </li>
        <li>
          In Terminal, download a model: <code>ollama pull llama3.2</code>
        </li>
        <li>
          <button className="link" onClick={onRetry}>
            Check again →
          </button>
        </li>
      </ol>
    </div>
  );
}
