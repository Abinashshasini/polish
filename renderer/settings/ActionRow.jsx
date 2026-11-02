import HotkeyRecorder from './HotkeyRecorder';

export default function ActionRow({
  action,
  onHotkey,
  onToggle,
  onEdit,
  onDelete,
}) {
  return (
    <div className={`action-row ${action.enabled ? '' : 'disabled'}`}>
      <input
        type="checkbox"
        checked={action.enabled}
        onChange={onToggle}
        title={action.enabled ? 'Disable' : 'Enable'}
      />
      <span className="action-label">{action.label}</span>
      <HotkeyRecorder value={action.hotkey} onChange={onHotkey} />
      <button className="link" onClick={onEdit}>
        Edit
      </button>
      <button className="link danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
