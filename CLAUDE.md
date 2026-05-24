# CLAUDE.md

> Entry point for any AI agent (Claude Code) working in this repository.
> Read this file first, then `docs/ROADMAP.md`, then the relevant ADRs.

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

See `docs/adr/0001-language-split-ts-python-sidecar.md` for the full reasoning.
Do not "improve" this by porting the protocol to TS unless an ADR explicitly
supersedes that decision.

## Runtime environment (fixed constraints — do not assume otherwise)

- Host OS: **macOS**. BLE goes through CoreBluetooth via `bleak`.
- On macOS the device has **no visible MAC address** — CoreBluetooth exposes a
  per-Mac random UUID instead. Discover the device by its name `IDM_32*32_9362`,
  not by a hardcoded MAC.
- The Mac must be awake and within Bluetooth range of the panel for anything to
  work. There is no cloud path; this is a local-only, presence-dependent setup.
- The terminal / process that runs the sidecar needs the macOS Bluetooth
  permission. A silent "device not found" usually means the permission was
  never granted.
- BLE GATT writes are tiny (~20 bytes per packet); images are chunked by the
  library. Do not try to send a frame in one write.

## Project layout (target state)

```
idotmatrix-weather/
├── CLAUDE.md                      # you are here
├── docs/
│   ├── ROADMAP.md                 # phased delivery plan — the build order
│   ├── ARCHITECTURE.md            # how the pieces fit together
│   ├── DEVELOPMENT.md             # how to run, test, debug locally
│   ├── GLOSSARY.md                # domain terms
│   └── adr/                       # architecture decision records
│       ├── 0000-record-architecture-decisions.md
│       ├── 0001-language-split-ts-python-sidecar.md
│       ├── 0002-http-boundary-png-contract.md
│       ├── 0003-weather-data-source.md
│       ├── 0004-rendering-approach-32x32.md
│       ├── 0005-pixel-pet-sprite-system.md
│       └── 0006-perch-behavior-and-state-machine-lessons.md
├── dev/
│   └── frames.html                # visual sprite editor (open in browser)
├── sidecar/                       # Python BLE sidecar (Phase 1)
└── src/                           # TypeScript app (Phase 2+)
```

## Testing (agent rules — read this before asking the user to run anything)

- **Run terminal commands yourself.** Do not give the user a list of commands to
  run manually — execute them directly with your tools.
- **The user validates the physical panel.** After pushing an image via the
  sidecar, tell the user what they should see on the panel and ask them to
  confirm. They will say whether it looks right.
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

1. **Follow the roadmap phase order.** Do not start a later phase before the
   earlier one is proven. `docs/ROADMAP.md` defines hard gates between phases.
2. **Phase 0 is a hardware-validation gate, not coding.** Until a real frame
   appears on the physical panel, treat all higher-level code as unproven.
3. **One phase per working session.** Do not scaffold Phase 2/3 logic while
   Phase 0/1 is unverified — that produces nice code around untested hardware.
4. **Record decisions as ADRs.** If you make a non-obvious technical choice,
   add an ADR under `docs/adr/` rather than burying it in code comments.
5. **Keep the BLE concern inside the sidecar.** TypeScript must never import a
   Bluetooth library. If you feel the urge, stop and re-read ADR-0001.
6. **Test rendering against PNG files on disk**, not against the panel. Debug
   the picture and the Bluetooth path separately, never together.
7. **Sprite changes go through `dev/frames.html` first.** Edit the ASCII grids
   there, preview in a browser, then transcribe approved frames into
   `src/render/index.ts`. See ADR-0005 for the full sprite system design.

## Status

Phase: **5 complete (2026-05-24)**. Phase 6 planned — see `docs/PHASE6-PLAN.md`.

## Known pixel-animation pitfalls (read before touching the pet)

- **Sub-phase gating:** when multiple sub-phases share a position variable
  (e.g. `perchY`), the conditions must be gated by a secondary discriminator
  (e.g. `petBehaviorDur > 0`). Relying on the position alone causes infinite
  oscillation. See ADR-0006.
- **Animation rate on 32×32:** sprite alternation faster than every 2 frames
  (~150 ms each) looks like oscillation, not movement. Slow down with
  `if (counter % 2 === 0) advance frame`.
- **Tail at non-floor baselines:** `TAIL_Y` offsets are relative to `baseY`.
  When `baseY` is high on screen (e.g. `PET_Y_PERCH = 17`), the tail lands on
  the cat's own body rows and oscillates visibly. Suppress tail during perch
  (and sit, where the tail is drawn in the sprite instead).
