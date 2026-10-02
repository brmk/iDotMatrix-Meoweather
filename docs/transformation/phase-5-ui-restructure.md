# Phase 5 — UI restructure: Device / Studio / Diagnostics + shared live preview

> Read [[README]] + [[PROTOCOL]] first. Frontend only. Makes the app feel like one product instead of
> four disconnected dev tabs. No backend changes.

## Objective

Collapse the four flat tabs (`preview / studio / logs / connection`) into **three coherent zones**
with **one always-visible live preview**, and eliminate the duplicated weather/behavior controls
that exist in both Simulator and Studio.

- **Device** — the physical panel: BLE connect/scan/pause/health (from `Connection.tsx`) **plus**
  brightness, night-hours (`TimeRangeClock`), power schedule (currently in `Simulator.tsx`). Version
  footer.
- **Studio** — all customization: palette editor, sprite editor, behavior config, weather-scene
  controls (from Phase 4). The design surface.
- **Diagnostics** — logs (`LogsPanel.tsx`) + health/frame-stream status.

## Depends on

**Phase 4** (Studio components are self-contained and API-driven).

## Context & seams

- `dev/src/App.tsx`: the 4-button tab header + `StudioNavActions` save indicator. Becomes the
  3-zone shell with a persistent preview region.
- `dev/src/components/Simulator.tsx`: contains the preview canvas (local sim + `/api/frame` SSE
  remote mode), weather/behavior playback controls, and the Device-style controls (brightness,
  night-hours, power schedule). **Split it:** preview+playback → shared `PreviewStage`; panel
  controls → Device zone.
- `dev/src/components/Studio.tsx`: also has its own preview + weather/behavior controls — replace its
  bespoke copies with the shared `PreviewStage`.
- `dev/src/components/Connection.tsx`: folds into Device.
- `dev/src/components/TimeRangeClock.tsx`: reused by Device for night-hours + power schedule.

## Tasks

- [ ] **`dev/src/components/PreviewStage.tsx`** — extract the single source of preview truth:
  - remote `/api/frame` SSE when the backend is connected; local pet simulation otherwise (move the
    rAF loop + `drawPetWithSprites` usage here).
  - the shared weather + behavior playback controls (icon, temp, humidity, wind, night toggle, speed,
    force-behavior buttons) — defined **once**.
  - rendered persistently by the shell so it's visible across zones (e.g. a top/side panel).
- [ ] **Device zone** — compose `Connection` + brightness/night-hours/power-schedule controls (moved
  out of Simulator) + version footer.
- [ ] **Studio zone** — palette editor + sprite editor + behavior config + scene controls, using the
  shared `PreviewStage` for live feedback (no private preview copy).
- [ ] **Diagnostics zone** — `LogsPanel` + a small health/frame status readout.
- [ ] **Shell** (`App.tsx`) — 3-zone navigation (tabs/segmented control), persistent `PreviewStage`,
  the existing save-status indicator wired to the Studio's `saveStatus`.
- [ ] Delete now-dead duplicated control code from `Simulator.tsx`/`Studio.tsx` (Simulator may be
  fully absorbed into `PreviewStage` + Device — remove it if nothing else references it).

## Acceptance criteria

- Exactly **three** zones; no duplicated weather/behavior control implementations remain (grep for
  the old control blocks).
- The live preview is visible regardless of the active zone and reflects edits + remote frames.
- All prior functionality is reachable: BLE connect/pause, brightness, night-hours, power schedule,
  palette/sprite/behavior editing, logs, version.
- No regressions in API calls (same endpoints, just reorganized).

## Tests to add

- Primarily manual (no `dev/` test runner). If a component harness exists from Phase 4, add a smoke
  test that the shell renders all three zones and the preview mounts once. Otherwise document manual
  verification.

## Docs to update

- `docs/SPEC.md`: the UI is now Device / Studio / Diagnostics with a persistent preview; update any
  screenshots references under `docs/screenshots/` if used.
- `docs/ARCHITECTURE.md`: frontend zone structure + single `PreviewStage` source of truth.
- [[TRACKER]]: P5 ✅; note whether `Simulator.tsx` was removed or retained.

## Verification

- `npm run dev`; click through all three zones; confirm preview persists, every control works, no
  duplicate controls, no console errors.
- `npm run format && npm run lint && npm run typecheck && npm test` green.

## Handoff notes

- Phase 6 makes this responsive/touch. Build the zones with layout that's easy to make
  single-column (avoid hard-coded widths where you can; prefer a small set of layout primitives Phase
  6 can swap to a mobile breakpoint).
