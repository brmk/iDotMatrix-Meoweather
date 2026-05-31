import { DEFAULTS } from '@src/defaults';
import type { PetContext, PetState } from '@src/pet/index';
import { advancePet, makePetContext } from '@src/pet/index';
import { drawPet } from '@src/render/pet/draw';
import { PET_Y_WALK } from '@src/render/pet/sprites';
import { renderAnimationFrames as renderAnimation } from '@src/render/scene/frame';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const SCALE = 10;
const BEHAVIOR_DUR: Record<string, number> = {
  walk: 0,
  sit: 60,
  lie: 80,
  jump: 8,
  perch: 12,
  dream: 120,
  burp: 12,
  poo: 10,
};

const WEATHER_OPTIONS = [
  { value: '0_day', label: '☀️  Clear Day' },
  { value: '0_night', label: '🌙  Clear Night' },
  { value: '2', label: '⛅  Partly Cloudy' },
  { value: '3', label: '☁️  Cloudy' },
  { value: '45', label: '🌫️  Fog' },
  { value: '61', label: '🌧️  Rain' },
  { value: '82', label: '⛈️  Heavy Rain' },
  { value: '71', label: '❄️  Snow' },
  { value: '95', label: '⚡  Thunder' },
];

function parseWeather(raw: string, night: boolean) {
  if (raw === '0_night') return { weatherCode: 0, isDay: false };
  return { weatherCode: Number.parseInt(raw, 10), isDay: !night };
}

interface LiveState {
  ok: boolean;
  behavior: string | null;
  tick: number;
  weatherCode: number | null;
  temperature: number | null;
  isDay: boolean | null;
  humidity: number | null;
  windSpeed: number | null;
  weatherOverride: boolean;
  brightness?: { day: number; night: number };
  nightHours?: { from: number; to: number } | null;
  powerSchedule?: { offFrom: number; offTo: number } | null;
  matrixPaused?: boolean;
}

const ctrl: CSSProperties = {
  background: '#2a2a2a',
  color: '#ddd',
  border: '1px solid #555',
  padding: '4px 6px',
  fontFamily: 'monospace',
  fontSize: 12,
};

async function postBehavior(behavior: string): Promise<void> {
  await fetch('/api/control/behavior', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ behavior }),
  });
}

async function postWeather(iconVal: string, temp: number, night: boolean): Promise<void> {
  const { weatherCode, isDay } = parseWeather(iconVal, night);
  await fetch('/api/control/weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weatherCode, isDay, temperature: temp, humidity: 50, windSpeed: 10, windDirection: 0 }),
  });
}

async function clearWeather(): Promise<void> {
  await fetch('/api/control/weather/clear', { method: 'POST' });
}

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

async function postPause(paused: boolean): Promise<void> {
  await fetch('/api/control/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paused }),
  });
}

async function postPowerSchedule(offFrom: number | null, offTo: number | null): Promise<void> {
  await fetch('/api/control/power-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offFrom === null ? null : { offFrom, offTo }),
  });
}

