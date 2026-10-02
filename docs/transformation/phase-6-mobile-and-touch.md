# Phase 6 — Mobile-friendly layout + touch pixel editor

> Read [[README]] + [[PROTOCOL]] first. Frontend only. Makes the unified UI from Phase 5 usable on a
> phone.

## Objective

Make the app responsive (single-column under a breakpoint, sticky/collapsible preview) and make the
sprite pixel editor work by touch (paint-on-drag, explicit erase toggle instead of right-click).

## Depends on

**Phase 5** (three zones + shared `PreviewStage`).

## Context & seams

- Styling today is scattered **inline style objects** across `dev/src/**` (no CSS files). Introduce a
  small layout primitive (a CSS file imported by `dev/index.html`/`main.tsx`, or a tokens module +
  a few shared style helpers) rather than threading media queries through inline styles.
- Vite already serves with `host: true` (`vite.config.ts`), so a phone on the LAN can reach
  `http://<host-ip>:8766`. Viewport meta is already present (`dev/index.html`).
- `dev/src/components/TimeRangeClock.tsx` already uses pointer events with `touchAction: 'none'` —
  reuse that pattern for the pixel grid.
- The pixel editor currently uses left-click paint / **right-click erase** (no touch equivalent) and
  fixed 48px cells.

## Tasks

- [ ] **Responsive shell:** define one breakpoint (e.g. 720px). Below it, zones stack single-column,
  the persistent `PreviewStage` becomes a sticky collapsible header (tap to expand), navigation
  becomes a compact segmented control or bottom bar.
- [ ] **Fluid sizing:** replace hard-coded pixel widths (e.g. Studio's 372px left panel, fixed
  320×320 canvases) with fluid/`min()`-based sizing so the editor and preview scale to viewport.
- [ ] **Touch pixel editor:** pointer events with `touchAction: 'none'`; **paint-on-drag** (pointer
  down → move paints continuous cells); replace right-click erase with an explicit
  **Paint/Erase toggle** (and keep right-click as a desktop shortcut). Larger hit targets on small
  screens.
- [ ] **Controls:** ensure sliders, color pickers, and buttons are touch-sized; avoid hover-only
  affordances.
- [ ] Replace the scattered inline styles you touch with the shared primitives (don't do a
  repo-wide rewrite — scope to the zones/components involved in responsiveness).

## Acceptance criteria

- On a 390×844-ish viewport (devtools device emulation), all three zones are usable single-column;
  the preview stays accessible (sticky/collapsible); nothing overflows horizontally.
- The pixel editor paints and erases by touch (drag to paint a line); the erase toggle works; desktop
  mouse still works.
- No functionality lost vs Phase 5 on desktop.

## Tests to add

- Manual responsive verification (devtools + a real phone on the LAN). Document viewports checked.
- If a component harness exists, a smoke test that the editor's paint/erase toggle changes the active
  tool. Otherwise note manual coverage.

## Docs to update

- `docs/SPEC.md`: app is mobile-friendly; note the LAN URL for phone access.
- `docs/RUNBOOK.md`: how to open the UI on a phone (`http://<host-ip>:8766`, `host: true`).
- [[TRACKER]]: P6 ✅; record the breakpoint + viewports verified.

## Verification

- `npm run dev:sim` (or `npm run dev`); devtools device toolbar at a few widths; then load on an
  actual phone via the LAN IP and paint a sprite by touch.
- `npm run format && npm run lint && npm run typecheck && npm test` green.

## Handoff notes

- Phase 7 is optional polish; it should follow the responsive primitives established here for any new
  UI (profiles, scene theme, location).
