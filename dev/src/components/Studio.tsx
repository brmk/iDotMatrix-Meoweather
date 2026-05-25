import { EDITABLE_BEHAVIORS, PET_BEHAVIOR_CONFIG, type BehaviorChanceConfig, type BehaviorPeriodConfig, type PetBehaviorConfig } from '@src/pet/config';
import type { PetContext, PetState } from '@src/pet/index';
import { advancePet, makePetContext } from '@src/pet/index';
import { PET_DAY } from '@src/render/pet/colors';
import { drawPetWithSprites } from '@src/render/pet/draw';
import { PET_Y_WALK } from '@src/render/pet/sprites';
import { renderAnimationFrames as renderAnimation } from '@src/render/scene/frame';
import { RAW_SPRITES, type SpriteKey } from '@src/sprites';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

// ---- constants derived from src/ — no duplication ----
const FRAME_ORDER: SpriteKey[] = [
  'WALK_A',
  'WALK_B',
  'BLINK_A',
  'BLINK_B',
  'SIT_A',
  'SIT_B',
  'LIE_A',
  'LIE_B',
  'JUMP_1',
  'JUMP_2',
  'JUMP_3',
  'JUMP_4',
  'DREAM',
  'BURP_A',
  'BURP_B',
  'POO_A',
  'POO_B',
];

const PALETTE_KEYS = ['.', 'o', 'g', 's', 'l', 'r'];
const COLOR_CSS: Record<string, string> = {
  '.': '#111',
  ...Object.fromEntries(Object.entries(PET_DAY).map(([k, [r, g, b]]) => [k, `rgb(${r},${g},${b})`])),
};

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
  { value: '0_day', label: '☀ Clear Day' },
  { value: '0_night', label: '🌙 Clear Night' },
  { value: '2', label: '⛅ Partly Cloudy' },
  { value: '3', label: '☁ Cloudy' },
  { value: '45', label: '🌫 Fog' },
  { value: '61', label: '🌧 Rain' },
  { value: '82', label: '⛈ Heavy Rain' },
  { value: '71', label: '❄ Snow' },
  { value: '95', label: '⚡ Thunder' },
];

const CELL = 48;
const SCALE = 10;

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export interface StudioNavActions {
  saveStatus: SaveStatus;
  onSave: () => void;
  onDiscard: () => void;
}

interface StudioProps {
  onNavActionsChange?: (actions: StudioNavActions | null) => void;
}

function defaultFrames(): Record<SpriteKey, string[]> {
  return Object.fromEntries(FRAME_ORDER.map((k) => [k, [...RAW_SPRITES[k]]])) as Record<SpriteKey, string[]>;
}

function loadFromLS(): Record<SpriteKey, string[]> {
  try {
    const raw = localStorage.getItem('studio_frames');
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<SpriteKey, string[]>>;
      return Object.fromEntries(FRAME_ORDER.map((k) => [k, saved[k] ?? [...RAW_SPRITES[k]]])) as Record<SpriteKey, string[]>;
    }
  } catch {
    /* ignore */
  }
  return defaultFrames();
}

const CODE_BEHAVIOR_CONFIG: PetBehaviorConfig = structuredClone(PET_BEHAVIOR_CONFIG);

function defaultBehaviorConfig(): PetBehaviorConfig {
  return structuredClone(CODE_BEHAVIOR_CONFIG);
}

function syncBehaviorConfigRuntime(config: PetBehaviorConfig): void {
  PET_BEHAVIOR_CONFIG.initialBlinkMin = config.initialBlinkMin;
  PET_BEHAVIOR_CONFIG.initialBlinkMax = config.initialBlinkMax;
  PET_BEHAVIOR_CONFIG.repeatBlinkMin = config.repeatBlinkMin;
  PET_BEHAVIOR_CONFIG.repeatBlinkMax = config.repeatBlinkMax;
  PET_BEHAVIOR_CONFIG.burpResidueTTL = config.burpResidueTTL;
  PET_BEHAVIOR_CONFIG.pooResidueTTL = config.pooResidueTTL;
  PET_BEHAVIOR_CONFIG.day = structuredClone(config.day);
  PET_BEHAVIOR_CONFIG.night = structuredClone(config.night);
}

function mergeWithDefaults(saved: PetBehaviorConfig, defaults: PetBehaviorConfig): PetBehaviorConfig {
  return {
    ...defaults,
    ...saved,
    day: {
      ...defaults.day,
      ...saved.day,
      transitions: { ...defaults.day.transitions, ...saved.day?.transitions },
    },
    night: {
      ...defaults.night,
      ...saved.night,
      transitions: { ...defaults.night.transitions, ...saved.night?.transitions },
    },
  };
}

