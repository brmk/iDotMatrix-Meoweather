export const W = 32;
export const H = 32;

export function mkBuf(): Uint8Array {
  return new Uint8Array(W * H * 3);
}

export function set(buf: Uint8Array, x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
}

export function fillCircle(buf: Uint8Array, cx: number, cy: number, rad: number, r: number, g: number, b: number): void {
  const r2 = rad * rad;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy <= r2) set(buf, cx + dx, cy + dy, r, g, b);
    }
  }
}

export function fillRect(buf: Uint8Array, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      set(buf, x, y, r, g, b);
    }
  }
}
