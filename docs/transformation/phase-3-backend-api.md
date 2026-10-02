# Phase 3 — Backend API for customization + version

> Read [[README]] + [[PROTOCOL]] first. Exposes the store over HTTP and hot-swaps the live render
> state on save. Replaces the dev-only Vite-middleware save path for production use.

## Objective

Add real HTTP endpoints so the Studio can read/write customization against the running backend (in
production, not just `dev:sim`), with live hot-swap (no restart), plus a version endpoint that
surfaces the app version and schema version to the UI.

## Depends on

**Phase 1** (store) and **Phase 2** (`setActiveCustomization` hot-swap hook).

## Context & seams

- `src/control.ts`: route handlers `routeControl*`; helpers `readBody(req)` and `json(res, status,
  data)`; existing routes set `Access-Control-Allow-Origin: *`. SSE for `/api/state` & `/api/frame`.
  The request dispatcher matches `req.url` / `req.method` — follow the existing matching style.
- Store API from Phase 1: `loadCustomization`, `saveCustomization`, `resetCustomization`,
  `CURRENT_SCHEMA_VERSION`.
- Render hot-swap from Phase 2: `setActiveCustomization`.
- App version: read `version` from `package.json` (currently `0.1.0`). Import via a small helper
  (read the file once at startup, or import the JSON) — keep it ESM-safe.

## Tasks

- [ ] `GET /api/customization` → `200` with the current `Customization` (incl. `schemaVersion`).
- [ ] `PUT /api/customization` → parse body (partial `Customization` patch: any of `palette`,
  `sprites`, `behavior`, `scene`), **validate**, `saveCustomization(patch)`, then
  `setActiveCustomization(loadCustomization())` to hot-swap. Return the saved value. On invalid
  input → `400` with a clear message (do not write).
- [ ] `POST /api/customization/reset` → `resetCustomization()` + hot-swap, return defaults.
- [ ] `GET /api/version` → `{ app: <package.json version>, schema: CURRENT_SCHEMA_VERSION }`.
- [ ] Keep the **dev-only "export to code"** path: leave the `vite.config.ts` `/save-sprites` &
  `/save-pet-config` plugins in place (now optional, for committing nice defaults), or move the
  generation into a dev-gated backend route — record the choice in [[TRACKER]]. Do **not** make
  production depend on it.
- [ ] Ensure the render loop picks up the swapped active state on the next frame (no caching that
  outlives the swap).

## Acceptance criteria

- `PUT` with a new swatch + a sprite using it persists to `customization.json` and the very next
  `/api/frame` reflects it **without restarting** the process.
- Restarting the process preserves the change (proves the production persistence path).
- `POST /reset` returns the panel to code defaults (regression-identical render) and clears the file.
- `GET /api/version` returns both versions; `GET /api/customization` includes `schemaVersion`.
- Invalid `PUT` bodies return `400` and leave the file unchanged.

## Tests to add

- `src/control.test.ts` extensions (it already exists): GET/PUT/POST round-trips against an
  in-memory/temp store; `PUT` triggers `setActiveCustomization` (spy); invalid body → 400, no write;
  `/api/version` payload shape.
- Coverage thresholds stay green.

## Docs to update

- `docs/SPEC.md`: new endpoints in the API surface.
- `docs/RUNBOOK.md`: how to inspect/reset customization via the API; note `customization.json`.
- `docs/ARCHITECTURE.md`: Studio→backend save path (replacing dev-only TS rewrite for production).
- The Phase-1 ADR: add the API as the production write path.
- [[TRACKER]]: P3 ✅; record export-to-code decision.

## Verification

- `npm run dev`; with `curl`:
  - `curl localhost:3000/api/version`
  - `curl localhost:3000/api/customization | jq .schemaVersion`
  - `PUT` a recolored palette, watch `/api/frame` (or the UI preview) change live, then
    `cat customization.json`.
  - `POST /api/customization/reset`, confirm revert.
- `npm test` green (including regression for defaults).

## Handoff notes

- Phase 4 (Studio) consumes exactly these endpoints and drops `/save-sprites`/`/save-pet-config`
  POSTs. Keep response shapes stable and documented in [[TRACKER]] for the frontend agent.
