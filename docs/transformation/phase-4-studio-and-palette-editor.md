# Phase 4 — Studio rewires to the API + palette editor + version display

> Read [[README]] + [[PROTOCOL]] first. First user-visible phase. Frontend only (plus consuming
> Phase 3 endpoints). UI structure unchanged here — that's Phase 5.

## Objective

Make the Studio read/write customization through the backend API (Phase 3) instead of localStorage +
the dev-only `/save-sprites` / `/save-pet-config` plugins. Add a **palette editor** for custom colors
(add/edit/remove swatches, day + optional night), drive the sprite grid from the **dynamic palette**,
and show the **app + schema version** in the UI.

## Depends on

**Phase 3** (`GET/PUT/POST /api/customization`, `GET /api/version`).

## Context & seams

- `dev/src/components/Studio.tsx` (~1000 lines): frame tabs + pixel grid editor; palette is the
  fixed `PALETTE_KEYS = ['.', 'o', 'g', 's', 'l', 'r']` with CSS colors from `PET_DAY`; behavior
  config editor; persists to localStorage (`studio_frames`, `studio_behavior_config`) and POSTs to
  `/save-sprites` + `/save-pet-config`. Save/Discard surfaced via `StudioNavActions` to
  `dev/src/App.tsx` (header buttons).
- Replace localStorage-as-source-of-truth with the server: load on mount from
  `GET /api/customization`, save with `PUT /api/customization`. (localStorage may stay as an
  unsaved-draft cache, but the server is authoritative.)
- `dev/vite.config.ts` proxies `/api` to `:3000`, so the Studio can call the backend in `dev:sim`
  only if the backend is up; document that customization editing now needs `npm run dev` (full
  stack) — or the dev export path for code defaults.

## Tasks

- [ ] **Data layer:** a small `useCustomization` hook/module in `dev/src/` — fetch on mount, hold
  editable state, `save()` → `PUT`, `reset()` → `POST /reset`, expose `saveStatus`
  (`saved|unsaved|saving|error`) reused by the existing header indicator in `App.tsx`.
- [ ] **`dev/src/components/PaletteEditor.tsx`:**
  - List swatches with their token char, a day color picker, and an optional night picker (empty ⇒
    "auto" preview using the same darken factor as the backend `NIGHT_FACTOR` — keep them in sync;
    expose the factor from a shared constant or `/api/version`-style metadata).
  - "Add color" → append a swatch with an **auto-assigned free char** (skip reserved `o g s l r` and
    used chars; strategy recorded in [[TRACKER]]). New swatch immediately selectable in the sprite
    editor.
  - Reserved roles `o g s l r` are recolorable but show a lock (no remove/rename). User swatches are
    removable (with a guard if used by any sprite cell — offer to clear or block).
- [ ] **Sprite editor uses the dynamic palette:** replace the hardcoded `PALETTE_KEYS`/`COLOR_CSS`
  with the live palette from state; the paint toolbar lists every swatch (reserved + custom).
- [ ] **Behavior config** editor keeps working but now reads/writes the `behavior` slice of
  customization (no separate `/save-pet-config`).
- [ ] **Version display:** fetch `GET /api/version`; render a footer/badge `v{app} · schema {n}`
  (place it where it'll survive the Phase 5 restructure — a shared footer is fine).
- [ ] **Remove** the `/save-sprites` and `/save-pet-config` POSTs from the component (keep the dev
  "export to code" affordance only if it maps to a dev-gated route; otherwise drop it from the UI).

## Acceptance criteria

- Editing a sprite or palette swatch and clicking Save persists via `PUT` and the panel/preview
  updates live (proves end-to-end with Phase 3).
- Adding a custom color, painting with it, and saving round-trips through `customization.json`.
- Reserved roles cannot be removed; removing a used custom swatch is guarded.
- The UI shows the correct app + schema version.
- No remaining references to `/save-sprites` / `/save-pet-config` in the production UI path.

## Tests to add

- Frontend has no test runner configured for `dev/` today; if adding one is out of scope, cover the
  **backend** contract from Phase 3 thoroughly and verify the UI manually (document in handoff).
  If a lightweight component test harness is trivially addable (Vitest + jsdom), add focused tests
  for `PaletteEditor` char-assignment + reserved-lock logic. Record the choice in [[TRACKER]].

## Docs to update

- `docs/RUNBOOK.md`: customizing colors/sprites is now done in the Studio against `npm run dev`;
  `customization.json` is the artifact; dev "export to code" for committing defaults.
- `docs/SPEC.md`: Studio is the production customization surface.
- [[../adr/0005-pixel-pet-sprite-system]]: add a note/superseding pointer — Studio writes JSON via
  API, not TypeScript (link the Phase-1 ADR).
- [[TRACKER]]: P4 ✅; record char-assignment strategy + any frontend-test decision.

## Verification

- `npm run dev` (full stack). In the Studio: recolor `o`, add a new blue swatch, paint a few pixels,
  Save → preview + (if connected) panel update. Reload page → state persists. `POST /reset` via a
  Discard/Reset control → defaults.
- `npm run format && npm run lint && npm run typecheck && npm test` green.

## Handoff notes

- Phase 5 reshapes layout; keep `PaletteEditor`, the sprite editor, the behavior editor, and the
  version footer as **self-contained components** so Phase 5 can move them between zones without
  rewrites. Surface save/preview state through props, not internal globals.
