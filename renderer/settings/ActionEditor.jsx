import { useState } from 'react';

export default function ActionEditor({ initial, onSave, onCancel }) {
  const [label, setLabel] = useState(initial?.label || '');
  const [prompt, setPrompt] = useState(initial?.prompt || '');
  const [error, setError] = useState('');

  const save = async () => {
    const res = await onSave({ id: initial?.id, label, prompt });
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="editor">
      <input
        placeholder="Name, e.g. Translate to Hindi"
        value={label}
        maxLength={40}
        onChange={(e) => setLabel(e.target.value)}
        autoFocus
      />
      <textarea
        rows={3}
        placeholder="Instruction, e.g. Translate the text to Hindi. Keep names and technical terms in English."
        value={prompt}
        maxLength={1000}
        onChange={(e) => setPrompt(e.target.value)}
      />
      {error && <div className="err">{error}</div>}
      <div className="editor-actions">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
