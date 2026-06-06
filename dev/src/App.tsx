import { useEffect, useState, type CSSProperties } from 'react';
import DevicePanel from './components/DevicePanel';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import PreviewStage from './components/PreviewStage';
import Studio, { type StudioNavActions } from './components/Studio';

type Zone = 'device' | 'studio' | 'diagnostics';

interface VersionInfo {
  app: string;
  schema: number;
}

const tabStyle = (active: boolean): CSSProperties => ({
  background: active ? '#1a3a1a' : '#2a2a2a',
  color: active ? '#8f8' : '#bbb',
  border: `1px solid ${active ? '#4a8' : '#3a3a3a'}`,
  padding: '4px 14px',
  fontFamily: 'monospace',
  fontSize: 11,
  cursor: 'pointer',
  letterSpacing: 1,
});

export default function App() {
  const [zone, setZone] = useState<Zone>('studio');
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
          padding: '6px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: 2, color: '#888' }}>iDOTMATRIX DEV TOOLS</span>
        {(['device', 'studio', 'diagnostics'] as Zone[]).map((z) => (
          <button key={z} style={tabStyle(zone === z)} onClick={() => setZone(z)}>
            {z.toUpperCase()}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {zone === 'studio' && studioNav && (
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

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Persistent preview — always visible regardless of active zone */}
        <aside
          style={{
            width: 400,
            flexShrink: 0,
            borderRight: '1px solid #2a2a2a',
            overflowY: 'auto',
            background: '#101010',
          }}
        >
          <PreviewStage />
        </aside>

        {/* Active zone content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {zone === 'device' && <DevicePanel version={version} />}
          {zone === 'studio' && <Studio onNavActionsChange={setStudioNav} />}
          {zone === 'diagnostics' && <DiagnosticsPanel />}
        </div>
      </main>
    </div>
  );
}
