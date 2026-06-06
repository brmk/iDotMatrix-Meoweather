import { useEffect, useState, type CSSProperties } from 'react';
import Connection from './components/Connection';
import LogsPanel from './components/LogsPanel';
import Simulator from './components/Simulator';
import Studio, { type StudioNavActions } from './components/Studio';

type Tab = 'preview' | 'studio' | 'logs' | 'connection';

const tabStyle = (active: boolean): CSSProperties => ({
  background: active ? '#1a3a1a' : '#2a2a2a',
  color: active ? '#8f8' : '#bbb',
  border: `1px solid ${active ? '#4a8' : '#3a3a3a'}`,
  padding: '4px 14px',
  fontFamily: 'monospace',
  fontSize: 11,
  cursor: 'pointer',
});

interface VersionInfo {
  app: string;
  schema: number;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('preview');
  const [studioNav, setStudioNav] = useState<StudioNavActions | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => r.json() as Promise<VersionInfo>)
      .then(setVersion)
      .catch(() => {
        /* backend not running in sim-only mode */
      });
  }, []);

  const statusColor = studioNav ? { saved: '#4a8', unsaved: '#a84', saving: '#888', error: '#a44' }[studioNav.saveStatus] : '#888';

  let statusText = '';
  if (studioNav) {
    if (studioNav.saveStatus === 'saving') statusText = 'saving…';
    else if (studioNav.saveStatus === 'error') statusText = 'save failed — is npm run dev:sim running?';
    else statusText = studioNav.saveStatus;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
          padding: '6px 16px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: 2, color: '#888' }}>iDOTMATRIX DEV TOOLS</span>
        {version && (
          <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>
            v{version.app} · schema {version.schema}
          </span>
        )}
        {(['preview', 'studio', 'logs', 'connection'] as Tab[]).map((t) => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab === 'studio' && studioNav && (
            <>
              <span style={{ fontSize: 10, color: statusColor }}>● {statusText}</span>
              <button style={tabStyle(false)} onClick={studioNav.onDiscard}>
                Discard local changes
              </button>
              <button style={tabStyle(false)} onClick={studioNav.onSave}>
                Save all
              </button>
            </>
          )}
        </div>
      </header>
      {tab === 'preview' && <Simulator />}
      {tab === 'studio' && <Studio onNavActionsChange={setStudioNav} />}
      {tab === 'logs' && <LogsPanel />}
      {tab === 'connection' && <Connection />}
    </div>
  );
}
