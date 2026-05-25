import { set } from './canvas.js';

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

function drawChar(buf: Uint8Array, ch: string, x: number, y: number, r: number, g: number, b: number): void {
  const glyph = FONT[ch];
  if (!glyph) return;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (glyph[row]! & (0b100 >> col)) set(buf, x + col, y + row, r, g, b);
    }
  }
}

export function drawText(buf: Uint8Array, text: string, y: number, r: number, g: number, b: number): void {
  const totalW = text.length * 4 - 1;
  let x = Math.floor((32 - totalW) / 2);
  for (const ch of text) {
    drawChar(buf, ch, x, y, r, g, b);
    x += 4;
  }
}