export default function Simulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const petRef = useRef<PetState>({
    x: 0,
    facingRight: true,
    behavior: 'walk',
    walkFrame: 0,
    behaviorFrame: 0,
    tailPhase: 0,
    isDay: true,
    eyesClosed: false,
    perchY: PET_Y_WALK,
    pukeItems: [],
    pooItems: [],
  });
  const petCtxRef = useRef<PetContext>(makePetContext());
  const frameIdxRef = useRef(0);
  const lastTsRef = useRef(0);
  const lastInfoRef = useRef(0);
  const tickRef = useRef(0);
  const rafRef = useRef(0);

  const [iconVal, setIconVal] = useState('0_day');
  const [temp, setTemp] = useState(20);
  const [night, setNight] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [info, setInfo] = useState('loading…');
  const [behavior, setBehavior] = useState('walk');

  const [remote, setRemote] = useState(false);
  const [liveState, setLiveState] = useState<LiveState | null>(null);

  const [dayBrightness, setDayBrightness] = useState<number>(DEFAULTS.dayBrightness);
  const [nightBrightness, setNightBrightness] = useState<number>(DEFAULTS.nightBrightness);
  const [nightFrom, setNightFrom] = useState<number>(DEFAULTS.nightHoursFrom);
  const [nightTo, setNightTo] = useState<number>(DEFAULTS.nightHoursTo);
  const [powerOffFrom, setPowerOffFrom] = useState<number>(DEFAULTS.powerOffFrom);
  const [powerOffTo, setPowerOffTo] = useState<number>(DEFAULTS.powerOffTo);
  // tracks fields the user is actively editing — SSE syncs are skipped for those fields
  const editingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Keep latest control values accessible inside the animation loop without restarts.
  const liveRef = useRef({ iconVal, temp, night, speed });
  useEffect(() => {
    liveRef.current = { iconVal, temp, night, speed };
  }, [iconVal, temp, night, speed]);

  // Auto-detect remote control server on mount.
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

  // Subscribe to SSE state stream when remote (behavior + weather status).
  useEffect(() => {
    if (!remote) return;
    const es = new EventSource('/api/state');
    es.onmessage = (e) => {
      try {
        setLiveState(JSON.parse(e.data as string) as LiveState);
      } catch {
        /* ignore malformed event */
      }
    };
    return () => es.close();
  }, [remote]);

  // Derived from server — no local state needed for the toggle itself.
  const nightHoursEnabled = liveState?.nightHours != null;
  const powerScheduleEnabled = liveState?.powerSchedule != null;

  const markEditing = useCallback((field: string) => {
    clearTimeout(editingRef.current[field]);
    editingRef.current[field] = setTimeout(() => {
      delete editingRef.current[field];
    }, 2000);
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

  // Subscribe to pixel-perfect frame stream when remote — replaces rAF canvas.
  useEffect(() => {
    if (!remote) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    const es = new EventSource('/api/frame');
    es.onmessage = (e) => {
      img.onload = () => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, 32 * SCALE, 32 * SCALE);
      };
      img.src = `data:image/png;base64,${e.data as string}`;
    };
    return () => es.close();
  }, [remote]);

  // Local rAF animation loop — runs only when not connected to a live instance.
  useEffect(() => {
    if (remote) return;

    if (!offRef.current) {
      offRef.current = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
    }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const octx = offRef.current.getContext('2d')!;

    function loop(ts: number) {
      rafRef.current = requestAnimationFrame(loop);
      const { iconVal, temp, night, speed } = liveRef.current;
      const snap = {
        temperature: temp,
        humidity: 0,
        windSpeed: 0,
        windDirection: 0,
        fetchedAt: new Date(),
        ...parseWeather(iconVal, night),
      };
      const frames = renderAnimation(snap);
      if (!frames.length) return;

      const f = frames[frameIdxRef.current % frames.length]!;
      const delay = f.delayMs / speed;
      if (ts - lastTsRef.current < delay) return;
      lastTsRef.current = ts;

      petRef.current.isDay = snap.isDay;
      advancePet(petRef.current, petCtxRef.current);
      setBehavior(petRef.current.behavior);

      const pixels = new Uint8Array(f.pixels);
      drawPet(pixels, petRef.current);

      const img = octx.createImageData(32, 32);
      for (let i = 0; i < 1024; i++) {
        img.data[i * 4] = pixels[i * 3]!;
        img.data[i * 4 + 1] = pixels[i * 3 + 1]!;
        img.data[i * 4 + 2] = pixels[i * 3 + 2]!;
        img.data[i * 4 + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offRef.current!, 0, 0, 32 * SCALE, 32 * SCALE);

      frameIdxRef.current = (frameIdxRef.current + 1) % frames.length;
      tickRef.current++;

      if (ts - lastInfoRef.current >= 1000) {
        const p = petRef.current;
        setInfo(`${tickRef.current} fps · ${f.delayMs}ms · pet: ${p.behavior} · x:${p.x} · perchY:${p.perchY}`);
        tickRef.current = 0;
        lastInfoRef.current = ts;
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [remote]);

  const forceBehavior = useCallback(
    (b: string) => {
      if (remote) {
        void postBehavior(b);
        return;
      }
      setBehavior(b);
      petRef.current.behavior = b as PetState['behavior'];
      petRef.current.behaviorFrame = 0;
      petCtxRef.current.behaviorDur = BEHAVIOR_DUR[b] ?? 0;
      if (b === 'perch') petRef.current.perchY = PET_Y_WALK;
    },
    [remote],
  );

  const handleIconVal = useCallback(
    (val: string) => {
      setIconVal(val);
      if (remote) void postWeather(val, temp, night);
    },
    [remote, temp, night],
  );

  const handleTemp = useCallback(
    (val: number) => {
      setTemp(val);
      if (remote) void postWeather(iconVal, val, night);
    },
    [remote, iconVal, night],
  );

  const handleNight = useCallback(
    (val: boolean) => {
      setNight(val);
      if (remote) void postWeather(iconVal, temp, val);
    },
    [remote, iconVal, temp],
  );

  const liveBehavior = liveState?.behavior ?? behavior;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 14, letterSpacing: 2, color: '#888' }}>iDotMatrix 32×32 Simulator</h1>
        {remote &&
          (liveState?.matrixPaused ? (
            <span style={{ fontSize: 10, color: '#a84', letterSpacing: 1, border: '1px solid #864', padding: '2px 6px' }}>⏸ PAUSED</span>
          ) : (
            <span style={{ fontSize: 10, color: '#4a8', letterSpacing: 1, border: '1px solid #2a5', padding: '2px 6px' }}>● LIVE</span>
          ))}
      </div>

      <canvas
        ref={canvasRef}
        width={32 * SCALE}
        height={32 * SCALE}
        style={{ imageRendering: 'pixelated', border: `1px solid ${remote ? '#2a5' : '#444'}`, background: '#000' }}
      />

      {remote && liveState ? (
        <div style={{ fontSize: 10, color: '#4a8', letterSpacing: 1 }}>
          matrix: {liveState.behavior ?? '…'} · tick {liveState.tick} · {liveState.weatherCode} {liveState.temperature}°C {liveState.isDay ? 'day' : 'night'}
          {liveState.weatherOverride && ' · weather overridden'}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: '#555', minHeight: 14 }}>{info}</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 420 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' }}>
          Weather
          <select value={iconVal} onChange={(e) => handleIconVal(e.target.value)} style={ctrl}>
            {WEATHER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' }}>
          Temp (°C)
          <input type="number" value={temp} min={-30} max={50} style={{ ...ctrl, width: 64 }} onChange={(e) => handleTemp(Number(e.target.value))} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' }}>
          Night mode
          <input type="checkbox" checked={night} onChange={(e) => handleNight(e.target.checked)} />
        </label>

        {remote && liveState?.weatherOverride && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' }}>
            &nbsp;
            <button onClick={() => void clearWeather()} style={{ ...ctrl, color: '#fa8', borderColor: '#a64', cursor: 'pointer' }}>
              Use real weather
            </button>
          </label>
        )}

        {!remote && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' }}>
            Speed ×{speed.toFixed(2)}
            <input type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: 110 }} />
          </label>
        )}

        {remote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: '#888', minWidth: 200 }}>
            <span style={{ color: '#555', letterSpacing: 1, fontSize: 10 }}>DISPLAY</span>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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

            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  id="night-hours-toggle"
                  type="checkbox"
                  checked={nightHoursEnabled}
                  onChange={(e) => {
                    void postNightHours(e.target.checked ? nightFrom : null, e.target.checked ? nightTo : null);
                  }}
                />
                <label htmlFor="night-hours-toggle">Night hours override</label>
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
                      void postNightHours(v, nightTo);
                    }}
                  />
                  <span>–</span>
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
                      void postNightHours(nightFrom, v);
                    }}
                  />
                  <span style={{ color: '#555', fontSize: 10 }}>h</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  id="power-schedule-toggle"
                  type="checkbox"
                  checked={powerScheduleEnabled}
                  onChange={(e) => {
                    void postPowerSchedule(e.target.checked ? powerOffFrom : null, e.target.checked ? powerOffTo : null);
                  }}
                />
                <label htmlFor="power-schedule-toggle">Matrix off hours</label>
              </div>
              {powerScheduleEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 20 }}>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={powerOffFrom}
                    style={{ ...ctrl, width: 48 }}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      markEditing('powerOffFrom');
                      setPowerOffFrom(v);
                      void postPowerSchedule(v, powerOffTo);
                    }}
                  />
                  <span>–</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={powerOffTo}
                    style={{ ...ctrl, width: 48 }}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      markEditing('powerOffTo');
                      setPowerOffTo(v);
                      void postPowerSchedule(powerOffFrom, v);
                    }}
                  />
                  <span style={{ color: '#555', fontSize: 10 }}>h (matrix fully off)</span>
                </div>
              )}
            </div>

            <button
              onClick={() => void postPause(!liveState?.matrixPaused)}
              style={{
                ...ctrl,
                cursor: 'pointer',
                color: liveState?.matrixPaused ? '#a84' : '#888',
                borderColor: liveState?.matrixPaused ? '#864' : '#555',
                background: liveState?.matrixPaused ? '#2a1a00' : '#2a2a2a',
              }}
            >
              {liveState?.matrixPaused ? '▶ Resume matrix' : '⏸ Pause matrix'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' }}>
          Force behavior {remote && <span style={{ color: '#4a8' }}>(→ matrix)</span>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(BEHAVIOR_DUR).map((b) => (
              <button
                key={b}
                onClick={() => forceBehavior(b)}
                style={{
                  background: liveBehavior === b ? '#1a3a1a' : '#333',
                  color: liveBehavior === b ? '#8f8' : '#ddd',
                  border: `1px solid ${liveBehavior === b ? '#4a8' : '#555'}`,
                  padding: '5px 10px',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
