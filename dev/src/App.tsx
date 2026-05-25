import { useState, type CSSProperties } from 'react';
import Simulator from './components/Simulator';
import Studio, { type StudioNavActions } from './components/Studio';

type Tab = 'simulator' | 'studio';

const tabStyle = (active: boolean): CSSProperties => ({
  background: active ? '#1a3a1a' : '#2a2a2a',
  color: active ? '#8f8' : '#bbb',
  border: `1px solid ${active ? '#4a8' : '#3a3a3a'}`,
  padding: '4px 14px',
  fontFamily: 'monospace',
  fontSize: 11,
  cursor: 'pointer',
});

export default function App() {
  const [tab, setTab] = useState<Tab>('simulator');
  const [studioNav, setStudioNav] = useState<StudioNavActions | null>(null);
  const statusColor = studioNav ? { saved: '#4a8', unsaved: '#a84', saving: '#888', error: '#a44' }[studioNav.saveStatus] : '#888';
  const statusText = studioNav
    ? studioNav.saveStatus === 'saving'
      ? 'saving…'
      : studioNav.saveStatus === 'error'
        ? 'save failed — is npm run dev:sim running?'
        : studioNav.saveStatus
    : '';

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
        {(['simulator', 'studio'] as Tab[]).map((t) => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
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
      {tab === 'simulator' && <Simulator />}
      {tab === 'studio' && <Studio onNavActionsChange={setStudioNav} />}
    </div>
  );
}
