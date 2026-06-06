import type { Swatch } from '@src/customization/schema';
import { EDITABLE_BEHAVIORS, PET_BEHAVIOR_CONFIG, type BehaviorChanceConfig, type BehaviorPeriodConfig, type PetBehaviorConfig } from '@src/pet/config';
import { setActiveCustomization } from '@src/render/pet/active';
import type { RawPetSprites } from '@src/render/pet/types';
import { RAW_SPRITES, type SpriteKey } from '@src/sprites';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useCustomization } from '../useCustomization';
import PaletteEditor from './PaletteEditor';

// ---- constants ----
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

const CELL = 48;

const CODE_BEHAVIOR_CONFIG: PetBehaviorConfig = structuredClone(PET_BEHAVIOR_CONFIG);

function defaultFrames(): Record<SpriteKey, string[]> {
  return Object.fromEntries(FRAME_ORDER.map((k) => [k, [...RAW_SPRITES[k]]])) as Record<SpriteKey, string[]>;
}

function defaultBehaviorConfig(): PetBehaviorConfig {
  return structuredClone(CODE_BEHAVIOR_CONFIG);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function sumChances(period: BehaviorPeriodConfig): number {
  return EDITABLE_BEHAVIORS.reduce((sum, behavior) => sum + (period.transitions[behavior]?.chance ?? 0), 0);
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export interface StudioNavActions {
  saveStatus: SaveStatus;
  onSave: () => void;
  onDiscard: () => void;
}

interface StudioProps {
  onNavActionsChange?: (actions: StudioNavActions | null) => void;
  onDraftChange?: (draft: { frames: Record<SpriteKey, string[]>; palette: Swatch[]; behaviorConfig: PetBehaviorConfig }) => void;
}

// User's local edits layered on top of the server customization.
// Empty = use server state as-is. Cleared after save/reset.
interface Draft {
  frames?: Record<SpriteKey, string[]>;
  behaviorConfig?: PetBehaviorConfig;
  palette?: Swatch[];
}

export default function Studio({ onNavActionsChange, onDraftChange }: StudioProps) {
  const { customization, saveStatus, markUnsaved, save, reset } = useCustomization();

  // Draft tracks unsaved edits; initialised from server customization during first render.
  // No useEffect needed — computed values are derived directly in render.
  const [draft, setDraft] = useState<Draft>({});

  const initialized = customization !== null;
  const frames = useMemo<Record<SpriteKey, string[]>>(
    () => draft.frames ?? (customization?.sprites as Record<SpriteKey, string[]>) ?? defaultFrames(),
    [draft.frames, customization],
  );
  const behaviorConfig = useMemo<PetBehaviorConfig>(
    () => draft.behaviorConfig ?? customization?.behavior ?? defaultBehaviorConfig(),
    [draft.behaviorConfig, customization],
  );
  const palette = useMemo<Swatch[]>(() => draft.palette ?? customization?.palette ?? [], [draft.palette, customization]);

  const [curFrame, setCurFrame] = useState<SpriteKey>('WALK_A');
  const [selColor, setSelColor] = useState('o');

  const gridRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);

  // Build CSS color map from live palette
  const colorCss = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { '.': '#111' };
    for (const swatch of palette) {
      const [r, g, b] = swatch.day;
      map[swatch.key] = `rgb(${r},${g},${b})`;
    }
    return map;
  }, [palette]);

  // Keep browser-side renderer in sync with editable state so PreviewStage's rAF loop renders the draft.
  // setActiveCustomization updates colors/sprites; PET_BEHAVIOR_CONFIG mutation keeps advancePet in sync.
  useEffect(() => {
    if (!initialized) return;
    setActiveCustomization({
      schemaVersion: 1,
      palette,
      sprites: frames as RawPetSprites,
      behavior: behaviorConfig,
    });
    // advancePet reads PET_BEHAVIOR_CONFIG directly (module-level), so we must mirror edits
    PET_BEHAVIOR_CONFIG.initialBlinkMin = behaviorConfig.initialBlinkMin;
    PET_BEHAVIOR_CONFIG.initialBlinkMax = behaviorConfig.initialBlinkMax;
    PET_BEHAVIOR_CONFIG.repeatBlinkMin = behaviorConfig.repeatBlinkMin;
    PET_BEHAVIOR_CONFIG.repeatBlinkMax = behaviorConfig.repeatBlinkMax;
    PET_BEHAVIOR_CONFIG.burpResidueTTL = behaviorConfig.burpResidueTTL;
    PET_BEHAVIOR_CONFIG.pooResidueTTL = behaviorConfig.pooResidueTTL;
    PET_BEHAVIOR_CONFIG.day = structuredClone(behaviorConfig.day);
    PET_BEHAVIOR_CONFIG.night = structuredClone(behaviorConfig.night);
  }, [palette, frames, behaviorConfig, initialized]);

  // Notify parent of draft changes so the shared PreviewStage can reflect unsaved edits.
  useEffect(() => {
    onDraftChange?.({ frames, palette, behaviorConfig });
  }, [frames, palette, behaviorConfig, onDraftChange]);

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
        ctx.fillStyle = colorCss[ch] ?? '#111';
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
  }, [frames, curFrame, colorCss]);

  // ---- Painting ----
  // `frames` is in deps so we always close over the latest grid state
  const paintAt = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>, forceErase = false) => {
      const canvas = gridRef.current!;
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor(((e.clientX - rect.left) * (canvas.width / rect.width)) / CELL);
      const row = Math.floor(((e.clientY - rect.top) * (canvas.height / rect.height)) / CELL);
      const color = forceErase ? '.' : selColor;
      const rows = frames[curFrame];
      if (row < 0 || row >= rows.length || col < 0 || col >= 5) return;
      const rowArr = [...(rows[row] ?? '')];
      if (rowArr[col] === color) return;
      rowArr[col] = color;
      const newFrames = { ...frames, [curFrame]: rows.map((r, i) => (i === row ? rowArr.join('') : r)) };
      setDraft((d) => ({ ...d, frames: newFrames }));
      markUnsaved();
    },
    [curFrame, selColor, markUnsaved, frames],
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
    const saved = await save({ sprites: frames as RawPetSprites, behavior: behaviorConfig, palette });
    if (saved) setDraft({});
  }, [frames, behaviorConfig, palette, save]);

  const handleReset = useCallback(async () => {
    if (!confirm('Reset to defaults from server? All unsaved Studio changes will be lost.')) return;
    const defaults = await reset();
    if (defaults) setDraft({});
  }, [reset]);

  const gridRows = frames[curFrame];
  const gridWidth = 5 * CELL + 1;
  const gridHeight = gridRows.length * CELL + 1;
  const dayTotal = sumChances(behaviorConfig.day);
  const nightTotal = sumChances(behaviorConfig.night);

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

  // `behaviorConfig` in deps so the functional update captures the latest value
  const updatePeriod = useCallback(
    (periodKey: 'day' | 'night', updater: (period: BehaviorPeriodConfig) => BehaviorPeriodConfig) => {
      setDraft((d) => {
        const prev = d.behaviorConfig ?? behaviorConfig;
        return { ...d, behaviorConfig: { ...prev, [periodKey]: updater(prev[periodKey]) } };
      });
      markUnsaved();
    },
    [markUnsaved, behaviorConfig],
  );

  const updateChance = useCallback(
    (periodKey: 'day' | 'night', beh: keyof BehaviorPeriodConfig['transitions'], field: keyof BehaviorChanceConfig, value: number) => {
      updatePeriod(periodKey, (period) => ({
        ...period,
        transitions: {
          ...period.transitions,
          [beh]: {
            chance: period.transitions[beh]?.chance ?? 0,
            minDuration: period.transitions[beh]?.minDuration ?? 0,
            maxDuration: period.transitions[beh]?.maxDuration ?? 0,
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
      onDiscard: () => {
        void handleReset();
      },
    });
    return () => onNavActionsChange?.(null);
  }, [onNavActionsChange, saveStatus, handleSave, handleReset]);

  if (!initialized) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#101010',
          color: '#555',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        Loading customization…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#101010' }}>
      {/* ---- Sprite editor panel ---- */}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 6, background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}>
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
        <div style={{ flex: 1, padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'auto' }}>
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

        {/* Palette toolbar */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap', borderTop: '1px solid #2a2a2a' }}>
          {palette.map((swatch) => {
            const css = colorCss[swatch.key] ?? '#111';
            return (
              <div
                key={swatch.key}
                onClick={() => setSelColor(swatch.key)}
                title={swatch.key}
                style={{
                  width: 36,
                  height: 36,
                  background: css,
                  cursor: 'pointer',
                  border: `2px solid ${selColor === swatch.key ? '#fff' : '#444'}`,
                  boxShadow: selColor === swatch.key ? '0 0 0 2px #fff4' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: 'rgba(0,0,0,0.7)',
                }}
              >
                {swatch.key}
              </div>
            );
          })}
          <div
            onClick={() => setSelColor('.')}
            title="erase"
            style={{
              width: 36,
              height: 36,
              background: '#111',
              cursor: 'pointer',
              border: `2px solid ${selColor === '.' ? '#fff' : '#444'}`,
              boxShadow: selColor === '.' ? '0 0 0 2px #fff4' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 'bold',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            ✕
          </div>
        </div>

        <div style={{ padding: '8px 12px', borderTop: '1px solid #2a2a2a' }} />
      </section>

      {/* ---- Customization controls panel ---- */}
      <section
        style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'auto', background: 'radial-gradient(circle at top, #1c1c1c 0%, #101010 65%)' }}
      >
        <div style={{ width: 'min(100%, 720px)', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* Palette editor */}
            <div style={{ padding: 14, border: '1px solid #2a2a2a', background: '#141414', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>PALETTE</h2>
              <PaletteEditor
                palette={palette}
                sprites={frames}
                onChange={(p) => {
                  setDraft((d) => ({ ...d, palette: p }));
                  markUnsaved();
                }}
              />
            </div>

            {/* Pet behavior config */}
            <div style={{ padding: 14, border: '1px solid #2a2a2a', background: '#141414', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>PET BEHAVIOR</h2>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 10, color: '#666' }}>
                <span title="How many animation ticks the green burp residue stays on the floor before fading out completely." style={{ cursor: 'help' }}>
                  Burp residue TTL
                </span>
                <input
                  type="number"
                  min={0}
                  value={behaviorConfig.burpResidueTTL}
                  style={numInp}
                  onChange={(e) => {
                    setDraft((d) => {
                      const prev = d.behaviorConfig ?? behaviorConfig;
                      return { ...d, behaviorConfig: { ...prev, burpResidueTTL: Math.max(0, Math.floor(Number(e.target.value))) } };
                    });
                    markUnsaved();
                  }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 10, color: '#666' }}>
                <span title="How many animation ticks the brown poo residue stays on the floor before fading out completely." style={{ cursor: 'help' }}>
                  Poo residue TTL
                </span>
                <input
                  type="number"
                  min={0}
                  value={behaviorConfig.pooResidueTTL}
                  style={numInp}
                  onChange={(e) => {
                    setDraft((d) => {
                      const prev = d.behaviorConfig ?? behaviorConfig;
                      return { ...d, behaviorConfig: { ...prev, pooResidueTTL: Math.max(0, Math.floor(Number(e.target.value))) } };
                    });
                    markUnsaved();
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
                  style={{ padding: 14, border: '1px solid #2a2a2a', background: '#141414', display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <h2
                      title="Each roll decides whether the pet keeps walking or switches to one of these behaviors."
                      style={{ fontSize: 10, color: '#555', letterSpacing: 1, cursor: 'help' }}
                    >
                      {periodKey.toUpperCase()} ROLLS
                    </h2>
                    <span style={{ fontSize: 10, color: total > 1 ? '#d77' : '#777' }}>
                      total {percent(total)} · walk {percent(Math.max(0, 1 - total))}
                    </span>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 10, color: '#666' }}>
                    <span title="Randomized number of walking ticks before the pet makes the next behavior roll." style={{ cursor: 'help' }}>
                      Walk budget
                    </span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        min={0}
                        value={period.walkBudgetMin}
                        style={numInp}
                        onChange={(e) => updatePeriod(periodKey, (prev) => ({ ...prev, walkBudgetMin: Math.max(0, Number(e.target.value)) }))}
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min={0}
                        value={period.walkBudgetMax}
                        style={numInp}
                        onChange={(e) => updatePeriod(periodKey, (prev) => ({ ...prev, walkBudgetMax: Math.max(0, Number(e.target.value)) }))}
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
                    <span title="Probability that this behavior will be chosen when a roll happens.">Chance</span>
                    <span title="Minimum duration in ticks." style={{ textAlign: 'right', cursor: 'help' }}>
                      Min
                    </span>
                    <span title="Maximum duration in ticks." style={{ textAlign: 'right', cursor: 'help' }}>
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
                        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 38px', alignItems: 'center', gap: 6, minWidth: 0 }}>
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
                          title={`Minimum ${behaviorKey} duration in ticks.`}
                          onChange={(e) => updateChance(periodKey, behaviorKey, 'minDuration', Number(e.target.value))}
                        />
                        <input
                          type="number"
                          min={0}
                          value={entry.maxDuration}
                          style={{ ...numInp, width: '100%', minWidth: 0 }}
                          title={`Maximum ${behaviorKey} duration in ticks.`}
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
