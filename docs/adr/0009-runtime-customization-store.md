# ADR 0009 — Runtime Customization Store with Schema Versioning

## Status

Accepted

## Context

Sprites, the color palette, and pet behavior configuration lived as TypeScript constants in
`src/sprites.ts`, `src/render/pet/colors.ts`, and `src/pet/config.ts`. The only way to edit them
was through dev-only Vite middleware (`/save-sprites`, `/save-pet-config` in `vite.config.ts`) that
literally rewrote TypeScript source files at runtime. This approach:

- Does not work in production builds (Vite middleware is dev-only).
- Makes production customization impossible without a code redeploy.
- Conflates user data with source code, creating noisy diffs.

ADR-0005 recorded the pixel pet sprite system but did not address persistence or editability. The
transformation plan (see `docs/transformation/README.md`) requires customization to reach production
via the real backend API.

## Decision

Create `src/customization/` — a versioned, migratable JSON store for panel customization —
following the same tolerance-first pattern as `src/runtime-config.ts`:

1. **`customization.json`** lives next to `runtime.json` at the project root. It is gitignored
   (user data, not source).

2. **Code constants remain as defaults.** `PET_DAY`, `PET_NIGHT`, `RAW_SPRITES`, and
   `PET_BEHAVIOR_CONFIG` are not deleted; they become the fallback when no file exists or the file
   is corrupt. The store deep-merges loaded values over defaults so partial files still work.

3. **Schema versioning.** Every `customization.json` carries a `schemaVersion` field. The store
   starts at `CURRENT_SCHEMA_VERSION = 1`. A `MIGRATIONS` table (keyed by source version) runs
   forward-only migrations on load. Files with a future version are used read-only in memory (with
   a logged warning) and never mutated on disk — preventing downgrade data loss.

4. **Tolerance over correctness.** Missing file → defaults. Corrupt JSON → defaults + backup at
   `customization.corrupt.json`. Migration failure → defaults + corrupt backup. Future version →
   defaults in memory, original file untouched. The store never throws to its callers.

5. **Palette model.** The palette is an extensible `Swatch[]` (`{ key: string; day: Color; night?: Color }`).
   The 5 reserved roles `o g s l r` (referenced by key in `draw.ts` for tail, burp stream, fur
   shading) are always present and cannot be removed. Night color is optional; Phase 2 will
   auto-derive it by darkening if omitted.

6. **Migration backup.** When a file is migrated (any `migratedFrom !== null`), the original is
   copied to `customization.bak.v{N}.json` before the rewrite, giving the user a one-time rollback
   path.

## Render Seam (Phase 2)

`src/render/pet/active.ts` is the runtime holder consumed by the draw module:

- **`ActiveCustomization`** holds parsed sprites, resolved day/night palette maps, dream color,
  behavior config, and pre-computed residue fade ramps.
- **`initActiveFromCustomization(c)`** / **`setActiveCustomization(c)`** (same body) rebuild the
  holder from a `Customization` value. `setActiveCustomization` is the Phase 3 hot-swap hook.
- **`getActive()`** returns the singleton, lazily seeding from `DEFAULT_CUSTOMIZATION` if never
  explicitly initialized (keeps unit tests that import `draw.ts` working without a store call).
- **Palette resolution**: `resolvePalette(swatches)` builds `{ day, night }` maps; if a swatch
  omits `night`, it is derived by `darken(day, NIGHT_FACTOR)` where `NIGHT_FACTOR = 0.5`.
- **Residue ramps**: `PUKE_FADE_STEPS` / `POO_FADE_STEPS` are preserved verbatim as defaults when
  the resolved `g`/`s` day colors match their hardcoded values. For user-customized swatches a
  proportional ramp is generated via `buildFadeSteps`. Rationale: the original ramps are
  hand-crafted and cannot be reproduced exactly from the base color by any uniform factor.

## Consequences

- Phase 2 injects sprites/colors from the store into the renderer via `initActiveFromCustomization`
  at startup; the renderer itself stays pure.
- Phase 3 adds `GET/PUT /api/customization` over the already-persisted store.
- The Studio (Phase 4) writes via the API, not by patching TypeScript files.
- Adding a new customization field requires: adding it to `Customization` in `schema.ts`, providing
  a default in `defaults.ts`, and (if removing/renaming an existing field) adding a migration
  entry in `MIGRATIONS` in `migrations.ts`.
- `CURRENT_SCHEMA_VERSION` starts at 1. Every bump must be recorded in
  `docs/transformation/TRACKER.md` alongside the migration it required.
