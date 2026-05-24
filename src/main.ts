import { fetchWeather } from "./weather/index.js";
import {
  renderAnimation, drawPet, pixelsToPng,
  PET_WIDTH, PET_Y_WALK, PET_Y_PERCH,
  type AnimationFrame, type PetState, type PetBehavior,
} from "./render/index.js";
import { sendToPanel } from "./transport/index.js";
import { config } from "./config.js";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const WEATHER_REFRESH_MS = 10 * 60 * 1000;

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

let petStepCounter  = 0; // advance pet position every 2 anim frames → slower walk
let petTailCounter  = 0; // advance tail every 3 anim frames
let petBlinkTimer   = rnd(20, 40); // frames until next blink
let petWalkBudget   = rnd(15, 40); // steps until next behaviour roll
let petBehaviorDur  = 0;

function advancePet() {
  petStepCounter++;
  petTailCounter++;
  petBlinkTimer--;

  // Tail wags independently of movement
  if (petTailCounter >= 3) {
    pet.tailPhase = (pet.tailPhase + 1) % 4;
    petTailCounter = 0;
  }

  // Blink: close eyes for 2 frames, then reset timer
  if (petBlinkTimer <= 0) {
    pet.eyesClosed = petBlinkTimer > -2;
    if (petBlinkTimer <= -2) petBlinkTimer = rnd(25, 50);
  } else {
    pet.eyesClosed = false;
  }

  if (pet.behavior === "walk") {
    if (petStepCounter >= 2) {
      petStepCounter = 0;

      // Night: walk toward right corner (x≥25), face left once there
      if (!pet.isDay) {
        if (pet.x < 25) pet.facingRight = true;
        else             pet.facingRight = false;
      }

      pet.x += pet.facingRight ? 1 : -1;
      if (pet.x >= 32 - PET_WIDTH) { pet.x = 32 - PET_WIDTH; pet.facingRight = false; }
      if (pet.x <= 0)               { pet.x = 0;               pet.facingRight = true;  }

      pet.walkFrame = (pet.walkFrame + 1) % 2;
      petWalkBudget--;

      if (petWalkBudget <= 0) {
        const roll = Math.random();
        let next: PetBehavior = "walk";

        if (!pet.isDay) {
          // Night: drift to corner, mostly dream/sleep — no perch/jump
          if      (roll < 0.55) { next = "dream"; petBehaviorDur = rnd(80, 160); }
          else if (roll < 0.75) { next = "lie";   petBehaviorDur = rnd(50, 100); }
          else if (roll < 0.90) { next = "sit";   petBehaviorDur = rnd(20, 50);  }
          petWalkBudget = rnd(3, 10);
        } else {
          // Day: full behaviour palette
          if      (roll < 0.15) { next = "sit";   petBehaviorDur = rnd(30, 80);  }
          else if (roll < 0.25) { next = "lie";   petBehaviorDur = rnd(50, 120); }
          else if (roll < 0.35) { next = "jump";  petBehaviorDur = 8;            }
          else if (roll < 0.85) { next = "perch"; petBehaviorDur = rnd(8, 16);   }
          petWalkBudget = rnd(15, 40);
        }

        if (next !== "walk") {
          pet.behavior = next;
          pet.behaviorFrame = 0;
        }
      }
    }
  } else if (pet.behavior === "perch") {
    if (pet.perchY > PET_Y_PERCH && petBehaviorDur > 0) {
      // arc up — gated on budget > 0 so arc-down can't re-trigger this branch
      pet.perchY = Math.max(PET_Y_PERCH, pet.perchY - 2);
      petStepCounter = 0;
    } else if (petBehaviorDur > 0) {
      // walk on text: 1px/frame, legs animate every 2 steps
      petStepCounter = 0;
      pet.x += pet.facingRight ? 1 : -1;
      if (pet.x > 22) { pet.x = 22; pet.facingRight = false; }
      if (pet.x < 4)  { pet.x = 4;  pet.facingRight = true;  }
      if (petBehaviorDur % 2 === 0) pet.walkFrame = (pet.walkFrame + 1) % 2;
      petBehaviorDur--;
    } else {
      // arc down
      pet.perchY = Math.min(PET_Y_WALK, pet.perchY + 2);
      if (pet.perchY >= PET_Y_WALK) {
        pet.perchY = PET_Y_WALK;
        pet.behavior = "walk";
        pet.behaviorFrame = 0;
        petWalkBudget = rnd(15, 40);
      }
    }
  } else {
    pet.behaviorFrame++;
    if (pet.behaviorFrame >= petBehaviorDur) {
      pet.behavior = "walk";
      pet.behaviorFrame = 0;
    }
  }
}

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
    advancePet();

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
