import { DISPLAY_WIDTH, set } from './canvas.js';
import type { Color } from './types.js';

const FONT: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b110, 0b010, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b001, 0b001],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
  '°': [0b110, 0b110, 0b000, 0b000, 0b000],
  C: [0b111, 0b100, 0b100, 0b100, 0b111],
};

const GLYPH_WIDTH = 3;
const GLYPH_SPACING = 1;

function drawChar(buf: Uint8Array, ch: string, x: number, y: number, color: Color): void {
  const glyph = FONT[ch];
  if (!glyph) return;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < GLYPH_WIDTH; col++) {
      if (glyph[row]! & (0b100 >> col)) set(buf, x + col, y + row, color);
    }
  }
}

export function drawText(buf: Uint8Array, text: string, y: number, color: Color): void {
  const totalW = text.length * (GLYPH_WIDTH + GLYPH_SPACING) - GLYPH_SPACING;
  let x = Math.floor((DISPLAY_WIDTH - totalW) / 2);
  for (const ch of text) {
    drawChar(buf, ch, x, y, color);
    x += GLYPH_WIDTH + GLYPH_SPACING;
  }
}
