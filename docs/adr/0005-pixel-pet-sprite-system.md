# ADR-0005 — Pixel pet sprite system

**Date:** 2026-05-24  
**Status:** Accepted

---

## Context

Phase 5 adds a pixel cat that walks back and forth along the bottom of every
weather animation frame. The cat needs:

- Multiple behaviors (walk, sit, lie, jump, perch, dream, burp) with per-behavior frame cycles
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
| `walk` | until budget runs out (~47 % day / ~19 % night roll) | start state |
| `sit` | 30–80 frames | 15 % day / 8 % night roll |
| `lie` | 50–120 frames | 8 % day / 20 % night roll |
| `jump` | 8 frames | 6 % day roll |
| `perch` | 8–16 frames on text baseline | 18 % day roll |
| `dream` | 100–180 frames | 50 % night roll |
| `burp` | 10–14 frames + green fading floor residue | 4 % day / 2 % night roll |
| `poo` | 8–10 frames + brown fading floor residue | 2 % day / 1 % night roll |

`walkFrame` advances every 2 animation frames (slower than the weather
animation tick) to make movement feel natural.

### Night palette

The pet has separate day and night color maps (`PET_DAY` / `PET_NIGHT`).
Night colors are roughly half-brightness. This is applied per-pixel in
`drawPet` rather than via the global `applyNightTint` pass, which only runs
on the pre-rendered weather buffer.

### Visual design tool

The Studio tab in the Vite + React dev app (`dev/`) is the authoritative visual
editor for sprite designs and palette colors. Run `npm run dev` (full stack),
open the Studio tab, paint in the editor — the live preview calls
`drawPetWithSprites` directly from `src/render/pet/draw.ts` with the browser's
active customization kept in sync, so colors and layout are pixel-perfect.

> **Superseded write path (Phase 4):** The Studio now saves through the real
> backend API (`PUT /api/customization`), persisting to `customization.json` at
> the project root. The old "Save sprites" / "Save pet-config" buttons that wrote
> directly to `src/sprites.ts` / `src/pet/config.ts` via Vite plugins are removed
> from the production UI. To commit updated code defaults, use the dev-only
> `/save-sprites` / `/save-pet-config` Vite plugin helpers directly.
> → [[adr/0009-runtime-customization-store]]

---

## Consequences

- Adding a new behavior requires: a new `PetBehavior` union member, one entry in
  `resolvePetBehaviorDraw()` in `src/render/pet/behaviors.ts`, and optionally one entry in
  `BEHAVIOR_ADVANCERS` in `src/pet/index.ts` (behaviors not listed fall back to
  `advanceTimed`), plus sprite entries in `src/sprites.ts` so Studio can edit them.
- Behaviors may project temporary **scene residue** that outlives the active pose.
  Residue is stored as `pukeItems: SceneItem[]` and `pooItems: SceneItem[]` in
  `PetState` (each `SceneItem` is `{ x, y, ttl }`). Every event appends a new
  independent item; `advancePet` ticks all items and filters expired ones. This
  allows multiple overlapping residues from repeated behaviors.
- Sprite pixel art lives in one place: `src/sprites.ts`. The Studio dev app
  reads from and writes to that file directly — there is no longer a separate
  HTML design source to keep in sync.
- The 5-pixel width and `PET_Y_WALK=28` baseline are effectively fixed by
  the frame layout. Changing them requires re-designing all sprites.
