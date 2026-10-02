import type { Swatch } from '@src/customization/schema';
import { NIGHT_FACTOR } from '@src/render/pet/palette';
import type { Color } from '@src/render/types';
import type { SpriteKey } from '@src/sprites';
import type { CSSProperties } from 'react';

const RESERVED_ROLES = new Set(['o', 'g', 's', 'l', 'r']);
const ALL_CHARS = 'abcdefghijklmnopqrstuvwxyz';

function colorToHex([r, g, b]: Color): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToColor(hex: string): Color {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function autoNight([r, g, b]: Color): Color {
  return [Math.round(r * NIGHT_FACTOR), Math.round(g * NIGHT_FACTOR), Math.round(b * NIGHT_FACTOR)];
}

function isUsedInSprites(key: string, sprites: Record<string, string[]>): boolean {
  for (const rows of Object.values(sprites)) {
    for (const row of rows) {
      if (row.includes(key)) return true;
    }
  }
  return false;
}

function nextFreeChar(usedKeys: Set<string>): string | null {
  for (const ch of ALL_CHARS) {
    if (!RESERVED_ROLES.has(ch) && !usedKeys.has(ch)) return ch;
  }
  return null;
}

export interface PaletteEditorProps {
  palette: Swatch[];
  sprites: Record<SpriteKey, string[]>;
  onChange: (palette: Swatch[]) => void;
}

const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px 1fr 1fr auto',
  gap: 6,
  alignItems: 'center',
  fontSize: 10,
  color: '#888',
  padding: '3px 0',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontSize: 9,
  color: '#666',
};

const colorInput: CSSProperties = { width: '100%', height: 22, padding: 1, border: '1px solid #3a3a3a', background: '#111', cursor: 'pointer' };

const btn: CSSProperties = {
  padding: '2px 6px',
  fontFamily: 'monospace',
  fontSize: 9,
  background: '#2a2a2a',
  border: '1px solid #3a3a3a',
  color: '#888',
  cursor: 'pointer',
};

const keyChip: CSSProperties = {
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'monospace',
  fontSize: 11,
  fontWeight: 'bold',
  border: '1px solid #3a3a3a',
};

export default function PaletteEditor({ palette, sprites, onChange }: PaletteEditorProps) {
  const usedKeys = new Set(palette.map((s) => s.key));

  function updateSwatch(key: string, patch: Partial<Swatch>) {
    onChange(palette.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSwatch(key: string) {
    if (RESERVED_ROLES.has(key)) return;
    if (isUsedInSprites(key, sprites as Record<string, string[]>)) {
      alert(`Color '${key}' is used in sprites. Clear those cells first.`);
      return;
    }
    onChange(palette.filter((s) => s.key !== key));
  }

  function addSwatch() {
    const ch = nextFreeChar(usedKeys);
    if (!ch) {
      alert('No free character available (a–z all used).');
      return;
    }
    const newSwatch: Swatch = { key: ch, day: [80, 80, 200] };
    onChange([...palette, newSwatch]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 1fr auto',
          gap: 6,
          fontSize: 9,
          color: '#555',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          padding: '2px 0 4px',
        }}
      >
        <span>Key</span>
        <span>Day</span>
        <span>Night</span>
        <span />
      </div>

      {palette.map((swatch) => {
        const isReserved = RESERVED_ROLES.has(swatch.key);
        const nightHex = swatch.night ? colorToHex(swatch.night) : null;
        const autoNightHex = colorToHex(autoNight(swatch.day));
        const [r, g, b] = swatch.day;

        return (
          <div key={swatch.key} style={row}>
            <div style={{ ...keyChip, background: `rgb(${r},${g},${b})`, color: 'rgba(0,0,0,0.6)' }}>
              {swatch.key}
              {isReserved && (
                <span title="reserved role" style={{ fontSize: 7, marginLeft: 1 }}>
                  🔒
                </span>
              )}
            </div>

            <label style={labelStyle}>
              <input
                type="color"
                value={colorToHex(swatch.day)}
                style={colorInput}
                onChange={(e) => updateSwatch(swatch.key, { day: hexToColor(e.target.value) })}
              />
            </label>

            <label style={labelStyle}>
              {nightHex !== null ? (
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={nightHex}
                    style={{ ...colorInput, flex: 1 }}
                    onChange={(e) => updateSwatch(swatch.key, { night: hexToColor(e.target.value) })}
                  />
                  <button
                    style={{ ...btn, fontSize: 8, padding: '1px 4px' }}
                    title="Switch to auto-darken night"
                    onClick={() => updateSwatch(swatch.key, { night: undefined })}
                  >
                    auto
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <div
                    style={{
                      flex: 1,
                      height: 22,
                      background: autoNightHex,
                      border: '1px dashed #3a3a3a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      color: '#666',
                    }}
                    title={`Auto-darkened: ${autoNightHex}`}
                  >
                    auto
                  </div>
                  <button
                    style={{ ...btn, fontSize: 8, padding: '1px 4px' }}
                    title="Set a manual night color"
                    onClick={() => updateSwatch(swatch.key, { night: autoNight(swatch.day) })}
                  >
                    pin
                  </button>
                </div>
              )}
            </label>

            {isReserved ? (
              <span style={{ fontSize: 8, color: '#444', width: 36, textAlign: 'center' }}>locked</span>
            ) : (
              <button style={{ ...btn, color: '#a44' }} title={`Remove swatch '${swatch.key}'`} onClick={() => removeSwatch(swatch.key)}>
                ✕
              </button>
            )}
          </div>
        );
      })}

      <button style={{ ...btn, marginTop: 6, padding: '4px 10px', color: '#6a8', borderColor: '#3a5a3a' }} onClick={addSwatch}>
        + Add color
      </button>
    </div>
  );
}
