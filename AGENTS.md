# AGENTS.md

> Agent entry point. Read this first, then [[docs/SPEC]], then the relevant ADRs.

## What this project is

A small home server that drives an **iDotMatrix 32×32 LED pixel display** over
Bluetooth Low Energy (BLE) and shows the **current weather** on it.

The display is the AliExpress iDotMatrix panel, Bluetooth name `IDM_32*32_9362`.
It is normally controlled by the vendor's mobile app over BLE; this project
replaces that app with our own automated pipeline.

## The single most important architectural fact

The iDotMatrix BLE protocol is **undocumented**. It only exists as a
reverse-engineered Python library. We therefore do **NOT** re-implement the
protocol in TypeScript. Instead:

- **TypeScript / Node.js** owns all business logic (weather, rendering, scheduling).
- A thin **Python sidecar** (using `markusressel/idotmatrix-api-client`) owns the
  actual BLE communication.
- The two talk over a tiny local HTTP boundary: TS sends a rendered 32×32 PNG,
  the sidecar pushes it to the panel.

See [[docs/adr/0001-language-split-ts-python-sidecar]] for the full reasoning.
Do not "improve" this by porting the protocol to TS unless an ADR explicitly
supersedes that decision.

Runtime constraints and known failure modes: [[docs/SPEC]].

## Project layout

```
AGENTS.md          — you are here
CLAUDE.md          — Obsidian-friendly pointer to AGENTS.md
docs/              — specs, runbook, ADRs, history
dev/               — Vite + React dev app (Simulator + Studio sprite editor)
sidecar/           — Python BLE sidecar
src/               — TypeScript app
```

## Testing (agent rules)

- **Run terminal commands yourself.** Do not give the user a list of commands to
  run manually — execute them directly with your tools.
- **Finish with repo hygiene checks.** After code changes, run `npm run format`,
  `npm run lint`, and `npm run typecheck` before handing work back. If tests are
  relevant, run `npm test` too.
- **The user validates the physical panel.** After pushing an image via the
  sidecar, tell the user what they should see and ask them to confirm.
- **The sidecar must be running** before any `/display` call. Check with
  `curl -s http://localhost:8765/health` — if not running, start it:
  ```
  cd sidecar && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8765 &
  ```
  Wait ~18 s for the BLE scan to complete, then re-check health.
- **Generate test PNGs with the sidecar venv** (system Python may lack Pillow):
  ```
  sidecar/.venv/bin/python -c "..."
  ```

## How to work in this repo (agent rules)

1. **Read [[docs/SPEC]] before starting any task.** It has the system invariants,
   constraints, and navigation table.
2. **The MVP is done.** Phase 6 is complete — see [[docs/PHASE6-PLAN]] for history.
   New feature work should start with an entry in [[docs/ROADMAP]].
3. **Do not re-litigate the TS/Python split.** It works. ADR-0001 is closed.
4. **Record decisions as ADRs.** If you make a non-obvious technical choice,
   add an ADR under `docs/adr/` rather than burying it in code comments.
5. **Keep the BLE concern inside the sidecar.** TypeScript must never import a
   Bluetooth library. If you feel the urge, stop and re-read
   [[docs/adr/0001-language-split-ts-python-sidecar]].
6. **Test rendering against PNG files on disk**, not against the panel. Debug
   the picture and the Bluetooth path separately, never together.
7. **Sprite changes go through the Studio dev app.** Run `npm run dev:sim`,
   open the Studio tab, paint in the editor, click "Save sprites" — this writes
   directly to `src/sprites.ts`. See [[docs/adr/0005-pixel-pet-sprite-system]].
8. **Before touching the pixel pet or animations**, read
   [[docs/adr/0006-perch-behavior-and-state-machine-lessons]].
9. **Keep code formatter- and lint-clean.** New code must conform to
   `Prettier` and `ESLint`; do not leave style drift or unused imports behind.
10. **Documentation sync is part of delivery, not follow-up.** Read
    [[docs/DOCS-WORKFLOW]] and update the source-of-truth docs in the same
    session as the code change.
11. **If a session changes reality, update the doc that describes it.**
    Structural changes go to `ARCHITECTURE`; workflow changes go to `RUNBOOK`;
    current-state summary changes go to `SPEC`; numbered phase status changes go
    to `ROADMAP`; active multi-session work must update its tracker doc.
12. **Temporary tracker docs are mandatory when active.** If a tracker such as
    `docs/*-TRACKER.md` exists for the current workstream, update its
    status fields and session log before ending the session.
13. **Do not leave contradictory docs behind.** If one document was updated in a
    way that invalidates another, fix both in the same session.

## Status

Phase: **6 complete (2026-05-25)**. See [[docs/PHASE6-PLAN]] for what was done.
