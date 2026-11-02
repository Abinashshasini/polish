export default function OptionGrid({ options, active, onPick }) {
  if (!options.length) {
    return (
      <div className="hint">No actions enabled. Turn some on in Settings.</div>
    );
  }

  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>
        What should I do?
      </div>
      <div className="options">
        {options.map((o, i) => (
          <button
            key={o.id}
            className={`opt ${i === active ? 'active' : ''}`}
            onClick={() => onPick(i)}
          >
            {o.label}
            {i < 9 && <kbd>{i + 1}</kbd>}
          </button>
        ))}
      </div>
    </div>
  );
}
