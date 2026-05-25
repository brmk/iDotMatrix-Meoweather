import { DISPLAY_WIDTH, set } from '../canvas.js';
import type { Color } from '../types.js';
import { GLYPHS, GLYPH_HEIGHT, GLYPH_SPACING, GLYPH_WIDTH } from './glyphs.js';
import { measureText } from './measure.js';

function drawGlyph(buf: Uint8Array, glyphKey: string, x: number, y: number, color: Color): void {
  const glyph = GLYPHS[glyphKey];
  if (!glyph) return;

  for (let row = 0; row < GLYPH_HEIGHT; row++) {
    for (let col = 0; col < GLYPH_WIDTH; col++) {
      if (glyph[row]! & (0b100 >> col)) set(buf, x + col, y + row, color);
    }
  }
}

export function drawTextAt(buf: Uint8Array, text: string, x: number, y: number, color: Color): void {
  let cursorX = x;
  for (const ch of text) {
    drawGlyph(buf, ch, cursorX, y, color);
    cursorX += GLYPH_WIDTH + GLYPH_SPACING;
  }
}

export function drawCenteredText(buf: Uint8Array, text: string, y: number, color: Color): void {
  const x = Math.floor((DISPLAY_WIDTH - measureText(text)) / 2);
  drawTextAt(buf, text, x, y, color);
}

export function drawText(buf: Uint8Array, text: string, y: number, color: Color): void {
  drawCenteredText(buf, text, y, color);
}
