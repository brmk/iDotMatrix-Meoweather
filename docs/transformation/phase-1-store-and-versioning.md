# Phase 1 — Customization store + schema versioning + migrations

> Read [[README]] + [[PROTOCOL]] first. Backend only. **No runtime behavior change** — nothing
> consumes the store yet (Phase 2 does). This phase just makes a versioned, migratable store exist
> and be well-tested.

## Objective

Create `src/customization/` — a single backend-owned store for the panel's customization (palette,
sprites, behavior, and forward-compatible slots for scene/location) persisted to
`customization.json` next to the runtime. It is **schema-versioned** with a forward **migration
runner**, deep-merges over **code-derived defaults**, and tolerates missing/corrupt/old files
without crashing. Mirrors the existing `src/runtime-config.ts` pattern.

## Depends on

Nothing. First phase.

## Context & seams

- **Mirror:** `src/runtime-config.ts` — `loadRuntimeConfig` / `saveRuntimeConfig`,
  `CONFIG_PATH = resolve(__dirname, '..', 'runtime.json')`, tolerant reads, pretty JSON write.
- **Types to reuse (do not redefine):**
  - `Color` from `src/render/types.ts`.
  - `PetColor = Record<string, Color>` from `src/render/pet/types.ts`.
  - `RawPetSprites = Record<SpriteKey, string[]>`, `SpriteKey` from `src/sprites.ts`.
  - `PetBehaviorConfig` from `src/pet/config.ts`.
- **Defaults come from existing code constants:** `PET_DAY` / `PET_NIGHT`
  (`src/render/pet/colors.ts`), `RAW_SPRITES` (`src/sprites.ts`), `PET_BEHAVIOR_CONFIG`
  (`src/pet/config.ts`). These modules **remain** (Phase 2 demotes them to fallback-only); here you
  just read from them to build `DEFAULT_CUSTOMIZATION`.

## Tasks

- [ ] `src/customization/schema.ts`:
  - `interface Swatch { key: string; day: Color; night?: Color }` (omit `night` ⇒ auto-darken later).
  - `interface Customization { schemaVersion: number; palette: Swatch[]; sprites: RawPetSprites;
    behavior: PetBehaviorConfig; scene?: SceneTheme; location?: GeoCoord }` — keep `scene` and
    `location` optional now (filled by Phase 7) so the schema is forward-stable.
  - `export const CURRENT_SCHEMA_VERSION = 1;`
  - A lightweight validator `isValidCustomization(x): x is Customization` (shape + palette keys are
    single chars + reserved roles `o g s l r` present). Keep it dependency-free.
- [ ] `src/customization/defaults.ts`:
  - `DEFAULT_CUSTOMIZATION: Customization` assembled from the code constants above, stamped with
    `schemaVersion: CURRENT_SCHEMA_VERSION`. Palette includes the 5 reserved roles with both day +
    night from `PET_DAY`/`PET_NIGHT` (explicit night here so defaults are unambiguous).
- [ ] `src/customization/migrations.ts`:
  - `type Migration = (old: any) => any;`
  - `const MIGRATIONS: Record<number, Migration> = { /* 0: v0→v1, ... */ };` keyed by the *source*
    version. (At v1 there may be no entries yet; structure must support adding them.)
  - `runMigrations(raw): { value: Customization; migratedFrom: number | null }`:
    - `from = typeof raw?.schemaVersion === 'number' ? raw.schemaVersion : 0` (missing ⇒ legacy 0).
    - If `from > CURRENT_SCHEMA_VERSION` → log, return defaults with `migratedFrom: null`
      (downgrade: never mutate a newer file).
    - Apply `MIGRATIONS[v]` for `v` from `from` to `CURRENT-1`, validating after each step; on any
      throw/invalid → throw a typed error (caller falls back to defaults + backup).
    - Stamp result `schemaVersion = CURRENT_SCHEMA_VERSION`.
- [ ] `src/customization/index.ts` (the store):
  - `CONFIG_PATH = resolve(__dirname, '..', '..', 'customization.json')` (adjust depth for the dir).
  - `loadCustomization(): Customization`:
    - missing file → return clone of `DEFAULT_CUSTOMIZATION`.
    - read + `JSON.parse` + `runMigrations` + deep-merge over defaults (defaults fill any gap).
    - if `migratedFrom` is non-null and `> 0`: **write the upgraded file back** and first copy the
      original to a one-time backup `customization.bak.v{from}.json`.
    - parse/validation failure → log, back up the bad file (`customization.corrupt.json`), return
      defaults. **Never throw.**
  - `saveCustomization(patch: Partial<Customization>): Customization` — load current, deep-merge
    patch, stamp `schemaVersion = CURRENT`, validate, write pretty JSON, return the saved value.
  - `resetCustomization(): Customization` — delete the file if present, return defaults.
- [ ] Add `customization.json`, `customization.bak.*.json`, `customization.corrupt.json` to
  `.gitignore` (next to the existing `runtime.json` entry).

## Acceptance criteria

- `loadCustomization()` on a fresh checkout (no file) returns a value deep-equal to
  `DEFAULT_CUSTOMIZATION`.
- A legacy file with **no** `schemaVersion` loads, migrates to v1, is rewritten with
  `schemaVersion: 1`, and a backup of the original exists.
- A corrupt/invalid file does not crash; defaults are returned and the bad file is backed up.
- A file with `schemaVersion` **greater** than `CURRENT` is left untouched on disk and defaults are
  used in memory (with a logged warning).
- `saveCustomization({ palette })` persists, stamps the current version, and a subsequent
  `loadCustomization()` round-trips the value.
- No other module imports the store yet (grep confirms zero consumers) — behavior unchanged.

## Tests to add

`src/customization/customization.test.ts` (and/or `migrations.test.ts`):
- fresh load → defaults; round-trip save/load.
- legacy (un-versioned) fixture → migrated shape + version stamp + backup written.
- corrupt JSON fixture → defaults + corrupt backup, no throw.
- future-version fixture → defaults in memory, file unchanged.
- `runMigrations` applies a temporary fake `MIGRATIONS` chain end-to-end (inject for the test).
- Keep coverage thresholds green (lines 85 / branches 75 / functions 85 / statements 85).
  Use a temp dir / mocked path so tests never write the real `customization.json`.

## Docs to update

- New ADR `docs/adr/0009-runtime-customization-store.md` (Context/Decision/Consequences): why a
  runtime JSON store + code-as-defaults supersedes the dev-only TS-rewrite path of
  [[../adr/0005-pixel-pet-sprite-system]]; include the schema-versioning + migration strategy
  (or split into `0010-customization-schema-versioning` — record the choice in [[TRACKER]]).
- `docs/ARCHITECTURE.md`: add the customization store as a component (sibling of runtime-config).
- [[TRACKER]]: mark P1 ✅, log the schema-version baseline and char-assignment strategy.

## Verification

- `npm run format && npm run lint && npm run typecheck && npm test` green.
- Manually: write a tiny scratch script (or a test) that calls `loadCustomization()` and prints
  `schemaVersion` + palette length; delete the scratch file after.
- Confirm `git status` shows no stray `customization*.json` committed.

## Handoff notes

- Phase 2 will make `draw.ts` read from the store via a new `active.ts`. Leave `loadCustomization()`
  as the single entry point it will call at startup.
- Record in [[TRACKER]] the exact `CONFIG_PATH` and backup filenames so later phases reference them.
