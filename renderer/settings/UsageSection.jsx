import { useState } from 'react';

export default function UsageSection({ usage, onUpdate }) {
  const [budgetInput, setBudgetInput] = useState(String(usage.budget));
  const [error, setError] = useState('');
  const pct = Math.min(100, (usage.spent / usage.budget) * 100);

  const saveBudget = async () => {
    const res = await window.polish.setBudget(budgetInput);
    if (res.ok) {
      setError('');
      onUpdate(res.usage);
    } else {
      setError(res.error);
    }
  };

  const reset = async () => {
    if (!confirm('Reset the usage counter to $0?')) return;
    const res = await window.polish.resetUsage();
    onUpdate(res.usage);
  };

  return (
    <section>
      <h2>Usage</h2>

      <div className="meter">
        <div
          className={`meter-fill ${pct > 80 ? 'warn' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="stats">
        <div>
          <strong>${usage.spent.toFixed(4)}</strong>
          <span>spent of ${usage.budget}</span>
        </div>
        <div>
          <strong>{usage.fixes}</strong>
          <span>fixes</span>
        </div>
        <div>
          <strong>~{usage.fixesLeft.toLocaleString()}</strong>
          <span>fixes left</span>
        </div>
      </div>

      <div className="budget-row">
        <label>Budget ($)</label>
        <input
          type="number"
          min="0.5"
          step="0.5"
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
        />
        <button className="btn" onClick={saveBudget}>
          Save
        </button>
        <button className="link" onClick={reset}>
          Reset counter
        </button>
      </div>
      {error && <div className="err">{error}</div>}

      <p className="sub">
        Tracked from this app only, using each model's list price. Local Ollama
        models cost nothing. Your real balance is on your provider's billing
        page.
      </p>
    </section>
  );
}
