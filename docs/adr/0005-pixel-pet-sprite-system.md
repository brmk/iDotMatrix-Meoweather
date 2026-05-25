# ADR-0005 — Pixel pet sprite system

**Date:** 2026-05-24  
**Status:** Accepted

---

## Context

Phase 5 adds a pixel cat that walks back and forth along the bottom of every
weather animation frame. The cat needs:

- Multiple behaviors (walk, sit, lie, jump) with per-behavior frame cycles
- Horizontal mirroring when direction changes
- A waving tail
- Night dimming consistent with the weather scene
- Zero impact on the pre-rendered weather animation buffers

---

## Decision

### Overlay, not embedded

The cat is drawn as an overlay on a **copy** of each pre-rendered weather frame
at display time, not baked into the animation buffer. `main.ts` does:

```typescript
const pixels = new Uint8Array(frame.pixels); // copy
drawPet(pixels, pet);                        // overlay
await sendToPanel(pixelsToPng(pixels), brightness);
```

This keeps `renderAnimation()` pure and independent of pet state.

### Sprite format

Sprites are defined as ASCII grids where each character maps to an RGB color:

```
. = transparent (skip)
o = orange body
g = green eye
s = brown (tail only)
r = dark rust stripe
l = cream belly
```

`parseSpr(rows: string[])` converts a grid to `[dx, dy, char][]`.  
`blit(buf, pixels, x, y, mirror, colors)` draws it, mirroring via
`x + (PET_WIDTH - 1 - dx)` when `mirror=true`.

**Sprite width is always 5 pixels.** Column `dx=0` is left intentionally
transparent in all walk/lie/jump sprites — the tail pixel occupies it.

### Tail

The tail is a **single pixel** drawn separately, not part of any sprite row.
It sits at `dx=0` (facing right) or `dx=4` (facing left) — the transparent
column adjacent to the body — and oscillates between `PET_Y_WALK+1` (eye row)
and `PET_Y_WALK+2` (body row) on a 4-step phase counter.

`TAIL_Y = [1, 2, 1, 2]` — offsets from `PET_Y_WALK=28`.

The tail uses the `s` (brown) color in all behaviors. For the **sit** pose the
tail is shown curled around the haunches directly in the sprite pixels; the
separate tail pixel is suppressed.

### PetState machine

`PetState` lives in `main.ts`; `drawPet` is a pure render function that takes
it. Behavior transitions happen in `advancePet()`:

| Behavior | Duration | Trigger |
|---|---|---|
| `walk` | until budget runs out | start state |
| `sit` | 30–80 frames | 30 % roll after walk budget |
| `lie` | 50–120 frames | 20 % roll |
| `jump` | 8 frames | 15 % roll |

`walkFrame` advances every 2 animation frames (slower than the weather
animation tick) to make movement feel natural.

### Night palette

The pet has separate day and night color maps (`PET_DAY` / `PET_NIGHT`).
Night colors are roughly half-brightness. This is applied per-pixel in
`drawPet` rather than via the global `applyNightTint` pass, which only runs
on the pre-rendered weather buffer.

### Visual design tool

The Studio tab in the Vite + React dev app (`dev/`) is the authoritative visual
editor for sprite designs. Run `npm run dev:sim`, open the Studio tab, paint in
the editor — the live preview calls `drawPetWithSprites` directly from
`src/render/pet/draw.ts`, so colors and layout are pixel-perfect. Click
"Save sprites" to write the approved ASCII grids directly to `src/sprites.ts`.

No manual transcription step; no separate HTML file to keep in sync.

---

## Consequences

- Adding a new behavior requires: a new `PetBehavior` union member, one entry in
  `resolvePetBehaviorDraw()` in `src/render/pet/behaviors.ts`, and optionally one entry in
  `BEHAVIOR_ADVANCERS` in `src/pet/index.ts` (behaviors not listed fall back to
  `advanceTimed`). No switch statements to modify.
- Sprite pixel art lives in one place: `src/sprites.ts`. The Studio dev app
  reads from and writes to that file directly — there is no longer a separate
  HTML design source to keep in sync.
- The 5-pixel width and `PET_Y_WALK=28` baseline are effectively fixed by
  the frame layout. Changing them requires re-designing all sprites.
