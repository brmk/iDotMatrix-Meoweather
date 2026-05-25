export type Color = readonly [red: number, green: number, blue: number];

export interface AnimationFrame {
  pixels: Uint8Array;
  delayMs: number;
}
