import { useEffect, useState } from 'react';
import ProviderSection from './ProviderSection';
import GeneralSection from './GeneralSection';
import ActionRow from './ActionRow';
import ActionEditor from './ActionEditor';
import UsageSection from './UsageSection';
import HistorySection from './HistorySection';
import './Settings.css';

const TABS = ['AI Provider', 'General', 'Actions', 'Usage & History'];

export default function Settings() {
  const [tab, setTab] = useState(null);
  const [state, setState] = useState(null); // { actions, ai, launchAtLogin, canLaunchAtLogin, loginItemStatus }
  const [usageData, setUsageData] = useState(null); // { usage, history, historyEnabled }
  const [editing, setEditing] = useState(null); // action id | 'new' | null

  useEffect(() => {
    window.polish.getSettings().then((s) => {
      setState(s);
      setTab(s.ai.ready ? 'General' : 'AI Provider'); // not set up yet → start where it's needed
    });

    // the tray can change launch-at-login while this window is open
    const refresh = () =>
      window.polish
        .getSettings()
        .then(({ launchAtLogin, canLaunchAtLogin, loginItemStatus }) =>
          setState((s) => ({
            ...s,
            launchAtLogin,
            canLaunchAtLogin,
            loginItemStatus,
          })),
        );
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // refresh usage + history every time the tab is opened
  useEffect(() => {
    if (tab === 'Usage & History') window.polish.getUsage().then(setUsageData);
  }, [tab]);

  if (!state) return null;

  // ---------- actions ----------

  const withActions = async (promise) => {
    const res = await promise;
    if (res.ok) setState((s) => ({ ...s, actions: res.actions }));
    return res;
  };

  const saveAction = async (input) => {
    const res = await withActions(window.polish.saveAction(input));
    if (res.ok) setEditing(null);
    return res;
  };

  const removeAction = async (a) => {
    if (!confirm(`Delete "${a.label}"?`)) return;
    const res = await withActions(window.polish.deleteAction(a.id));
    if (!res.ok) alert(res.error);
  };

  const resetActions = () => {
    if (
      confirm('Reset all actions to defaults? Custom actions will be removed.')
    ) {
      withActions(window.polish.resetActions());
    }
  };

  // ---------- history ----------

  const clearHistory = async () => {
    if (!confirm('Delete all history?')) return;
    await window.polish.clearHistory();
    setUsageData((d) => ({ ...d, history: [] }));
  };

  const toggleHistory = async (on) => {
    await window.polish.setHistoryEnabled(on);
    setUsageData((d) => ({
      ...d,
      historyEnabled: on,
      history: on ? d.history : [],
    }));
  };

  return (
    <div className="settings">
      <h1>Settings</h1>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'AI Provider' && (
        <ProviderSection
          ai={state.ai}
          onChange={(ai) => setState((s) => ({ ...s, ai }))}
        />
      )}

      {tab === 'General' && (
        <GeneralSection
          actions={state.actions}
          onOpenTab={setTab}
          launchAtLogin={state.launchAtLogin}
          canLaunchAtLogin={state.canLaunchAtLogin}
          status={state.loginItemStatus}
          onChange={async (on) => {
            setState((s) => ({ ...s, launchAtLogin: on })); // update the UI right away
            const { launchAtLogin, canLaunchAtLogin, loginItemStatus } =
              await window.polish.setLaunchAtLogin(on);
            setState((s) => ({
              ...s,
              launchAtLogin,
              canLaunchAtLogin,
              loginItemStatus,
            }));
          }}
        />
      )}

      {tab === 'Actions' && (
        <section>
          <div className="section-head">
            <h2>Actions</h2>
            <button className="link" onClick={resetActions}>
              Reset to defaults
            </button>
          </div>
          <p className="sub">
            Each action is an instruction for the AI. Click a shortcut to record
            a new combo (Backspace clears it). Unchecked actions are hidden from
            the popup.
          </p>

          {state.actions.map((a) =>
            editing === a.id ? (
              <ActionEditor
                key={a.id}
                initial={a}
                onSave={saveAction}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <ActionRow
                key={a.id}
                action={a}
                onHotkey={(accel) =>
                  withActions(window.polish.setHotkey(a.id, accel))
                }
                onToggle={() => withActions(window.polish.toggleAction(a.id))}
                onEdit={() => setEditing(a.id)}
                onDelete={() => removeAction(a)}
              />
            ),
          )}

          {editing === 'new' ? (
            <ActionEditor
              onSave={saveAction}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <button className="btn add-btn" onClick={() => setEditing('new')}>
              + Add action
            </button>
          )}
        </section>
      )}

      {tab === 'Usage & History' && usageData && (
        <>
          <UsageSection
            usage={usageData.usage}
            onUpdate={(usage) => setUsageData((d) => ({ ...d, usage }))}
          />
          <HistorySection
            history={usageData.history}
            enabled={usageData.historyEnabled}
            onClear={clearHistory}
            onToggle={toggleHistory}
          />
        </>
      )}
    </div>
  );
}
