import { useState } from 'react';
import { toAccelerator, formatAccelerator } from '../../src/hotkeys';

export default function HotkeyRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  const start = () => {
    setError('');
    setRecording(true);
    window.polish.pauseHotkeys();
  };

  const stop = () => {
    setRecording(false);
    window.polish.resumeHotkeys();
  };

  const onKeyDown = async (e) => {
    if (!recording) return;
    e.preventDefault();

    if (e.key === 'Escape') return stop();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      await onChange('');
      return stop();
    }

    const accel = toAccelerator(e);
    if (!accel) return; // wait for a full combo

    const res = await onChange(accel);
    if (!res.ok) setError(res.error);
    stop();
  };

  return (
    <div className="hk-field">
      <button
        className={`recorder ${recording ? 'recording' : ''}`}
        onClick={start}
        onKeyDown={onKeyDown}
        onBlur={() => recording && stop()}
      >
        {recording ? 'Press keys…' : formatAccelerator(value) || 'Not set'}
      </button>
      {error && <div className="err">{error}</div>}
    </div>
  );
}