function loadBehaviorConfigFromLS(): PetBehaviorConfig {
  try {
    const raw = localStorage.getItem('studio_behavior_config');
    if (raw) return mergeWithDefaults(JSON.parse(raw) as PetBehaviorConfig, defaultBehaviorConfig());
  } catch {
    /* ignore */
  }
  return defaultBehaviorConfig();
}

function saveBehaviorConfigToLS(config: PetBehaviorConfig): void {
  localStorage.setItem('studio_behavior_config', JSON.stringify(config));
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function sumChances(period: BehaviorPeriodConfig): number {
  return EDITABLE_BEHAVIORS.reduce((sum, behavior) => sum + (period.transitions[behavior]?.chance ?? 0), 0);
}

export default function Studio({ onNavActionsChange }: StudioProps) {
  const [frames, setFrames] = useState<Record<SpriteKey, string[]>>(loadFromLS);
  const [behaviorConfig, setBehaviorConfig] = useState<PetBehaviorConfig>(loadBehaviorConfigFromLS);
  const [curFrame, setCurFrame] = useState<SpriteKey>('WALK_A');
  const [selColor, setSelColor] = useState('o');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const [iconVal, setIconVal] = useState('0_day');
  const [temp, setTemp] = useState(20);
  const [night, setNight] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [info, setInfo] = useState('');
  const [behavior, setBehavior] = useState('walk');

  const gridRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const painting = useRef(false);

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

  const liveRef = useRef({
    frames,
    iconVal,
    temp,
    night,
    speed,
    behaviorConfig,
  });
  useEffect(() => {
    liveRef.current = { frames, iconVal, temp, night, speed, behaviorConfig };
  }, [frames, iconVal, temp, night, speed, behaviorConfig]);
  useEffect(() => {
    syncBehaviorConfigRuntime(behaviorConfig);
  }, [behaviorConfig]);

  // ---- Draw grid ----
  useEffect(() => {
    const canvas = gridRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rows = frames[curFrame];
    canvas.width = 5 * CELL + 1;
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
    for (let i = 0; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, rows.length * CELL);
      ctx.stroke();
    }
    for (let i = 0; i <= rows.length; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(5 * CELL, i * CELL + 0.5);
      ctx.stroke();
    }
  }, [frames, curFrame]);

  // ---- Preview loop ----
  useEffect(() => {
    if (!offRef.current)
      offRef.current = Object.assign(document.createElement('canvas'), {
        width: 32,
        height: 32,
      });
    const canvas = previewRef.current!;
    const ctx = canvas.getContext('2d')!;
    const octx = offRef.current.getContext('2d')!;

    function loop(ts: number) {
      rafRef.current = requestAnimationFrame(loop);
      const { frames, iconVal, temp, night, speed, behaviorConfig } = liveRef.current;
      const raw = iconVal;
      const snap =
        raw === '0_night'
          ? {
              weatherCode: 0,
              isDay: false,
              temperature: temp,
              fetchedAt: new Date(),
            }
          : {
              weatherCode: Number.parseInt(raw, 10),
              isDay: !night,
              temperature: temp,
              fetchedAt: new Date(),
            };
      const wFrames = renderAnimation(snap);
      if (!wFrames.length) return;

      const f = wFrames[frameIdxRef.current % wFrames.length]!;
      if (ts - lastTsRef.current < f.delayMs / speed) return;
      lastTsRef.current = ts;

      petRef.current.isDay = snap.isDay;
      if (petCtxRef.current.walkBudget === 0 && petRef.current.behavior === 'walk') {
        const period = snap.isDay ? behaviorConfig.day : behaviorConfig.night;
        petCtxRef.current.walkBudget = period.walkBudgetMin;
      }
      advancePet(petRef.current, petCtxRef.current);
      setBehavior(petRef.current.behavior);

      const pixels = new Uint8Array(f.pixels);
      drawPetWithSprites(pixels, petRef.current, frames as Record<SpriteKey, string[]>);

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
  const paintAt = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>, forceErase = false) => {
      const canvas = gridRef.current!;
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor(((e.clientX - rect.left) * (canvas.width / rect.width)) / CELL);
      const row = Math.floor(((e.clientY - rect.top) * (canvas.height / rect.height)) / CELL);
      const color = forceErase ? '.' : selColor;
      setFrames((prev) => {
        const rows = prev[curFrame];
        if (row < 0 || row >= rows.length || col < 0 || col >= 5) return prev;
        const rowArr = [...(rows[row] ?? '')];
        if (rowArr[col] === color) return prev;
        rowArr[col] = color;
        const next = {
          ...prev,
          [curFrame]: rows.map((r, i) => (i === row ? rowArr.join('') : r)),
        };
        localStorage.setItem('studio_frames', JSON.stringify(next));
        return next;
      });
      setSaveStatus('unsaved');
    },
    [curFrame, selColor],
  );

  useEffect(() => {
    const up = () => {
      painting.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ---- Save / reset ----
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const spriteRes = await fetch('/save-sprites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frames),
      });
      if (!spriteRes.ok) throw new Error(await spriteRes.text());
      const configRes = await fetch('/save-pet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(behaviorConfig),
      });
      if (!configRes.ok) throw new Error(await configRes.text());
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }, [frames, behaviorConfig]);

  const handleReset = useCallback(() => {
    if (!confirm('Discard local Studio changes and reload values from code?')) return;
    const d = defaultFrames();
    setFrames(d);
    localStorage.setItem('studio_frames', JSON.stringify(d));
    const config = defaultBehaviorConfig();
    setBehaviorConfig(config);
    saveBehaviorConfigToLS(config);
    setSaveStatus('saved');
  }, []);

  const forceBehavior = useCallback((b: string) => {
    setBehavior(b);
    petRef.current.behavior = b as PetState['behavior'];
    petRef.current.behaviorFrame = 0;
    petCtxRef.current.behaviorDur = BEHAVIOR_DUR[b] ?? 0;
    if (b === 'perch') petRef.current.perchY = PET_Y_WALK;
  }, []);

  const gridRows = frames[curFrame];
  const gridWidth = 5 * CELL + 1;
  const gridHeight = gridRows.length * CELL + 1;
  const dayTotal = sumChances(behaviorConfig.day);
  const nightTotal = sumChances(behaviorConfig.night);

  // ---- Shared input styles ----
  const inp: CSSProperties = {
    background: '#222',
    color: '#ccc',
    border: '1px solid #3a3a3a',
    padding: '3px 5px',
    fontFamily: 'monospace',
    fontSize: 11,
    width: '100%',
  };
  const numInp: CSSProperties = { ...inp, width: 72 };

  const updatePeriod = useCallback((periodKey: 'day' | 'night', updater: (period: BehaviorPeriodConfig) => BehaviorPeriodConfig) => {
    setBehaviorConfig((prev) => {
      const next = { ...prev, [periodKey]: updater(prev[periodKey]) };
      saveBehaviorConfigToLS(next);
      return next;
    });
    setSaveStatus('unsaved');
  }, []);

  const updateChance = useCallback(
    (periodKey: 'day' | 'night', behavior: keyof BehaviorPeriodConfig['transitions'], field: keyof BehaviorChanceConfig, value: number) => {
      updatePeriod(periodKey, (period) => ({
        ...period,
        transitions: {
          ...period.transitions,
          [behavior]: {
            chance: period.transitions[behavior]?.chance ?? 0,
            minDuration: period.transitions[behavior]?.minDuration ?? 0,
            maxDuration: period.transitions[behavior]?.maxDuration ?? 0,
            [field]: field === 'chance' ? Math.max(0, Math.min(1, value)) : Math.max(0, Math.floor(value)),
          },
        },
      }));
    },
    [updatePeriod],
  );

  useEffect(() => {
    onNavActionsChange?.({
      saveStatus,
      onSave: () => {
        void handleSave();
      },
      onDiscard: handleReset,
    });
    return () => onNavActionsChange?.(null);
  }, [onNavActionsChange, saveStatus, handleSave, handleReset]);

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 37px)',
        overflow: 'hidden',
        background: '#101010',
      }}
    >
      {/* ---- Editor panel ---- */}
      <section
        style={{
          width: 372,
          flexShrink: 0,
          borderRight: '1px solid #2a2a2a',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#141414',
        }}
      >
        {/* Frame tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            padding: 6,
            background: '#1a1a1a',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          {FRAME_ORDER.map((name) => (
            <button
              key={name}
              onClick={() => setCurFrame(name)}
              style={{
                padding: '3px 7px',
                fontFamily: 'monospace',
                fontSize: 10,
                background: curFrame === name ? '#1a3a1a' : '#2a2a2a',
                border: `1px solid ${curFrame === name ? '#4a8' : '#3a3a3a'}`,
                color: curFrame === name ? '#8f8' : '#888',
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Grid canvas */}
        <div
          style={{
            flex: 1,
            padding: 16,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            overflow: 'auto',
          }}
        >
          <canvas
            ref={gridRef}
            style={{
              cursor: 'crosshair',
              imageRendering: 'pixelated',
              width: gridWidth,
              height: gridHeight,
              flex: '0 0 auto',
              border: '1px solid #2a2a2a',
              background: '#0d0d0d',
              boxShadow: '0 0 0 1px #000 inset',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              painting.current = true;
              paintAt(e, e.button === 2);
            }}
            onMouseMove={(e) => {
              if (painting.current) paintAt(e, e.button === 2);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              paintAt(e, true);
            }}
          />
        </div>

        {/* Palette */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 12px',
            flexWrap: 'wrap',
            borderTop: '1px solid #2a2a2a',
          }}
        >
          {PALETTE_KEYS.map((k) => (
            <div
              key={k}
              onClick={() => setSelColor(k)}
              title={k === '.' ? 'erase' : k}
              style={{
                width: 36,
                height: 36,
                background: COLOR_CSS[k],
                cursor: 'pointer',
                border: `2px solid ${selColor === k ? '#fff' : '#444'}`,
                boxShadow: selColor === k ? '0 0 0 2px #fff4' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 'bold',
                color: 'rgba(0,0,0,0.7)',
              }}
            >
              {k === '.' ? '✕' : k}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #2a2a2a',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        />
      </section>

      {/* ---- Preview panel ---- */}
      <section
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          overflow: 'auto',
          background: 'radial-gradient(circle at top, #1c1c1c 0%, #101010 65%)',
        }}
      >
        <div
          style={{
            width: 'min(100%, 720px)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 0 4px',
            }}
          >
            <div
              style={{
                padding: 18,
                border: '1px solid #2a2a2a',
                background: '#151515',
                boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
              }}
            >
              <canvas
                ref={previewRef}
                width={32 * SCALE}
                height={32 * SCALE}
                style={{
                  display: 'block',
                  imageRendering: 'pixelated',
                  border: '1px solid #333',
                  background: '#0d0d0d',
                }}
              />
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: '#666',
              minHeight: 14,
            }}
          >
            {info}
          </div>

          {/* Controls */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            <div
              style={{
                padding: 14,
                border: '1px solid #2a2a2a',
                background: '#141414',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <h2 style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>WEATHER</h2>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  fontSize: 10,
                  color: '#666',
                }}
              >
                Icon
                <select value={iconVal} onChange={(e) => setIconVal(e.target.value)} style={inp}>
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
                  gap: 3,
                  fontSize: 10,
                  color: '#666',
                }}
              >
                Temp °C
                <input type="number" value={temp} min={-30} max={50} style={inp} onChange={(e) => setTemp(Number(e.target.value))} />
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                  color: '#666',
                }}
              >
                Night <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} />
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  fontSize: 10,
                  color: '#666',
                }}
              >
                Speed ×{speed.toFixed(2)}
                <input type="range" min={0.25} max={4} step={0.25} value={speed} style={inp} onChange={(e) => setSpeed(Number(e.target.value))} />
              </label>
            </div>

            <div
              style={{
                padding: 14,
                border: '1px solid #2a2a2a',
                background: '#141414',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <h2 style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>PET BEHAVIOR</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.keys(BEHAVIOR_DUR).map((b) => (
                  <button
                    key={b}
                    onClick={() => forceBehavior(b)}
                    style={{
                      padding: '4px 8px',
                      fontFamily: 'monospace',
                      fontSize: 10,
                      background: behavior === b ? '#1a3a1a' : '#2a2a2a',
                      color: behavior === b ? '#8f8' : '#bbb',
                      border: `1px solid ${behavior === b ? '#4a8' : '#3a3a3a'}`,
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 10,
                  color: '#666',
                }}
              >
                <span title="How many animation ticks the green burp residue stays on the floor before fading out completely." style={{ cursor: 'help' }}>
                  Burp residue TTL
                </span>
                <input
                  type="number"
                  min={0}
                  value={behaviorConfig.burpResidueTTL}
                  style={numInp}
                  onChange={(e) => {
                    setBehaviorConfig((prev) => {
                      const next = {
                        ...prev,
                        burpResidueTTL: Math.max(0, Math.floor(Number(e.target.value))),
                      };
                      saveBehaviorConfigToLS(next);
                      return next;
                    });
                    setSaveStatus('unsaved');
                  }}
                />
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 10,
                  color: '#666',
                }}
              >
                <span title="How many animation ticks the brown poo residue stays on the floor before fading out completely." style={{ cursor: 'help' }}>
                  Poo residue TTL
                </span>
                <input
                  type="number"
                  min={0}
                  value={behaviorConfig.pooResidueTTL}
                  style={numInp}
                  onChange={(e) => {
                    setBehaviorConfig((prev) => {
                      const next = {
                        ...prev,
                        pooResidueTTL: Math.max(0, Math.floor(Number(e.target.value))),
                      };
                      saveBehaviorConfigToLS(next);
                      return next;
                    });
                    setSaveStatus('unsaved');
                  }}
                />
              </label>
            </div>

            {(['day', 'night'] as const).map((periodKey) => {
              const period = behaviorConfig[periodKey];
              const total = periodKey === 'day' ? dayTotal : nightTotal;
              return (
                <div
                  key={periodKey}
                  style={{
                    padding: 14,
                    border: '1px solid #2a2a2a',
                    background: '#141414',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 8,
                    }}
                  >
                    <h2
                      title="Each roll decides whether the pet keeps walking or switches to one of these behaviors. Chance is the probability; min and max are duration bounds in animation ticks."
                      style={{
                        fontSize: 10,
                        color: '#555',
                        letterSpacing: 1,
                        cursor: 'help',
                      }}
                    >
                      {periodKey.toUpperCase()} ROLLS
                    </h2>
                    <span
                      style={{
                        fontSize: 10,
                        color: total > 1 ? '#d77' : '#777',
                      }}
                    >
                      total {percent(total)} · walk {percent(Math.max(0, 1 - total))}
                    </span>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 10,
                      color: '#666',
                    }}
                  >
                    <span title="Randomized number of walking ticks before the pet makes the next behavior roll." style={{ cursor: 'help' }}>
                      Walk budget
                    </span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        min={0}
                        value={period.walkBudgetMin}
                        style={numInp}
                        onChange={(e) =>
                          updatePeriod(periodKey, (prev) => ({
                            ...prev,
                            walkBudgetMin: Math.max(0, Number(e.target.value)),
                          }))
                        }
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min={0}
                        value={period.walkBudgetMax}
                        style={numInp}
                        onChange={(e) =>
                          updatePeriod(periodKey, (prev) => ({
                            ...prev,
                            walkBudgetMax: Math.max(0, Number(e.target.value)),
                          }))
                        }
                      />
                    </span>
                  </label>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '64px minmax(0, 1fr) 56px 56px',
                      gap: 6,
                      alignItems: 'center',
                      fontSize: 9,
                      color: '#666',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}
                  >
                    <span>Mode</span>
                    <span title="Probability that this behavior will be chosen when a day/night behavior roll happens.">Chance</span>
                    <span title="Minimum duration for this behavior, in animation ticks." style={{ textAlign: 'right', cursor: 'help' }}>
                      Min
                    </span>
                    <span title="Maximum duration for this behavior, in animation ticks." style={{ textAlign: 'right', cursor: 'help' }}>
                      Max
                    </span>
                  </div>

                  {EDITABLE_BEHAVIORS.map((behaviorKey) => {
                    const entry = period.transitions[behaviorKey]!;
                    return (
                      <div
                        key={behaviorKey}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '64px minmax(0, 1fr) 56px 56px',
                          gap: 6,
                          alignItems: 'center',
                          fontSize: 10,
                          color: '#777',
                        }}
                      >
                        <span title={`Behavior: ${behaviorKey}`} style={{ color: '#999' }}>
                          {behaviorKey}
                        </span>
                        <label
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) 38px',
                            alignItems: 'center',
                            gap: 6,
                            minWidth: 0,
                          }}
                        >
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(entry.chance * 100)}
                            style={{ width: '100%', minWidth: 0 }}
                            title={`Chance for ${behaviorKey}: ${percent(entry.chance)}`}
                            onChange={(e) => updateChance(periodKey, behaviorKey, 'chance', Number(e.target.value) / 100)}
                          />
                          <span style={{ width: 36, textAlign: 'right' }}>{percent(entry.chance)}</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={entry.minDuration}
                          style={{ ...numInp, width: '100%', minWidth: 0 }}
                          title={`Minimum ${behaviorKey} duration in animation ticks.`}
                          onChange={(e) => updateChance(periodKey, behaviorKey, 'minDuration', Number(e.target.value))}
                        />
                        <input
                          type="number"
                          min={0}
                          value={entry.maxDuration}
                          style={{ ...numInp, width: '100%', minWidth: 0 }}
                          title={`Maximum ${behaviorKey} duration in animation ticks.`}
                          onChange={(e) => updateChance(periodKey, behaviorKey, 'maxDuration', Number(e.target.value))}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
