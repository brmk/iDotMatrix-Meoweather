# CLAUDE.md

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
CLAUDE.md          — you are here
docs/              — specs, runbook, ADRs, history
dev/               — browser tools (frames.html sprite editor, simulator)
sidecar/           — Python BLE sidecar
src/               — TypeScript app
```

## Testing (agent rules)

- **Run terminal commands yourself.** Do not give the user a list of commands to
  run manually — execute them directly with your tools.
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
2. **The MVP is done.** Current work is Phase 6 — read [[docs/PHASE6-PLAN]]
   before starting any new feature work.
3. **Do not re-litigate the TS/Python split.** It works. ADR-0001 is closed.
4. **Record decisions as ADRs.** If you make a non-obvious technical choice,
   add an ADR under `docs/adr/` rather than burying it in code comments.
5. **Keep the BLE concern inside the sidecar.** TypeScript must never import a
   Bluetooth library. If you feel the urge, stop and re-read
   [[docs/adr/0001-language-split-ts-python-sidecar]].
6. **Test rendering against PNG files on disk**, not against the panel. Debug
   the picture and the Bluetooth path separately, never together.
7. **Sprite changes go through `dev/frames.html` first.** Edit the ASCII grids
   there, preview in a browser, then transcribe approved frames into
   `src/render/index.ts`. See [[docs/adr/0005-pixel-pet-sprite-system]].
8. **Before touching the pixel pet or animations**, read
   [[docs/adr/0006-perch-behavior-and-state-machine-lessons]].

## Status

Phase: **5 complete (2026-05-24)**. Phase 6 planned — see [[docs/PHASE6-PLAN]].
