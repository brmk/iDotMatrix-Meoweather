import { fetchWeather } from "./weather/index.js";
import {
  renderAnimation, drawPet, pixelsToPng,
  PET_Y_WALK,
  type AnimationFrame, type PetState,
} from "./render/index.js";
import { advancePet, makePetContext, type PetContext } from "./pet/index.js";
import { sendToPanel } from "./transport/index.js";
import { config } from "./config.js";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const WEATHER_REFRESH_MS = 10 * 60 * 1000;

// ---- Pet state machine ----

const pet: PetState = {
  x: 0,
  facingRight: true,
  behavior: "walk",
  walkFrame: 0,
  behaviorFrame: 0,
  tailPhase: 0,
  isDay: true,
  eyesClosed: false,
  perchY: PET_Y_WALK,
};

const petCtx: PetContext = makePetContext();

// ---- Main loop ----

async function run(): Promise<void> {
  console.log(`Starting — sidecar ${config.sidecarUrl}`);

  let snapshot = await fetchWeather();
  let frames: AnimationFrame[] = renderAnimation(snapshot);
  let frameIdx = 0;
  let lastFetch = Date.now();

  console.log(
    `[${new Date().toISOString()}] weather code=${snapshot.weatherCode} temp=${snapshot.temperature}°C isDay=${snapshot.isDay} — ${frames.length} animation frames`
  );

  while (true) {
    if (Date.now() - lastFetch >= WEATHER_REFRESH_MS) {
      try {
        snapshot = await fetchWeather();
        frames = renderAnimation(snapshot);
        frameIdx = 0;
        lastFetch = Date.now();
        console.log(
          `[${new Date().toISOString()}] weather refreshed: code=${snapshot.weatherCode} temp=${snapshot.temperature}°C isDay=${snapshot.isDay}`
        );
      } catch (err) {
        console.error("weather fetch failed, keeping previous data:", err);
      }
    }

    const frame = frames[frameIdx % frames.length];
    const brightness = snapshot.isDay ? config.dayBrightness : config.nightBrightness;

    pet.isDay = snapshot.isDay;
    advancePet(pet, petCtx);

    const pixels = new Uint8Array(frame.pixels);
    drawPet(pixels, pet);

    try {
      await sendToPanel(pixelsToPng(pixels), brightness);
    } catch (err) {
      console.error("sendToPanel failed:", err);
    }

    await sleep(frame.delayMs);
    frameIdx = (frameIdx + 1) % frames.length;
  }
}

try {
  await run();
} catch (err) {
  console.error("Fatal:", err);
  process.exit(1);
}
