import { describe, expect, it } from 'vitest';
import { DISPLAY_WIDTH, RGB_CHANNELS, mkBuf } from './canvas.js';
import { drawCenteredText, drawTextAt } from './text/draw.js';
import { measureText } from './text/measure.js';

function findColoredXs(buf: Uint8Array): number[] {
  const xs = new Set<number>();
  for (let i = 0; i < buf.length; i += RGB_CHANNELS) {
    if ((buf[i] ?? 0) === 0 && (buf[i + 1] ?? 0) === 0 && (buf[i + 2] ?? 0) === 0) continue;
    xs.add((i / RGB_CHANNELS) % DISPLAY_WIDTH);
  }
  return [...xs].sort((a, b) => a - b);
}

describe('render/font', () => {
  it('measures text width with fixed glyph spacing', () => {
    expect(measureText('')).toBe(0);
    expect(measureText('1')).toBe(3);
    expect(measureText('11')).toBe(7);
    expect(measureText('?1')).toBe(7);
  });

  it('draws text at an explicit x position', () => {
    const buf = mkBuf();
    drawTextAt(buf, '1', 2, 0, [255, 255, 255]);

    expect(findColoredXs(buf)).toEqual([2, 3, 4]);
  });

  it('centers a single glyph using shared display width', () => {
    const buf = mkBuf();
    drawCenteredText(buf, '1', 0, [255, 255, 255]);

    expect(findColoredXs(buf)).toEqual([14, 15, 16]);
  });

  it('adds one blank column between centered glyphs', () => {
    const buf = mkBuf();
    drawCenteredText(buf, '11', 0, [255, 255, 255]);

    expect(findColoredXs(buf)).toEqual([12, 13, 14, 16, 17, 18]);
  });

  it('preserves glyph spacing for unsupported characters', () => {
    const buf = mkBuf();
    drawCenteredText(buf, '?1', 0, [255, 255, 255]);

    expect(findColoredXs(buf)).toEqual([16, 17, 18]);
  });
});
