import { useState, useRef, useEffect, useCallback } from 'react';
import { RAW_SPRITES, type SpriteKey } from '@src/sprites';
import { drawPetWithSprites, PET_DAY, PET_Y_WALK } from '@src/render/pet-draw';
import { renderAnimation } from '@src/render/scene';
import { makePetContext, advancePet } from '@src/pet/index';
import type { PetState, PetContext } from '@src/pet/index';

// ---- constants derived from src/ — no duplication ----
const FRAME_ORDER: SpriteKey[] = [
  'WALK_A','WALK_B','BLINK_A','BLINK_B',
  'SIT_A','SIT_B','LIE_A','LIE_B',
  'JUMP_1','JUMP_2','JUMP_3','JUMP_4','DREAM',
];

const PALETTE_KEYS = ['.', 'o', 'g', 's', 'l', 'r'];
const COLOR_CSS: Record<string, string> = {
  '.': '#111',
  ...Object.fromEntries(
    Object.entries(PET_DAY).map(([k, [r, g, b]]) => [k, `rgb(${r},${g},${b})`])
  ),
};

const BEHAVIOR_DUR: Record<string, number> = { walk: 0, sit: 60, lie: 80, jump: 8, perch: 12, dream: 120 };
const WEATHER_OPTIONS = [
  { value: '0_day',  label: '☀ Clear Day' },  { value: '0_night', label: '🌙 Clear Night' },
  { value: '2',  label: '⛅ Partly Cloudy' },  { value: '3',  label: '☁ Cloudy' },
  { value: '45', label: '🌫 Fog' },            { value: '61', label: '🌧 Rain' },
  { value: '82', label: '⛈ Heavy Rain' },      { value: '71', label: '❄ Snow' },
  { value: '95', label: '⚡ Thunder' },
];

const CELL = 48;
const SCALE = 10;

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

function defaultFrames(): Record<SpriteKey, string[]> {
  return Object.fromEntries(FRAME_ORDER.map(k => [k, [...RAW_SPRITES[k]]])) as Record<SpriteKey, string[]>;
}

function loadFromLS(): Record<SpriteKey, string[]> {
  try {
    const raw = localStorage.getItem('studio_frames');
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<SpriteKey, string[]>>;
      return Object.fromEntries(FRAME_ORDER.map(k => [k, saved[k] ?? [...RAW_SPRITES[k]]])) as Record<SpriteKey, string[]>;
    }
  } catch (_) { /* ignore */ }
  return defaultFrames();
}

