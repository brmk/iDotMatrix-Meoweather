import { useEffect, useState } from 'react';
import LogsPanel from './LogsPanel';

interface SidecarHealth {
  connected: boolean;
  device_name: string | null;
  device_address: string | null;
}

function HealthStrip() {
  const [health, setHealth] = useState<SidecarHealth | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/sidecar/health');
        if (r.ok) setHealth((await r.json()) as SidecarHealth);
      } catch {
        /* sidecar offline */
      }
    };
    void poll();
    const id = setInterval(() => {
      void poll();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  if (!health) {
    return <span style={{ color: '#555' }}>sidecar offline</span>;
  }

  return (
    <span>
      <span style={{ color: health.connected ? '#4a8' : '#a44', fontWeight: 'bold' }}>{health.connected ? '● connected' : '● disconnected'}</span>
      {health.device_name && <span style={{ color: '#888', marginLeft: 8 }}>{health.device_name}</span>}
      {health.device_address && <span style={{ color: '#555', marginLeft: 6, fontSize: 10 }}>{health.device_address}</span>}
    </span>
  );
}

export default function DiagnosticsPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid #2a2a2a',
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#666',
          background: '#141414',
          flexShrink: 0,
        }}
      >
        <HealthStrip />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LogsPanel />
      </div>
    </div>
  );
}
