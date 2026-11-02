export default function GeneralSection({
  launchAtLogin,
  canLaunchAtLogin,
  onChange,
}) {
  return (
    <section>
      <h2>General</h2>
      <label className="check-row">
        <input
          type="checkbox"
          checked={launchAtLogin}
          disabled={!canLaunchAtLogin}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          Launch Polish at login
          {!canLaunchAtLogin && (
            <span className="muted"> (available after installing the app)</span>
          )}
        </span>
      </label>
    </section>
  );
}