export default function Studio() {
  const [frames, setFrames]   = useState<Record<SpriteKey, string[]>>(loadFromLS);
  const [curFrame, setCurFrame] = useState<SpriteKey>('WALK_A');
  const [selColor, setSelColor] = useState('o');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const [iconVal, setIconVal] = useState('0_day');
  const [temp,    setTemp]    = useState(20);
  const [night,   setNight]   = useState(false);
  const [speed,   setSpeed]   = useState(1);
  const [info,    setInfo]    = useState('');
  const [behavior,setBehavior]= useState('walk');

  const gridRef    = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const offRef     = useRef<HTMLCanvasElement | null>(null);
  const painting   = useRef(false);

  const petRef     = useRef<PetState>({ x: 0, facingRight: true, behavior: 'walk', walkFrame: 0, behaviorFrame: 0, tailPhase: 0, isDay: true, eyesClosed: false, perchY: PET_Y_WALK });
  const petCtxRef  = useRef<PetContext>(makePetContext());
  const frameIdxRef= useRef(0);
  const lastTsRef  = useRef(0);
  const lastInfoRef= useRef(0);
  const tickRef    = useRef(0);
  const rafRef     = useRef(0);

  const liveRef = useRef({ frames, iconVal, temp, night, speed });
  useEffect(() => { liveRef.current = { frames, iconVal, temp, night, speed }; }, [frames, iconVal, temp, night, speed]);

  // ---- Draw grid ----
  useEffect(() => {
    const canvas = gridRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rows = frames[curFrame];
    canvas.width  = 5 * CELL + 1;
    canvas.height = rows.length * CELL + 1;

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 5; c++) {
        const ch = rows[r]?.[c] ?? '.';
        ctx.fillStyle = COLOR_CSS[ch] ?? '#111';
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 1, CELL - 1);
        if (ch !== '.') {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.font = '15px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ch, c * CELL + CELL / 2, r * CELL + CELL / 2);
        }
      }
    }
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i*CELL+.5,0); ctx.lineTo(i*CELL+.5, rows.length*CELL); ctx.stroke(); }
    for (let i = 0; i <= rows.length; i++) { ctx.beginPath(); ctx.moveTo(0,i*CELL+.5); ctx.lineTo(5*CELL,i*CELL+.5); ctx.stroke(); }
  }, [frames, curFrame]);

  // ---- Preview loop ----
  useEffect(() => {
    if (!offRef.current) offRef.current = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
    const canvas = previewRef.current!;
    const ctx  = canvas.getContext('2d')!;
    const octx = offRef.current.getContext('2d')!;

    function loop(ts: number) {
      rafRef.current = requestAnimationFrame(loop);
      const { frames, iconVal, temp, night, speed } = liveRef.current;
      const raw = iconVal;
      const snap = raw === '0_night'
        ? { weatherCode: 0, isDay: false, temperature: temp }
        : { weatherCode: Number.parseInt(raw, 10), isDay: !night, temperature: temp };
      const wFrames = renderAnimation(snap);
      if (!wFrames.length) return;

      const f = wFrames[frameIdxRef.current % wFrames.length]!;
      if (ts - lastTsRef.current < f.delayMs / speed) return;
      lastTsRef.current = ts;

      petRef.current.isDay = snap.isDay;
      advancePet(petRef.current, petCtxRef.current);
      setBehavior(petRef.current.behavior);

      const pixels = new Uint8Array(f.pixels);
      drawPetWithSprites(pixels, petRef.current, frames as Record<SpriteKey, string[]>);

      const img = octx.createImageData(32, 32);
      for (let i = 0; i < 1024; i++) {
        img.data[i*4]   = pixels[i*3]!;
        img.data[i*4+1] = pixels[i*3+1]!;
        img.data[i*4+2] = pixels[i*3+2]!;
        img.data[i*4+3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offRef.current!, 0, 0, 32*SCALE, 32*SCALE);

      frameIdxRef.current = (frameIdxRef.current + 1) % wFrames.length;
      tickRef.current++;

      if (ts - lastInfoRef.current >= 1000) {
        setInfo(`${tickRef.current} fps · ${f.delayMs}ms · ${petRef.current.behavior} · x:${petRef.current.x} · editing: ${curFrame}`);
        tickRef.current = 0;
        lastInfoRef.current = ts;
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Painting ----
  const paintAt = useCallback((e: React.MouseEvent<HTMLCanvasElement>, forceErase = false) => {
    const canvas = gridRef.current!;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) * (canvas.width  / rect.width)  / CELL);
    const row = Math.floor((e.clientY - rect.top)  * (canvas.height / rect.height) / CELL);
    const color = forceErase ? '.' : selColor;
    setFrames(prev => {
      const rows = prev[curFrame];
      if (row < 0 || row >= rows.length || col < 0 || col >= 5) return prev;
      const rowArr = [...(rows[row] ?? '')];
      if (rowArr[col] === color) return prev;
      rowArr[col] = color;
      const next = { ...prev, [curFrame]: rows.map((r, i) => i === row ? rowArr.join('') : r) };
      localStorage.setItem('studio_frames', JSON.stringify(next));
      return next;
    });
    setSaveStatus('unsaved');
  }, [curFrame, selColor]);

  useEffect(() => {
    const up = () => { painting.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ---- Save / reset ----
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/save-sprites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frames),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }, [frames]);

  const handleReset = useCallback(() => {
    if (!confirm('Reset all frames to defaults?')) return;
    const d = defaultFrames();
    setFrames(d);
    localStorage.setItem('studio_frames', JSON.stringify(d));
    setSaveStatus('saved');
  }, []);

  const forceBehavior = useCallback((b: string) => {
    setBehavior(b);
    petRef.current.behavior = b as PetState['behavior'];
    petRef.current.behaviorFrame = 0;
    petCtxRef.current.behaviorDur = BEHAVIOR_DUR[b] ?? 0;
    if (b === 'perch') petRef.current.perchY = PET_Y_WALK;
  }, []);

  const statusColor = { saved: '#4a8', unsaved: '#a84', saving: '#888', error: '#a44' }[saveStatus];
  const gridRows = frames[curFrame];
  const gridWidth = 5 * CELL + 1;
  const gridHeight = gridRows.length * CELL + 1;

  // ---- Shared input styles ----
  const inp: React.CSSProperties = { background: '#222', color: '#ccc', border: '1px solid #3a3a3a', padding: '3px 5px', fontFamily: 'monospace', fontSize: 11, width: '100%' };
  const btn: React.CSSProperties = { background: '#2a2a2a', color: '#bbb', border: '1px solid #3a3a3a', padding: '5px 10px', fontFamily: 'monospace', fontSize: 11 };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 37px)', overflow: 'hidden' }}>

      {/* ---- Editor panel ---- */}
      <section style={{ width: 320, flexShrink: 0, borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Frame tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 6, background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}>
          {FRAME_ORDER.map(name => (
            <button key={name} onClick={() => setCurFrame(name)} style={{
              padding: '3px 7px', fontFamily: 'monospace', fontSize: 10,
              background: curFrame === name ? '#1a3a1a' : '#2a2a2a',
              border: `1px solid ${curFrame === name ? '#4a8' : '#3a3a3a'}`,
              color: curFrame === name ? '#8f8' : '#888',
            }}>{name}</button>
          ))}
        </div>

        {/* Grid canvas */}
        <div style={{ flex: 1, padding: 12, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'auto' }}>
          <canvas ref={gridRef}
            style={{ cursor: 'crosshair', imageRendering: 'pixelated', width: gridWidth, height: gridHeight, flex: '0 0 auto' }}
            onMouseDown={e => { e.preventDefault(); painting.current = true; paintAt(e, e.button === 2); }}
            onMouseMove={e => { if (painting.current) paintAt(e, e.button === 2); }}
            onContextMenu={e => { e.preventDefault(); paintAt(e, true); }}
          />
        </div>

        {/* Palette */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap', borderTop: '1px solid #2a2a2a' }}>
          {PALETTE_KEYS.map(k => (
            <div key={k} onClick={() => setSelColor(k)} title={k === '.' ? 'erase' : k} style={{
              width: 36, height: 36, background: COLOR_CSS[k], cursor: 'pointer',
              border: `2px solid ${selColor === k ? '#fff' : '#444'}`,
              boxShadow: selColor === k ? '0 0 0 2px #fff4' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 'bold', color: 'rgba(0,0,0,0.7)',
            }}>{k === '.' ? '✕' : k}</div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={btn} onClick={handleSave}>Save sprites</button>
          <button style={btn} onClick={handleReset}>Reset defaults</button>
          <span style={{ fontSize: 10, color: statusColor, marginLeft: 4 }}>
            ● {saveStatus === 'saving' ? 'saving…' : saveStatus === 'error' ? 'save failed — is npm run dev:sim running?' : saveStatus}
          </span>
        </div>
      </section>

      {/* ---- Preview panel ---- */}
      <section style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <canvas ref={previewRef} width={32*SCALE} height={32*SCALE}
            style={{ imageRendering: 'pixelated', border: '1px solid #333' }} />
          <div style={{ fontSize: 10, color: '#555', minHeight: 14 }}>{info}</div>
        </div>

        {/* Controls */}
        <div style={{ padding: 12, width: 220, borderLeft: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <h2 style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>WEATHER</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: '#666' }}>
            Icon
            <select value={iconVal} onChange={e => setIconVal(e.target.value)} style={inp}>
              {WEATHER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: '#666' }}>
            Temp °C
            <input type="number" value={temp} min={-30} max={50} style={inp} onChange={e => setTemp(Number(e.target.value))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, fontSize: 10, color: '#666' }}>
            Night <input type="checkbox" checked={night} onChange={e => setNight(e.target.checked)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: '#666' }}>
            Speed ×{speed.toFixed(2)}
            <input type="range" min={0.25} max={4} step={0.25} value={speed} style={inp} onChange={e => setSpeed(Number(e.target.value))} />
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #2a2a2a' }} />
          <h2 style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>PET BEHAVIOR</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.keys(BEHAVIOR_DUR).map(b => (
              <button key={b} onClick={() => forceBehavior(b)} style={{
                padding: '4px 8px', fontFamily: 'monospace', fontSize: 10,
                background: behavior === b ? '#1a3a1a' : '#2a2a2a',
                color:      behavior === b ? '#8f8'   : '#bbb',
                border:     `1px solid ${behavior === b ? '#4a8' : '#3a3a3a'}`,
              }}>{b}</button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
