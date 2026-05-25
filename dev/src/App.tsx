import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Simulator from './components/Simulator';
import Studio, { type StudioNavActions } from './components/Studio';

type Tab = 'simulator' | 'studio' | 'logs';

const tabStyle = (active: boolean): CSSProperties => ({
  background: active ? '#1a3a1a' : '#2a2a2a',
  color: active ? '#8f8' : '#bbb',
  border: `1px solid ${active ? '#4a8' : '#3a3a3a'}`,
  padding: '4px 14px',
  fontFamily: 'monospace',
  fontSize: 11,
  cursor: 'pointer',
});

interface LogLine {
  id: number;
  text: string;
}

let logSeq = 0;

function LogsPanel() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource('/api/logs');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const text = JSON.parse(e.data as string) as string;
        setLines((prev) => {
          const next = [...prev, { id: ++logSeq, text }];
          return next.length > 500 ? next.slice(-500) : next;
        });
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  // Auto-scroll to bottom when new lines arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div
      style={{
        height: 'calc(100vh - 37px)',
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0d0d',
      }}
    >
      <div
        style={{
          padding: '4px 12px',
          fontSize: 10,
          color: connected ? '#4a8' : '#a44',
          borderBottom: '1px solid #1e1e1e',
          flexShrink: 0,
        }}
      >
        {connected ? '● connected' : '● disconnected — is npm start running?'}
      </div>
      <pre
        style={{
          flex: 1,
          overflow: 'auto',
          margin: 0,
          padding: '10px 14px',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#9a9',
          lineHeight: 1.5,
        }}
      >
        {lines.map((l) => (
          <div key={l.id} style={{ color: l.text.includes('ERROR') ? '#d77' : undefined }}>
            {l.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('simulator');
  const [studioNav, setStudioNav] = useState<StudioNavActions | null>(null);
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
        {(['simulator', 'studio', 'logs'] as Tab[]).map((t) => (
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
      {tab === 'simulator' && <Simulator />}
      {tab === 'studio' && <Studio onNavActionsChange={setStudioNav} />}
      {tab === 'logs' && <LogsPanel />}
    </div>
  );
}
