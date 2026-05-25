import { RGB_CHANNELS } from '../canvas.js';

export function applyNightTint(buf: Uint8Array): void {
  for (let i = 0; i < buf.length; i += RGB_CHANNELS) {
    buf[i + 1] = Math.round((buf[i + 1] ?? 0) * 0.85);
    buf[i + 2] = Math.round((buf[i + 2] ?? 0) * 0.45);
  }
}
