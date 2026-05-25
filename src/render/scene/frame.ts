import type { WeatherSnapshot } from '../../weather/index.js';
import { mkBuf } from '../canvas.js';
import { WHITE } from '../colors.js';
import { drawText } from '../font.js';
import { ANIM, codeToIcon, drawAnimatedIcon, type IconType } from '../icons.js';
import type { AnimationFrame } from '../types.js';
import { formatTemperature } from './format.js';
import { applyNightTint } from './tint.js';

const TEMPERATURE_Y = 21;

export interface SceneDescriptor {
  icon: IconType;
  temperatureText: string;
  isDay: boolean;
}

export function describeScene(snapshot: WeatherSnapshot): SceneDescriptor {
  return {
    icon: codeToIcon(snapshot.weatherCode, snapshot.isDay),
    temperatureText: formatTemperature(snapshot.temperature),
    isDay: snapshot.isDay,
  };
}

export function renderFrame(scene: SceneDescriptor, frame: number): Uint8Array {
  const buf = mkBuf();
  drawAnimatedIcon(buf, scene.icon, frame);
  drawText(buf, scene.temperatureText, TEMPERATURE_Y, WHITE);
  if (!scene.isDay) applyNightTint(buf);
  return buf;
}

export function renderAnimationFrames(snapshot: WeatherSnapshot): AnimationFrame[] {
  const scene = describeScene(snapshot);
  const { count, delayMs } = ANIM[scene.icon];

  return Array.from({ length: count }, (_, frame) => ({
    pixels: renderFrame(scene, frame),
    delayMs,
  }));
}
