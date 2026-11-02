export default function ResultView({
  data,
  error,
  showDiff,
  showWhy,
  onToggleDiff,
  onToggleWhy,
  onBack,
  onRetry,
  onCopy,
  onReplace,
}) {
  if (error) {
    return (
      <div className="result">
        <div className="label">Something went wrong</div>
        <div className="box error-box">{error}</div>
        <div className="actions">
          <button className="btn" onClick={onBack}>
            Back
          </button>
          <button className="btn primary" onClick={onRetry}>
            ↻ Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="result">
      <div className="row">
        <div className="label">Result</div>
        <div className="links">
          <button className="link" onClick={onToggleDiff}>
            {showDiff ? 'Clean view (D)' : 'Show changes (D)'}
          </button>
          <button className="link" onClick={onToggleWhy}>
            {showWhy ? 'Hide why (W)' : 'Why? (W)'}
          </button>
        </div>
      </div>

      <div className="box">
        {showDiff
          ? data.parts.map((p, i) => (
              <span
                key={i}
                className={p.added ? 'add' : p.removed ? 'del' : undefined}
              >
                {p.value}
              </span>
            ))
          : data.text}
      </div>

      {showWhy && (
        <ul className="why">
          {data.why.length ? (
            data.why.map((w, i) => <li key={i}>{w}</li>)
          ) : (
            <li>No changes needed 👍</li>
          )}
        </ul>
      )}

      <div className="actions">
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <button className="btn" onClick={onRetry} title="Retry (R)">
          ↻
        </button>
        <button className="btn" onClick={onCopy}>
          Copy
        </button>
        <button className="btn primary" onClick={onReplace}>
          Replace ⏎
        </button>
      </div>
    </div>
  );
}
