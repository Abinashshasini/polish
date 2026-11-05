import { useCallback, useEffect, useRef, useState } from 'react';
import OptionGrid from './components/OptionGrid';
import ResultView from './components/ResultView';

export default function App() {
  const [text, setText] = useState('');
  const [actions, setActions] = useState([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState('choose'); // choose | streaming | result | error
  const [streamText, setStreamText] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showDiff, setShowDiff] = useState(true);
  const [showWhy, setShowWhy] = useState(false);
  const requestRef = useRef(null); // id of the request we're waiting for

  // takes text and action as arguments so it also works before state updates land
  const startRequest = useCallback((text, action) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestRef.current = id;
    setStreamText('');
    setData(null);
    setError('');
    setStatus('streaming');
    window.polish.startFix(id, action.id, text);
  }, []);

  // popup opened via hotkey: an action's hotkey runs it, the menu hotkey lets you pick
  useEffect(
    () =>
      window.polish.onOpen(({ text, actionId, actions, autoRun }) => {
        requestRef.current = null;
        const index = Math.max(
          0,
          actions.findIndex((a) => a.id === actionId),
        );
        setText(text);
        setActions(actions);
        setData(null);
        setError('');
        setStreamText('');
        setShowWhy(false);
        setActive(index);
        if (autoRun && text && actions[index]?.id === actionId)
          startRequest(text, actions[index]);
        else setStatus('choose');
      }),
    [startRequest],
  );

  // streaming events from main
  useEffect(
    () =>
      window.polish.onFixEvent((type, d) => {
        if (d.requestId !== requestRef.current) return; // ignore stale/cancelled requests
        if (type === 'chunk') {
          setStreamText(d.text);
        } else if (type === 'done') {
          requestRef.current = null;
          setData(d.result);
          setStatus('result');
        } else if (type === 'error') {
          requestRef.current = null;
          setError(d.message);
          setStatus('error');
        }
      }),
    [],
  );

  const run = useCallback(
    (i) => {
      if (!text || !actions[i]) return;
      setActive(i);
      startRequest(text, actions[i]);
    },
    [text, actions, startRequest],
  );

  const retry = useCallback(() => run(active), [run, active]);

  const cancel = () => {
    window.polish.cancelFix();
    requestRef.current = null;
    setStatus('choose');
  };

  const replace = useCallback(
    () => data && window.polish.replace(data.text),
    [data],
  );
  const copy = () => data && window.polish.copy(data.text);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return window.polish.close(); // closing also cancels
      if (e.key === 'Enter') e.preventDefault();
      const n = actions.length;
      const k = e.key.toLowerCase();

      if (status === 'choose' && n) {
        const num = Number(e.key);
        if (num >= 1 && num <= Math.min(n, 9)) return run(num - 1);
        if (e.key === 'Enter') return run(active);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight')
          setActive((a) => (a + 1) % n);
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
          setActive((a) => (a - 1 + n) % n);
      } else if (status === 'result') {
        if (e.key === 'Enter') replace();
        else if (k === 'r') retry();
        else if (k === 'd') setShowDiff((v) => !v);
        else if (k === 'w') setShowWhy((v) => !v);
      } else if (status === 'error') {
        if (e.key === 'Enter' || k === 'r') retry();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, active, actions, run, retry, replace]);

  const hints = {
    choose: `↑↓ choose · Enter run · 1–${Math.min(actions.length, 9) || 1} quick pick · Esc close`,
    streaming: 'Writing… · Esc close',
    result: 'Enter replace · R retry · D diff · W why · Esc close',
    error: 'Enter or R retry · Esc close',
  };

  return (
    <div className="popup">
      <div className="row">
        <div className="label">Your text</div>
        <button className="link" onClick={() => window.polish.openSettings()}>
          ⚙ Settings
        </button>
      </div>
      <div className="box">
        {text || 'Clipboard is empty. Copy some text first.'}
      </div>

      {status === 'choose' && (
        <OptionGrid options={actions} active={active} onPick={run} />
      )}

      {status === 'streaming' && (
        <div className="result">
          <div className="row">
            <div className="label">{actions[active]?.label}…</div>
            <button className="link" onClick={cancel}>
              Cancel
            </button>
          </div>
          <div className="box">
            {streamText}
            <span className="cursor">▍</span>
          </div>
        </div>
      )}

      {(status === 'result' || status === 'error') && (
        <ResultView
          data={data}
          error={error}
          showDiff={showDiff}
          showWhy={showWhy}
          onToggleDiff={() => setShowDiff((v) => !v)}
          onToggleWhy={() => setShowWhy((v) => !v)}
          onBack={() => setStatus('choose')}
          onRetry={retry}
          onCopy={copy}
          onReplace={replace}
        />
      )}

      <div className="hint">{hints[status]}</div>
    </div>
  );
}
