# Phase 6 — Refactor, tests, and browser simulator

> Completed work. See [[SPEC]] for system context and [[ROADMAP]] for phase history.

**Status:** Complete (2026-05-25)  
**Original motivation:** `advancePet` had grown to ~60 lines with nested
conditionals (SonarLint cognitive complexity 55). Before adding more behaviors,
the code needed to be easier to reason about and safe to change. A browser
simulator would eliminate the need to connect the physical panel when iterating
on visuals.

---

## What was actually built

Parts A, B, C were completed together in a single refactoring pass on 2026-05-25.

**Part A — Modular render split**: `src/render/core.ts` (556 lines) was split
into five focused modules: `canvas.ts` (primitives), `font.ts` (text rendering),
`icons.ts` (weather icon registry), `pet-draw.ts` (sprite parsing and pet
drawing), `scene.ts` (scene composition). `core.ts` is now a barrel re-export so
all existing imports continue to work.

**Registry patterns** replaced switch statements throughout:
- `ICON_REGISTRY: Record<IconType, IconDef>` — add one entry to add a new weather icon
- `BEHAVIOR_DRAWERS: Record<PetBehavior, BehaviorDrawer>` in `pet-draw.ts`
- `BEHAVIOR_ADVANCERS: Partial<Record<PetBehavior, BehaviorAdvancer>>` in `src/pet/index.ts`

**`advancePet` refactor**: Behavior-specific logic extracted into `advanceWalk`,
`advancePerch`, `advanceSit`, `advanceLie`, `advanceJump` functions. The
dispatch loop replaced the switch: `const advancer = BEHAVIOR_ADVANCERS[state.behavior]; return advancer ? advancer(…) : advanceTimed(…)`.

**Part B — Dev app rebuilt as Vite + React**: `dev/` replaced with a proper
Vite 8 + React 18 app (`npm run dev:sim` → localhost:8767). Two tabs:
- **Simulator**: live animated preview of all weather types + pet behaviors
- **Studio**: sprite editor with live preview via `drawPetWithSprites`; "Save sprites" writes directly to `src/sprites.ts` with no manual transcription

The `@src` path alias lets React components import directly from `src/` —
no compiled bundle, no copy-paste, fully DRY.

**Part C — Vitest**: `vitest.config.ts` added at root. `npm test` runs all
`src/**/*.{test,spec}.ts` files. Separate config needed because `vite.config.ts`
sets `root: 'dev'` which caused vitest to search the wrong directory.

**Deleted**: `dev/simulator.html`, `dev/studio.html`, `dev/frames.html`,
`scripts/dev-sim.mjs`, `dev/render.js` build artifact.

---

---

## Original plan (for historical reference)

### Part A — Refactor `advancePet`

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

### Part B — Unit tests for the state machine

### Goal

Cover the bugs that were found in this session so they can't regress silently.
See [[adr/0006-perch-behavior-and-state-machine-lessons]] for the full bug catalogue.

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

### Part C — Browser simulator

### Goal

A single HTML page (`dev/simulator.html`) that renders the 32×32 scene in a
browser canvas — no panel, no sidecar, no BLE. Allows fast iteration on:

- Sprite designs (same palette as `frames.html`)
- Weather animation frames
- Pet behavior and timing
- Night-mode tint

### Approach

Bundle `src/render/index.ts` with `esbuild` into a single browser JS file,
then drive it from a tiny HTML harness.
Sprite system reference: [[adr/0005-pixel-pet-sprite-system]].

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

### Part D — Nice-to-have (lower priority)

- **More pet behaviors:** eat (hunches over a bowl), scratch ear, yawn (mouth
  open for 2 frames), sleep on the temperature text
- **Personality tuning UI** in the simulator: sliders for behavior probabilities
- **E2E smoke test:** headless Playwright that opens the simulator and asserts
  no JS errors across 10 seconds of animation

---

### Suggested order

```
A (refactor) → B (tests) → C (simulator) → D (extras)
```

A and B must go together: refactor first so tests cover the clean API, not the
messy monolith. C can be done independently of A/B but benefits from the
cleaner module boundary.
