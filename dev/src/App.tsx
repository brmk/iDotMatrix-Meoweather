import { useState } from 'react';
import Simulator from './components/Simulator';
import Studio from './components/Studio';

type Tab = 'simulator' | 'studio';

const tabStyle = (active: boolean): React.CSSProperties => ({
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

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        background: '#1e1e1e', borderBottom: '1px solid #333',
        padding: '6px 16px', display: 'flex', gap: 16, alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, letterSpacing: 2, color: '#888' }}>iDOTMATRIX DEV TOOLS</span>
        {(['simulator', 'studio'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </header>
      {tab === 'simulator' && <Simulator />}
      {tab === 'studio'    && <Studio />}
    </div>
  );
}
