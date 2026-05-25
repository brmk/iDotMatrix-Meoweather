import { GLYPH_SPACING, GLYPH_WIDTH } from './glyphs.js';

export function measureText(text: string): number {
  if (text.length === 0) return 0;
  return text.length * (GLYPH_WIDTH + GLYPH_SPACING) - GLYPH_SPACING;
}
