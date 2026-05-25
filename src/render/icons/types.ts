export const ICON_TYPES = ['clear-day', 'clear-night', 'partly-cloudy', 'cloudy', 'fog', 'rain', 'heavy-rain', 'snow', 'thunder'] as const;

export type IconType = (typeof ICON_TYPES)[number];

export interface IconDef {
  count: number;
  delayMs: number;
  draw(buf: Uint8Array, frame: number): void;
}

export interface IconAnimationMeta {
  count: number;
  delayMs: number;
}
