# Phase 6 — Refactor, tests, and browser simulator

**Status:** Planned  
**Motivation:** `advancePet` has grown to ~60 lines with nested conditionals
(SonarLint flags cognitive complexity 55). Before adding more behaviors, the
code needs to be easier to reason about and safe to change. A browser simulator
eliminates the need to connect the physical panel when iterating on visuals.

---

## Part A — Refactor `advancePet`

### Goal

Split the monolithic `advancePet` into one handler per behavior, each in its
own function with a clear contract: takes `PetState` + mutable counters, returns
updated state.

### Proposed shape

```typescript
// src/pet/index.ts  (new file)
export function advanceWalk(state: PetState, ctx: PetContext): PetState { … }
export function advancePerch(state: PetState, ctx: PetContext): PetState { … }
export function advanceSit(state: PetState, ctx: PetContext): PetState { … }
export function advanceLie(state: PetState, ctx: PetContext): PetState { … }
export function advanceJump(state: PetState, ctx: PetContext): PetState { … }

export function advancePet(state: PetState, ctx: PetContext): PetState {
  switch (state.behavior) {
    case 'walk':   return advanceWalk(state, ctx);
    case 'perch':  return advancePerch(state, ctx);
    …
  }
}
```

`PetContext` holds the frame-level counters that currently live as module
globals (`petStepCounter`, `petTailCounter`, `petBlinkTimer`, etc.).

### Exit gate

`npm run build` passes; behavior is visually identical to current.

---

## Part B — Unit tests for the state machine

### Goal

Cover the bugs that were found in this session so they can't regress silently.

### Test cases to write (Vitest or Node `--test`)

```
advancePerch
  ✓ arc-up decrements perchY by 2 each frame while budget > 0
  ✓ arc-up stops at PET_Y_PERCH exactly (no overshoot)
  ✓ walk phase decrements petBehaviorDur each frame
  ✓ arc-down starts only when petBehaviorDur === 0
  ✓ arc-down does NOT re-trigger arc-up (the 17↔19 oscillation bug)
  ✓ arc-down exits to 'walk' when perchY reaches PET_Y_WALK
  ✓ perchY is reset to PET_Y_WALK on exit

advanceWalk
  ✓ x clamps at 0 and 32-PET_WIDTH and reverses facing
  ✓ walkBudget depletion triggers a behavior roll
  ✓ rolled behavior is set with correct initial dur

general
  ✓ tail phase advances every 3 frames
  ✓ blink opens after 2 closed frames
  ✓ eyesClosed is false outside blink window
```

### Tooling

Add `vitest` (zero-config for ESM TypeScript):

```bash
npm i -D vitest
# add to package.json scripts: "test": "vitest run"
```

### Exit gate

`npm test` passes; tests run in CI without the panel or sidecar.

---

## Part C — Browser simulator

### Goal

A single HTML page (`dev/simulator.html`) that renders the 32×32 scene in a
browser canvas — no panel, no sidecar, no BLE. Allows fast iteration on:

- Sprite designs (same palette as `frames.html`)
- Weather animation frames
- Pet behavior and timing
- Night-mode tint

### Approach

Bundle `src/render/index.ts` with `esbuild` into a single browser JS file,
then drive it from a tiny HTML harness:

```bash
# one-off build for the simulator
npx esbuild src/render/index.ts --bundle --format=esm --outfile=dev/render.js
```

`dev/simulator.html` imports `render.js`, calls `renderAnimation(snapshot)` and
`drawPet(pixels, petState)` on every `requestAnimationFrame` tick, and paints
the result onto a `<canvas>` scaled up 10× (320×320 px).

Controls to add:
- Weather type selector (dropdown of 9 icon types)
- Temperature input
- Day/Night toggle
- Speed slider (frame delay multiplier)
- "Force perch" button to trigger the behavior immediately

### Exit gate

Opening `dev/simulator.html` in a browser shows the animated weather scene with
the walking cat, hot-reloads when `dev/render.js` is rebuilt.

---

## Part D — Nice-to-have (lower priority)

- **More pet behaviors:** eat (hunches over a bowl), scratch ear, yawn (mouth
  open for 2 frames), sleep on the temperature text
- **Personality tuning UI** in the simulator: sliders for behavior probabilities
- **E2E smoke test:** headless Playwright that opens the simulator and asserts
  no JS errors across 10 seconds of animation

---

## Suggested order

```
A (refactor) → B (tests) → C (simulator) → D (extras)
```

A and B must go together: refactor first so tests cover the clean API, not the
messy monolith. C can be done independently of A/B but benefits from the
cleaner module boundary.
