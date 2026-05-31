import './logger.js';

import { controlState } from './control-state.js';
import { startControlServer } from './control.js';
import { loadRuntimeConfig } from './runtime-config.js';
import { config } from './config.js';
import { advancePet, makePetContext, type PetContext } from './pet/index.js';
import { drawPet, PET_Y_WALK, pixelsToPng, renderAnimation, type AnimationFrame, type PetState } from './render/index.js';
import { sendToPanel } from './transport/index.js';
import { fetchWeather } from './weather/index.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const WEATHER_REFRESH_MS = 10 * 60 * 1000;

// ---- Pet state machine ----

const pet: PetState = {
  x: 0,
  facingRight: true,
  behavior: 'walk',
  walkFrame: 0,
  behaviorFrame: 0,
  tailPhase: 0,
  isDay: true,
  eyesClosed: false,
  perchY: PET_Y_WALK,
  pukeItems: [],
  pooItems: [],
};

const petCtx: PetContext = makePetContext();

controlState.pet = pet;
controlState.petCtx = petCtx;

// Apply persisted runtime settings (overrides config defaults).
const runtimeCfg = loadRuntimeConfig();
if (runtimeCfg.brightness) controlState.brightness = runtimeCfg.brightness;
if (runtimeCfg.nightHours !== undefined) controlState.nightHours = runtimeCfg.nightHours ?? null;
if (runtimeCfg.powerSchedule !== undefined) controlState.powerSchedule = runtimeCfg.powerSchedule ?? null;

// ---- Helpers ----

// Reusable working buffer for per-frame pet compositing.
const WORK_BUF = new Uint8Array(32 * 32 * 3);

function pushFrame(b64: string): void {
  controlState.currentFrame = b64;
  for (const sub of controlState.frameSubs) {
    try {
      sub(b64);
    } catch {
      /* subscriber disconnected */
    }
  }
}

function isInOffWindow(): boolean {
  const ps = controlState.powerSchedule;
  if (!ps) return false;
  const hour = new Date().getHours();
  return ps.offFrom <= ps.offTo
    ? hour >= ps.offFrom && hour < ps.offTo
    : hour >= ps.offFrom || hour < ps.offTo;
}

function resolveIsDay(apiIsDay: boolean): boolean {
  const nh = controlState.nightHours;
  if (!nh) return apiIsDay;
  const hour = new Date().getHours();
  const isNightHour = nh.from <= nh.to
    ? hour >= nh.from && hour < nh.to
    : hour >= nh.from || hour < nh.to;
  return !isNightHour;
}

function applyBehaviorOverride(): void {
  if (!controlState.behaviorOverride) return;
  const { behavior, dur } = controlState.behaviorOverride;
  pet.behavior = behavior;
  pet.behaviorFrame = 0;
  petCtx.behaviorDur = dur;
  if (behavior === 'perch') pet.perchY = PET_Y_WALK;
  controlState.behaviorOverride = null;
}

// ---- Main loop ----

async function run(): Promise<void> {
  startControlServer();

  console.log(`Starting — sidecar ${config.sidecarUrl}`);

  let snapshot = await fetchWeather();
  controlState.snapshot = snapshot;
  let frames: AnimationFrame[] = renderAnimation(snapshot);
  let frameIdx = 0;
  let lastFetch = Date.now();
  let matrixOff = false;

  console.log(
    `[${new Date().toISOString()}] weather code=${snapshot.weatherCode} temp=${snapshot.temperature}°C isDay=${snapshot.isDay} — ${frames.length} animation frames`,
  );

  while (true) {
    if (Date.now() - lastFetch >= WEATHER_REFRESH_MS) {
      try {
        snapshot = await fetchWeather();
        controlState.snapshot = snapshot;
        frames = renderAnimation(snapshot);
        frameIdx = 0;
        lastFetch = Date.now();
        console.log(`[${new Date().toISOString()}] weather refreshed: code=${snapshot.weatherCode} temp=${snapshot.temperature}°C isDay=${snapshot.isDay}`);
      } catch (err) {
        console.error('weather fetch failed, keeping previous data:', err);
      }
    }

    if (isInOffWindow()) {
      if (!matrixOff) {
        matrixOff = true;
        console.log(`[${new Date().toISOString()}] power schedule: matrix off`);
        const black = pixelsToPng(new Uint8Array(32 * 32 * 3));
        pushFrame(black.toString('base64'));
        try { await sendToPanel(black, 0); } catch { /* matrix may not be connected */ }
      }
      await sleep(30_000);
      continue;
    }

    if (matrixOff) {
      matrixOff = false;
      console.log(`[${new Date().toISOString()}] power schedule: matrix on`);
    }

    if (controlState.weatherDirty) {
      frames = renderAnimation(controlState.weatherOverride ?? snapshot);
      frameIdx = 0;
      controlState.weatherDirty = false;
    }

    const tickStart = Date.now();

    const effective = controlState.weatherOverride ?? snapshot;
    const frame = frames[frameIdx % frames.length];
    const isDay = resolveIsDay(effective.isDay);
    const brightness = isDay ? controlState.brightness.day : controlState.brightness.night;

    pet.isDay = isDay;
    advancePet(pet, petCtx);
    applyBehaviorOverride();
    controlState.tick++;

    WORK_BUF.set(frame.pixels);
    drawPet(WORK_BUF, pet);

    const png = pixelsToPng(WORK_BUF);

    pushFrame(png.toString('base64'));

    if (!controlState.matrixPaused) {
      try {
        await sendToPanel(png, brightness);
      } catch (err) {
        console.error('sendToPanel failed:', err);
      }
    }

    const elapsed = Date.now() - tickStart;
    await sleep(Math.max(0, frame.delayMs - elapsed));
    frameIdx = (frameIdx + 1) % frames.length;
  }
}

try {
  await run();
} catch (err) {
  console.error('Fatal:', err);
  process.exit(1);
}
