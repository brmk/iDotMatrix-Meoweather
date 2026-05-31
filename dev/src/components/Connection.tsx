import { useCallback, useEffect, useState, type CSSProperties } from 'react';

interface SidecarHealth {
  connected: boolean;
  device_name: string | null;
  device_address: string | null;
}

interface BleDevice {
  address: string;
  name: string;
  is_idm: boolean;
  is_connected: boolean;
}

interface AppState {
  matrixPaused: boolean;
}

const S = {
  root: { padding: '20px 24px', fontFamily: 'monospace', fontSize: 12, color: '#ccc', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionTitle: { fontSize: 10, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 2 },
  row: { display: 'flex', alignItems: 'center', gap: 10 },
  badge: (ok: boolean): CSSProperties => ({ color: ok ? '#4a8' : '#a44', fontWeight: 'bold' }),
  btn: (variant: 'default' | 'danger' | 'primary' = 'default'): CSSProperties => ({
    background: variant === 'primary' ? '#1a3a1a' : variant === 'danger' ? '#3a1a1a' : '#2a2a2a',
    color: variant === 'primary' ? '#8f8' : variant === 'danger' ? '#f88' : '#bbb',
    border: `1px solid ${variant === 'primary' ? '#4a8' : variant === 'danger' ? '#a44' : '#3a3a3a'}`,
    padding: '4px 12px',
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
  }),
  deviceRow: (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    background: active ? '#1a2e1a' : '#1a1a1a',
    border: `1px solid ${active ? '#3a6a3a' : '#2a2a2a'}`,
    borderRadius: 3,
  }),
  deviceName: { flex: 1, color: '#ddd' },
  deviceAddr: { color: '#555', fontSize: 10 },
  spinner: { color: '#888', fontSize: 10 },
} satisfies {
  root: CSSProperties;
  section: CSSProperties;
  sectionTitle: CSSProperties;
  row: CSSProperties;
  badge: (ok: boolean) => CSSProperties;
  btn: (variant?: 'default' | 'danger' | 'primary') => CSSProperties;
  deviceRow: (active: boolean) => CSSProperties;
  deviceName: CSSProperties;
  deviceAddr: CSSProperties;
  spinner: CSSProperties;
};

export default function Connection() {
  const [health, setHealth] = useState<SidecarHealth | null>(null);
  const [paused, setPaused] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[] | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch('/api/sidecar/health');
      if (r.ok) setHealth((await r.json()) as SidecarHealth);
    } catch {
      /* sidecar offline */
    }
  }, []);

  // Poll sidecar health every 3s
  useEffect(() => {
    const bootId = setTimeout(() => {
      void fetchHealth();
    }, 0);
    const id = setInterval(() => {
      void fetchHealth();
    }, 3000);
    return () => {
      clearTimeout(bootId);
      clearInterval(id);
    };
  }, [fetchHealth]);

  // SSE for matrixPaused state
  useEffect(() => {
    const es = new EventSource('/api/state');
    es.onmessage = (e) => {
      try {
        const s = JSON.parse(e.data as string) as AppState;
        setPaused(s.matrixPaused);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  const togglePause = async () => {
    const next = !paused;
    await fetch('/api/control/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: next }) });
    setPaused(next);
    if (!next) setTimeout(fetchHealth, 2000); // give sidecar time to reconnect
  };

  const scan = async () => {
    setScanning(true);
    setDevices(null);
    setError(null);
    try {
      const r = await fetch('/api/sidecar/ble/scan');
      const data = (await r.json()) as { devices?: BleDevice[] };
      if (!r.ok || !Array.isArray(data.devices)) {
        setError('Scan failed — unexpected response from sidecar');
      } else {
        setDevices(data.devices);
      }
    } catch {
      setError('Scan failed — is the sidecar running?');
    } finally {
      setScanning(false);
    }
  };

  const connectDevice = async (device: BleDevice) => {
    setConnecting(device.address);
    setError(null);
    try {
      const r = await fetch('/api/sidecar/ble/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: device.address, name: device.name }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { detail?: string };
        setError(d.detail ?? 'Connect failed');
      } else {
        await fetchHealth();
      }
    } catch {
      setError('Connect failed — is the sidecar running?');
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await fetch('/api/sidecar/ble/disconnect', { method: 'POST' });
      await fetchHealth();
    } catch {
      setError('Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div style={S.root}>
      {/* Current connection */}
      <div style={S.section}>
        <div style={S.sectionTitle}>BLE connection</div>
        {health ? (
          <>
            <div style={S.row}>
              <span style={S.badge(health.connected)}>{health.connected ? '● connected' : '● disconnected'}</span>
              {health.device_name && <span style={{ color: '#aaa' }}>{health.device_name}</span>}
              {health.device_address && <span style={{ color: '#555', fontSize: 10 }}>{health.device_address}</span>}
            </div>
            <div style={S.row}>
              {health.connected && (
                <button style={S.btn('danger')} onClick={disconnect} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              )}
            </div>
          </>
        ) : (
          <span style={S.spinner}>Connecting to sidecar…</span>
        )}
      </div>

      {/* Pause / Resume */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Matrix</div>
        <div style={S.row}>
          <span style={{ color: paused ? '#a84' : '#4a8' }}>{paused ? '● paused' : '● running'}</span>
          <button style={S.btn(paused ? 'primary' : 'default')} onClick={togglePause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          {paused && <span style={{ color: '#555', fontSize: 10 }}>BLE released — local dev can connect</span>}
        </div>
      </div>

      {/* Device scanner */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Nearby devices</div>
        <div style={S.row}>
          <button style={S.btn()} onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan (8s)'}
          </button>
          {scanning && <span style={S.spinner}>scanning BLE…</span>}
        </div>
        {error && <div style={{ color: '#f88', fontSize: 11 }}>{error}</div>}
        {devices !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {devices.length === 0 && <span style={{ color: '#555' }}>No named BLE devices found.</span>}
            {devices.map((d) => (
              <div key={d.address} style={S.deviceRow(d.is_connected)}>
                <span style={{ color: d.is_idm ? '#6b8' : '#888', fontSize: 10 }}>{d.is_idm ? '▶' : '○'}</span>
                <span style={S.deviceName}>{d.name}</span>
                <span style={S.deviceAddr}>{d.address}</span>
                <button
                  style={S.btn(d.is_connected ? 'primary' : 'default')}
                  onClick={() => connectDevice(d)}
                  disabled={d.is_connected || connecting === d.address}
                >
                  {connecting === d.address ? 'Connecting…' : d.is_connected ? 'Connected' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
