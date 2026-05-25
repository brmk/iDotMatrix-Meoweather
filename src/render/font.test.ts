import { describe, expect, it } from 'vitest';
import { DISPLAY_WIDTH, RGB_CHANNELS, mkBuf } from './canvas.js';
import { drawText } from './font.js';

function findColoredXs(buf: Uint8Array): number[] {
  const xs = new Set<number>();
  for (let i = 0; i < buf.length; i += RGB_CHANNELS) {
    if ((buf[i] ?? 0) === 0 && (buf[i + 1] ?? 0) === 0 && (buf[i + 2] ?? 0) === 0) continue;
    xs.add((i / RGB_CHANNELS) % DISPLAY_WIDTH);
  }
  return [...xs].sort((a, b) => a - b);
}

describe('render/font', () => {
  it('centers a single glyph using shared display width', () => {
    const buf = mkBuf();
    drawText(buf, '1', 0, [255, 255, 255]);

    expect(findColoredXs(buf)).toEqual([14, 15, 16]);
  });

  it('adds one blank column between centered glyphs', () => {
    const buf = mkBuf();
    drawText(buf, '11', 0, [255, 255, 255]);

    expect(findColoredXs(buf)).toEqual([12, 13, 14, 16, 17, 18]);
  });

  it('preserves glyph spacing for unsupported characters', () => {
    const buf = mkBuf();
    drawText(buf, '?1', 0, [255, 255, 255]);

    expect(findColoredXs(buf)).toEqual([16, 17, 18]);
  });
});
