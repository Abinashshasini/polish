import { useState } from 'react';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HistorySection({
  history,
  enabled,
  onClear,
  onToggle,
}) {
  const [copiedId, setCopiedId] = useState(null);

  const copy = async (entry) => {
    await window.polish.copyText(entry.output);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <section>
      <div className="section-head">
        <h2>History</h2>
        {history.length > 0 && (
          <button className="link danger" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span>
          Save my last 50 fixes on this device
          <span className="muted"> (turning off deletes history)</span>
        </span>
      </label>

      {history.length === 0 ? (
        <p className="sub">No fixes yet.</p>
      ) : (
        <ul className="history">
          {history.map((h) => (
            <li key={h.id}>
              <div className="h-meta">
                <span>{h.actionLabel}</span>
                <span>{timeAgo(h.ts)}</span>
              </div>
              <div className="h-in">{h.input}</div>
              <div className="h-out">{h.output}</div>
              <button className="link" onClick={() => copy(h)}>
                {copiedId === h.id ? 'Copied ✓' : 'Copy result'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
