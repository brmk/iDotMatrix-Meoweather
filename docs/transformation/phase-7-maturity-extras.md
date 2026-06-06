# Phase 7 — Maturity extras: scene theme, location, named profiles + teardown

> Read [[README]] + [[PROTOCOL]] first. Optional polish that makes the product feel complete, and
> the **closing phase** that promotes durable docs and deletes this pack.

## Objective

Generalize customization beyond the cat and round out the product:

1. **Themeable weather scene** — expose the scene colors that are currently hardcoded.
2. **Weather location in the store** — move lat/long out of `.env`-only into customization.
3. **Named profiles** — save/load/export/import multiple customization profiles.

Then perform **teardown**: promote durable truth into the standing docs and delete
`docs/transformation/`.

## Depends on

**Phase 5** (unified UI). Phase 6 recommended (so new UI is responsive). Builds on the store
(P1–P3) and Studio (P4).

## Context & seams

- Scene colors: `src/render/colors.ts` — `WHITE`, `HUMIDITY_COLOR`, `WIND_COLOR` (and any other
  hardcoded scene/text colors). The `scene?: SceneTheme` slot already exists in the `Customization`
  schema (Phase 1).
- Location: `src/config.ts` reads `LATITUDE` / `LONGITUDE` from env (defaults Ternopil/Lviv region).
  `src/weather/index.ts` consumes them. Add a `location?: GeoCoord` slot (already in schema) that
  overrides env when present.
- Store + API + Studio data layer from earlier phases are the extension points.

## Tasks

- [ ] **Scene theme:** define `SceneTheme` (icon/text/humidity/wind colors), default from
  `src/render/colors.ts`; thread it through the scene renderer the same way the pet palette was
  injected in Phase 2; add a Studio "Scene" palette section.
- [ ] **Location:** add lat/long fields to the store; `weather/index.ts` prefers
  `customization.location` over env; Device (or Studio) gets a location field with an optional
  "use my location" helper. Changing it re-fetches weather.
- [ ] **Named profiles:** allow multiple saved customizations (e.g.
  `customization.profiles/{name}.json` or a `profiles` map in one file) with active-profile
  selection; export/import a profile as a downloadable/uploadable JSON file. Keep the migration
  runner applied on import.
- [ ] Surface residue/dream colors as editable swatches if not already (depends on Phase 2's
  palette-derived residue).

## Acceptance criteria

- Scene colors are user-editable and persist; default render unchanged when untouched (regression
  green).
- Setting a location in the UI changes the weather source without editing `.env` or restarting.
- A user can save "Default", "Blue cat", "Halloween" profiles, switch between them live, and
  export/import them; imported old-schema profiles migrate cleanly.

## Tests to add

- Scene theme resolution + default-equivalence (regression-identical for defaults).
- Location override precedence (store > env) in weather fetch (mock the HTTP call).
- Profile save/switch/export/import round-trip + migration-on-import.
- Coverage thresholds stay green.

## Docs to update (and teardown)

- `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`: final state — full customization
  surface, profiles, location, scene theme.
- Finalize the ADR(s): `docs/adr/0009-runtime-customization-store.md`
  (+ `0010-customization-schema-versioning.md` if split). Mark superseded parts of
  [[../adr/0005-pixel-pet-sprite-system]].
- `docs/ROADMAP.md`: add the completed transformation phase to the historical record.
- `.gitignore`: confirm `customization.json` + backups + any `profiles/` runtime dir are ignored.
- **Teardown:** verify [[TRACKER]] is all ✅, then **delete the entire `docs/transformation/`
  directory** in the same change as the ROADMAP finalization (per [[../DOCS-WORKFLOW]] temporary
  tracker convention).

## Verification

- `npm run dev`; edit scene colors, change location (weather updates), create/switch/export/import a
  profile; reset to defaults → regression-identical.
- `npm run format && npm run lint && npm run typecheck && npm test` green.
- Final repo check: `docs/transformation/` removed; standing docs + ADRs reflect reality; no stray
  runtime JSON committed.

## Handoff notes

- This is the last phase. After teardown there is no tracker — durable truth lives only in
  `SPEC`/`ARCHITECTURE`/`RUNBOOK`/`ROADMAP`/ADRs.
