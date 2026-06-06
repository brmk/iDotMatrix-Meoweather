# Transformation Plan Pack

> **Temporary work area.** This directory is a self-contained, phase-split plan that independent
> agents execute one phase at a time. It follows the `docs/*-TRACKER.md` convention in
> [[../DOCS-WORKFLOW]] (temporary status lives here; durable truth is promoted into
> `SPEC`/`ARCHITECTURE`/`RUNBOOK`/`ROADMAP`/ADRs). **Delete this whole directory when every phase in
> [[TRACKER]] is ✅ and the durable docs have been updated** (see Phase teardown).

## Mission

Turn the app from a half-configured dev tool into a cohesive, user-customizable product:

1. **Customization reaches production.** Today sprites, the color palette, and pet behavior live in
   code and are editable only via dev-only Vite middleware that rewrites TypeScript
   (`vite.config.ts` `/save-sprites`, `/save-pet-config`). Move them to a **versioned JSON file next
   to the runtime** (`customization.json`, sibling of the existing `runtime.json`), with code
   holding only fallback defaults. The Studio edits it through the real backend API, in production.
2. **Custom colors.** Replace the fixed 5-token palette (`o g s l r`) with an **extensible token
   palette** (`{ key, day, night? }[]`). Sprites stay readable ASCII rows. Night color auto-derives
   by darkening, with optional manual override.
3. **Schema versioning + migrations.** `customization.json` carries a `schemaVersion`; a forward
   migration runner upgrades older files on load. Both the **app version and schema version are
   shown in the web UI**.
4. **Cohesive, mobile-friendly UI.** Collapse the four flat tabs into **three zones — Device /
   Studio / Diagnostics** — with one always-visible live preview, and make it responsive/touch-ready.

## How to run a phase

1. Read this README, then [[PROTOCOL]] (handoff rules + quality gates), then your single phase file.
2. Confirm in [[TRACKER]] that every phase under your phase's **Depends on** is ✅.
3. Execute the phase's tasks, meet its acceptance criteria + the Definition of Done in PROTOCOL.
4. Update [[TRACKER]] and hand back per PROTOCOL.

Phases are designed to be **independently executable by a fresh agent** with no prior context beyond
this README, PROTOCOL, and the phase file.

## Phases

| # | File | Outcome |
|---|------|---------|
| 1 | [[phase-1-store-and-versioning]] | Versioned, migratable `customization.json` store (backend only, no behavior change) |
| 2 | [[phase-2-render-seam]] | Renderer reads injected sprites/colors from the store; pixel-identical to today |
| 3 | [[phase-3-backend-api]] | `GET/PUT/POST /api/customization` + `GET /api/version`, hot-swap on save |
| 4 | [[phase-4-studio-and-palette-editor]] | Studio edits via API; palette editor; version shown in UI |
| 5 | [[phase-5-ui-restructure]] | Device / Studio / Diagnostics zones + shared live preview, deduped controls |
| 6 | [[phase-6-mobile-and-touch]] | Responsive layout + touch-friendly pixel editor |
| 7 | [[phase-7-maturity-extras]] | Scene theme, weather location in store, named profiles |

## Architecture summary (the seams every agent should know)

**Data flow today:** `WeatherSnapshot` → renderer composes a 32×32 scene → `drawPet()` overlays the
cat → PNG → POST to the Python sidecar over HTTP → BLE to the panel (see [[../adr/0002-http-boundary-png-contract]],
[[../adr/0008-ble-panel-push-approach]]). The TS/Python split is fixed
([[../adr/0001-language-split-ts-python-sidecar]]) — **no phase touches BLE**.

**Where customization currently lives (all becomes fallback defaults):**
- Palette: `src/render/pet/colors.ts` — `PET_DAY`, `PET_NIGHT` (`PetColor = Record<string, Color>`),
  `PET_DREAM_COLOR`.
- Sprites: `src/sprites.ts` — `RAW_SPRITES: Record<SpriteKey, string[]>` (ASCII rows, `.` =
  transparent). Parsed by `parsePetSprites` (`src/render/pet/sprites.ts:40`, `WeakMap`-cached);
  `DEFAULT_PET_SPRITES` computed once at module load.
- Behavior: `src/pet/config.ts` — `PET_BEHAVIOR_CONFIG`.

**Render consumption (the refactor target):** `src/render/pet/draw.ts` imports `PET_DAY`/`PET_NIGHT`
directly and references keys by name — tail `colors['s']` (draw.ts:91), burp stream `colors.g`
(draw.ts:83) — and has hardcoded `PUKE_FADE_STEPS` / `POO_FADE_STEPS`. So `o g s l r` are **reserved
semantic roles** (recolorable, not removable); user swatches use other chars.

**Existing persistence pattern to mirror:** `src/runtime-config.ts` (`load/saveRuntimeConfig`,
`CONFIG_PATH = ../runtime.json`, tolerant of missing/corrupt files). The new store copies this shape.

**HTTP server:** `src/control.ts` (`routeControl*` handlers, `json()`/`readBody()` helpers, SSE for
`/api/state` and `/api/frame`). `BEHAVIOR_DUR` (control.ts:18) is a second hardcoded behavior table
that should derive from the behavior config.

**Frontend:** Vite + React in `dev/` (port 8766, `host: true`, `/api` proxied to `:3000`). Tabs in
`dev/src/App.tsx`; components `Simulator.tsx`, `Studio.tsx`, `Connection.tsx`, `LogsPanel.tsx`,
`TimeRangeClock.tsx`. Simulator + Studio duplicate weather/behavior controls.

**Tooling:** `npm test` (Vitest, coverage thresholds: lines 85 / branches 75 / functions 85 /
statements 85), PNG-hash regression in `src/render/regression.test.ts`. Quality gate:
`npm run format && npm run lint && npm run typecheck && npm test`. Run the app: `npm run dev`
(sidecar + TS + UI) or `npm run dev:sim` (UI only).
