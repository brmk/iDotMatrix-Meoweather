import { drawPet, PET_Y_WALK, renderAnimation } from '@src/browser-bundle';
import type { PetContext, PetState } from '@src/pet/index';
import { advancePet, makePetContext } from '@src/pet/index';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const SCALE = 10;
const BEHAVIOR_DUR: Record<string, number> = {
  walk: 0,
  sit: 60,
  lie: 80,
  jump: 8,
  perch: 12,
  dream: 120,
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

const ctrl: CSSProperties = {
  background: '#2a2a2a',
  color: '#ddd',
  border: '1px solid #555',
  padding: '4px 6px',
  fontFamily: 'monospace',
  fontSize: 12,
};

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

  // Keep latest control values accessible inside the animation loop without restarts.
  const liveRef = useRef({ iconVal, temp, night, speed });
  useEffect(() => {
    liveRef.current = { iconVal, temp, night, speed };
  }, [iconVal, temp, night, speed]);

  useEffect(() => {
    if (!offRef.current) {
      offRef.current = Object.assign(document.createElement('canvas'), {
        width: 32,
        height: 32,
      });
    }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const octx = offRef.current.getContext('2d')!;

    function loop(ts: number) {
      rafRef.current = requestAnimationFrame(loop);
      const { iconVal, temp, night, speed } = liveRef.current;
      const snap = {
        temperature: temp,
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
  }, []);

  const forceBehavior = useCallback((b: string) => {
    setBehavior(b);
    petRef.current.behavior = b as PetState['behavior'];
    petRef.current.behaviorFrame = 0;
    petCtxRef.current.behaviorDur = BEHAVIOR_DUR[b] ?? 0;
    if (b === 'perch') petRef.current.perchY = PET_Y_WALK;
  }, []);

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 14, letterSpacing: 2, color: '#888' }}>iDotMatrix 32×32 Simulator</h1>
      <canvas
        ref={canvasRef}
        width={32 * SCALE}
        height={32 * SCALE}
        style={{
          imageRendering: 'pixelated',
          border: '1px solid #444',
          background: '#000',
        }}
      />
      <div style={{ fontSize: 10, color: '#555', minHeight: 14 }}>{info}</div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          maxWidth: 420,
        }}
      >
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
            color: '#888',
          }}
        >
          Weather
          <select value={iconVal} onChange={(e) => setIconVal(e.target.value)} style={ctrl}>
            {WEATHER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
            color: '#888',
          }}
        >
          Temp (°C)
          <input type="number" value={temp} min={-30} max={50} style={{ ...ctrl, width: 64 }} onChange={(e) => setTemp(Number(e.target.value))} />
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
            color: '#888',
          }}
        >
          Night mode
          <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} />
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
            color: '#888',
          }}
        >
          Speed ×{speed.toFixed(2)}
          <input type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: 110 }} />
        </label>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
            color: '#888',
          }}
        >
          Force behavior
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(BEHAVIOR_DUR).map((b) => (
              <button
                key={b}
                onClick={() => forceBehavior(b)}
                style={{
                  background: behavior === b ? '#1a3a1a' : '#333',
                  color: behavior === b ? '#8f8' : '#ddd',
                  border: `1px solid ${behavior === b ? '#4a8' : '#555'}`,
                  padding: '5px 10px',
                  fontFamily: 'monospace',
                  fontSize: 11,
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
