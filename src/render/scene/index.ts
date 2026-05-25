import type { WeatherSnapshot } from '../../weather/index.js';
import type { AnimationFrame } from '../types.js';
import { describeScene, renderAnimationFrames, renderFrame } from './frame.js';

export { formatTemperature } from './format.js';
export { describeScene, renderAnimationFrames, renderFrame, type SceneDescriptor } from './frame.js';
export { applyNightTint } from './tint.js';

export function renderAnimation(snapshot: WeatherSnapshot): AnimationFrame[] {
  return renderAnimationFrames(snapshot);
}

export function render(snapshot: WeatherSnapshot): Uint8Array {
  return renderFrame(describeScene(snapshot), 0);
}
