import { DEFAULTS } from '@src/defaults';
import { useCallback, useEffect, useRef, useState } from 'react';
import Connection from './Connection';
import TimeRangeClock from './TimeRangeClock';

interface VersionInfo {
  app: string;
  schema: number;
}

interface LiveState {
  ok: boolean;
  matrixPaused?: boolean;
  brightness?: { day: number; night: number };
  nightHours?: { from: number; to: number } | null;
  powerSchedule?: { offFrom: number; offTo: number } | null;
}

const ctrl = {
  background: '#2a2a2a',
  color: '#ddd',
  border: '1px solid #555',
  padding: '4px 6px',
  fontFamily: 'monospace',
  fontSize: 12,
} as const;

async function postBrightness(day: number, night: number): Promise<void> {
  await fetch('/api/control/brightness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, night }),
  });
}

async function postNightHours(from: number | null, to: number | null): Promise<void> {
  await fetch('/api/control/night-hours', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(from === null ? null : { from, to }),
  });
}

async function postPowerSchedule(offFrom: number | null, offTo: number | null): Promise<void> {
  await fetch('/api/control/power-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offFrom === null ? null : { offFrom, offTo }),
  });
}

interface DevicePanelProps {
  version: VersionInfo | null;
}

export default function DevicePanel({ version }: DevicePanelProps) {
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [remote, setRemote] = useState(false);

  const [dayBrightness, setDayBrightness] = useState<number>(DEFAULTS.dayBrightness);
  const [nightBrightness, setNightBrightness] = useState<number>(DEFAULTS.nightBrightness);
  const [nightFrom, setNightFrom] = useState<number>(DEFAULTS.nightHoursFrom);
  const [nightTo, setNightTo] = useState<number>(DEFAULTS.nightHoursTo);
  const [powerOffFrom, setPowerOffFrom] = useState<number>(DEFAULTS.powerOffFrom);
  const [powerOffTo, setPowerOffTo] = useState<number>(DEFAULTS.powerOffTo);

  // tracks fields the user is actively editing — SSE syncs are skipped for those fields
  const editingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // debounce timers for server POST calls
  const postDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? (r.json() as Promise<LiveState>) : null))
      .then((data) => {
        if (data?.ok) setRemote(true);
      })
      .catch(() => {
        /* local-only mode */
      });
  }, []);

  // Single SSE subscription for matrixPaused + device settings
  useEffect(() => {
    const es = new EventSource('/api/state');
    es.onmessage = (e) => {
      try {
        setLiveState(JSON.parse(e.data as string) as LiveState);
      } catch {
        /* ignore malformed event */
      }
    };
    return () => es.close();
  }, []);

  // Sync numeric values from server state; skip fields the user is actively editing.
  useEffect(() => {
    if (!liveState?.brightness) return;
    if (!editingRef.current['dayBrightness']) setDayBrightness(liveState.brightness.day);
    if (!editingRef.current['nightBrightness']) setNightBrightness(liveState.brightness.night);
    if (liveState.nightHours) {
      if (!editingRef.current['nightFrom']) setNightFrom(liveState.nightHours.from);
      if (!editingRef.current['nightTo']) setNightTo(liveState.nightHours.to);
    }
    if (liveState.powerSchedule) {
      if (!editingRef.current['powerOffFrom']) setPowerOffFrom(liveState.powerSchedule.offFrom);
      if (!editingRef.current['powerOffTo']) setPowerOffTo(liveState.powerSchedule.offTo);
    }
  }, [liveState]);

  const markEditing = useCallback((field: string) => {
    clearTimeout(editingRef.current[field]);
    editingRef.current[field] = setTimeout(() => {
      delete editingRef.current[field];
    }, 2000);
  }, []);

  const debouncedPostNightHours = useCallback((from: number | null, to: number | null) => {
    clearTimeout(postDebounceRef.current['nightHours']);
    postDebounceRef.current['nightHours'] = setTimeout(() => {
      void postNightHours(from, to);
    }, 400);
  }, []);

  const debouncedPostPowerSchedule = useCallback((offFrom: number | null, offTo: number | null) => {
    clearTimeout(postDebounceRef.current['powerSchedule']);
    postDebounceRef.current['powerSchedule'] = setTimeout(() => {
      void postPowerSchedule(offFrom, offTo);
    }, 400);
  }, []);

  const nightHoursEnabled = liveState?.nightHours != null;
  const powerScheduleEnabled = liveState?.powerSchedule != null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Connection matrixPaused={liveState?.matrixPaused} />

      {remote && (
        <div style={{ padding: '0 24px 24px', fontFamily: 'monospace', fontSize: 12, color: '#ccc', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Brightness */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#555', textTransform: 'uppercase' }}>Display</div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#888' }}>
              Day brightness {dayBrightness}%
              <input
                type="range"
                min={0}
                max={100}
                value={dayBrightness}
                style={{ width: '100%' }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  markEditing('dayBrightness');
                  setDayBrightness(v);
                  void postBrightness(v, nightBrightness);
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#888' }}>
              Night brightness {nightBrightness}%
              <input
                type="range"
                min={0}
                max={100}
                value={nightBrightness}
                style={{ width: '100%' }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  markEditing('nightBrightness');
                  setNightBrightness(v);
                  void postBrightness(dayBrightness, v);
                }}
              />
            </label>
          </div>

          {/* Night hours */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#555', textTransform: 'uppercase' }}>Night hours</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                id="night-hours-toggle"
                type="checkbox"
                checked={nightHoursEnabled}
                onChange={(e) => {
                  void postNightHours(e.target.checked ? nightFrom : null, e.target.checked ? nightTo : null);
                }}
              />
              <label htmlFor="night-hours-toggle" style={{ fontSize: 11, color: '#888' }}>
                Night hours override
              </label>
            </div>
            {nightHoursEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 20 }}>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={nightFrom}
                  style={{ ...ctrl, width: 48 }}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    markEditing('nightFrom');
                    setNightFrom(v);
                    debouncedPostNightHours(v, nightTo);
                  }}
                />
                <span style={{ color: '#666' }}>–</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={nightTo}
                  style={{ ...ctrl, width: 48 }}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    markEditing('nightTo');
                    setNightTo(v);
                    debouncedPostNightHours(nightFrom, v);
                  }}
                />
                <span style={{ color: '#555', fontSize: 10 }}>h</span>
              </div>
            )}
          </div>

          {/* Power schedule */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#555', textTransform: 'uppercase' }}>Power schedule</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                id="power-schedule-toggle"
                type="checkbox"
                checked={powerScheduleEnabled}
                onChange={(e) => {
                  void postPowerSchedule(e.target.checked ? powerOffFrom : null, e.target.checked ? powerOffTo : null);
                }}
              />
              <label htmlFor="power-schedule-toggle" style={{ fontSize: 11, color: '#888' }}>
                Matrix off hours
              </label>
            </div>
            {powerScheduleEnabled && (
              <div style={{ paddingLeft: 20, paddingTop: 4 }}>
                <TimeRangeClock
                  from={powerOffFrom}
                  to={powerOffTo}
                  onDragStart={() => {
                    markEditing('powerOffFrom');
                    markEditing('powerOffTo');
                  }}
                  onChange={(f, t) => {
                    setPowerOffFrom(f);
                    setPowerOffTo(t);
                    debouncedPostPowerSchedule(f, t);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {version && (
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #2a2a2a',
            fontSize: 10,
            color: '#444',
            fontFamily: 'monospace',
            letterSpacing: 1,
          }}
        >
          v{version.app} · schema {version.schema}
        </div>
      )}
    </div>
  );
}
