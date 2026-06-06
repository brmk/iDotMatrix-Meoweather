# Phase 2 — Render seam: renderer reads customization from the store

> Read [[README]] + [[PROTOCOL]] first. **The load-bearing refactor.** Output must be
> **pixel-identical** to today when the store holds defaults.

## Objective

Make the pet renderer consume **injected** sprites + palette instead of importing
`PET_DAY`/`PET_NIGHT` and `DEFAULT_PET_SPRITES` as module constants. Add palette resolution
(including night auto-darken) and an `active` holder seeded at startup from `loadCustomization()`
(Phase 1) and hot-swappable. After this phase, `src/sprites.ts`, `src/render/pet/colors.ts`,
`src/pet/config.ts` are **fallback defaults only**.

## Depends on

**Phase 1** (✅): `src/customization/` store with `loadCustomization()` and `DEFAULT_CUSTOMIZATION`.

## Context & seams

- `src/render/pet/draw.ts`:
  - line 3 imports `PET_DAY, PET_DREAM_COLOR, PET_NIGHT`; line 4 imports `DEFAULT_PET_SPRITES`.
  - `drawPetCore` (draw.ts:76) picks `state.isDay ? PET_DAY : PET_NIGHT`, references **tail**
    `colors['s']` (draw.ts:91) and **burp stream** `colors.g` (draw.ts:83).
  - `PUKE_FADE_STEPS` (draw.ts:7) and `POO_FADE_STEPS` (draw.ts:14) are hardcoded RGB ramps.
  - `drawPet()` (draw.ts:94) uses `DEFAULT_PET_SPRITES`; `drawPetWithSprites()` (draw.ts:98) already
    parses arbitrary raw sprites — the Simulator uses this path.
- `src/render/pet/sprites.ts`: `parsePetSprites(raw)` is `WeakMap`-cached (sprites.ts:40);
  `DEFAULT_PET_SPRITES = parsePetSprites(RAW_SPRITES)` (sprites.ts:49).
- `src/control.ts:18` `BEHAVIOR_DUR` — a second hardcoded behavior-duration table.

## Tasks

- [ ] `src/render/pet/palette.ts`:
  - `darken(c: Color, factor: number): Color`.
  - `resolvePalette(swatches: Swatch[]): { day: PetColor; night: PetColor }` — build both maps;
    when a swatch has no `night`, use `darken(day, NIGHT_FACTOR)`.
  - **Pin `NIGHT_FACTOR` so the default palette reproduces `PET_NIGHT` exactly.** The defaults carry
    explicit night values (Phase 1), so auto-darken only applies to user swatches; still, choose and
    record `NIGHT_FACTOR` (derive from the PET_DAY→PET_NIGHT ratio; ≈0.5) in [[TRACKER]].
  - Derive `PUKE_FADE_STEPS` / `POO_FADE_STEPS` from the resolved `g` / `s` swatches (a small ramp
    generator) so residue recolors with the cat **while still matching the current ramps for
    defaults**. If exact-match proves fiddly, keep the existing constants as the default ramp and
    only regenerate when those swatches differ from default — document the choice.
- [ ] `src/render/pet/active.ts`:
  - Holds `{ sprites: ParsedSprites; day: PetColor; night: PetColor; dream: Color }`.
  - `initActiveFromCustomization(c: Customization)` and `setActiveCustomization(c)` (same body) —
    parse sprites via `parsePetSprites`, resolve palette, store.
  - `getActive()` accessor. Seed lazily from `DEFAULT_CUSTOMIZATION` if never initialized (keeps
    pure unit tests that import `draw.ts` working without a store call).
- [ ] Refactor `src/render/pet/draw.ts`:
  - Replace the constant imports with reads from `getActive()` inside `drawPet()` /`drawPetCore`.
  - Keep `drawPetWithSprites()` working (Simulator) — it can resolve palette from the active palette
    or accept an optional palette arg; keep its signature backward-compatible.
  - Residue + dream + tail + burp colors now come from the active palette.
- [ ] `src/main.ts`: call `initActiveFromCustomization(loadCustomization())` at startup (before the
  render loop). Demote `src/sprites.ts` / `colors.ts` / `pet/config.ts` to fallback defaults (still
  imported by `defaults.ts`; no longer the live source for `draw.ts`).
- [ ] `src/control.ts`: derive `BEHAVIOR_DUR` from the active behavior config instead of the
  hardcoded table (single source of truth).

## Acceptance criteria

- With the store at defaults, **`src/render/regression.test.ts` passes unchanged** (pixel-identical
  PNG hashes) — this is the primary gate.
- `pet.test.ts` and `scene.test.ts` still pass.
- Editing the in-memory active customization (e.g. recolor `o`) and re-rendering visibly changes the
  cat in a unit test, proving the injection works.
- `grep` shows `draw.ts` no longer imports `PET_DAY`/`PET_NIGHT`/`DEFAULT_PET_SPRITES` directly.
- `BEHAVIOR_DUR` is gone or computed from config; behavior durations unchanged for defaults.

## Tests to add

- `src/render/pet/palette.test.ts`: `resolvePalette` reproduces `PET_DAY`/`PET_NIGHT` for the
  default swatch set; `darken` math; residue ramp generation matches defaults.
- `src/render/pet/active.test.ts`: init/set/get; lazy default seeding.
- Extend a render test to assert a recolored swatch changes output pixels.
- Coverage thresholds stay green.

## Docs to update

- `docs/ARCHITECTURE.md`: render path now reads from the active customization holder.
- Update the ADR from Phase 1 (or add a note): the render-seam injection mechanism.
- `docs/SPEC.md`: palette/sprites are runtime-driven (code = fallback).
- [[TRACKER]]: P2 ✅; record `NIGHT_FACTOR` and the residue-ramp decision in the decision log.

## Verification

- `npm test` (regression must be byte-identical for defaults). Open a generated default PNG and a
  recolored PNG (write to `/tmp`) and eyeball per [[../adr/0004-rendering-approach-32x32]].
- `npm run dev:sim` — Simulator still renders the cat identically.

## Handoff notes

- Phase 3 will call `setActiveCustomization()` on every successful `PUT /api/customization` to
  hot-swap without restart. Ensure `setActiveCustomization` is exported and idempotent.
