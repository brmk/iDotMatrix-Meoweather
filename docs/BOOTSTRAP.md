# Bootstrap prompt for Claude Code

Paste the block below into Claude Code **in an empty project directory**. It
instructs the agent to generate the full docs scaffold for this project before
any implementation begins. After it runs, you start real work with
`docs/ROADMAP.md` Phase 0.

This file is itself part of the scaffold (the agent recreates it too), so the
process is reproducible.

---

```
You are bootstrapping the documentation scaffold for a new home-automation
project. Do NOT write any application code yet — only create the docs structure
described below. This project will be built mostly by AI agents across separate
sessions, so the docs must be self-explanatory and encode the key decisions.

## Project summary
A small home server that drives an iDotMatrix 32×32 BLE LED pixel display
(Bluetooth name `IDM_32*32_9362`) and shows current weather on it.

## Fixed technical decisions (do not relitigate — encode them as ADRs)
1. Language split: business logic in Node.js + TypeScript; all Bluetooth in a
   separate Python sidecar using the `markusressel/idotmatrix-api-client`
   library (it supports ScreenSize.SIZE_32x32). Reason: the iDotMatrix BLE
   protocol is undocumented and only exists as a maintained Python library;
   there is no maintained TS equivalent. TypeScript must never import a BLE lib.
2. The two processes talk over local HTTP. The sidecar exposes
   `POST /display` (body = a 32×32 PNG) and `GET /health`. The wire format is
   PNG (self-describing, inspectable, decouples renderer internals).
3. Weather source is Open-Meteo (free, no API key, JSON, works from Ukraine).
   The weather module maps responses to an internal `WeatherSnapshot` type.
4. Rendering is a pure transform WeatherSnapshot → 32×32 RGB buffer → PNG, with
   icon + temperature in one frame. Always test by opening the PNG, never by
   sending to the panel. Maintain an explicit weather-code → icon table.

## Runtime constraints to document
- Host OS is macOS; BLE via CoreBluetooth/bleak.
- macOS exposes a per-Mac random UUID, NOT a MAC address — discover the device
  by name `IDM_32*32_9362`.
- The Mac must be awake and in BLE range; no cloud path.
- The terminal needs macOS Bluetooth permission or scans silently fail.
- BLE GATT writes are ~20 bytes; images are chunked by the library.

## Delivery is phased with hard exit gates (build bottom-up, riskiest first)
- Phase 0 — Walking skeleton: prove the physical panel responds to the Python
  library from the terminal. No project code. Gate: panel visibly changes.
  If the gate fails, STOP and record findings; the library may not fit this
  firmware.
- Phase 1 — Sidecar service: wrap the proven path in a FastAPI/Flask service
  with /display and /health. Gate: `curl` a PNG and it appears on the panel.
- Phase 2 — TypeScript core (no hardware): weather + render modules; produce a
  readable 32×32 weather PNG on disk. Gate: the PNG looks right on screen.
- Phase 3 — Wire together (MVP): transport + scheduler; the panel auto-updates
  every N minutes. Gate: end-to-end loop runs on its own.
- Phase 4 — Polish (optional): reconnect/backoff, multi-frame, brightness,
  config, run-on-login.

## What to create now (exact file tree)
CLAUDE.md
docs/ROADMAP.md
docs/ARCHITECTURE.md
docs/DEVELOPMENT.md
docs/GLOSSARY.md
docs/adr/0000-record-architecture-decisions.md
docs/adr/0001-language-split-ts-python-sidecar.md
docs/adr/0002-http-boundary-png-contract.md
docs/adr/0003-weather-data-source.md
docs/adr/0004-rendering-approach-32x32.md
docs/BOOTSTRAP.md   (recreate these very instructions so the process is reproducible)

## Requirements for the docs
- CLAUDE.md is the agent entry point: project summary, the one critical fact
  (don't port the protocol to TS), runtime constraints, project layout, and
  agent working rules (follow phase order, one phase per session, record ADRs,
  keep BLE in the sidecar, test rendering against PNG files).
- ROADMAP.md lists the phases above WITH their exit gates and a dependency
  diagram, and states that the gate after Phase 0 is make-or-break.
- ARCHITECTURE.md: a diagram of the data flow (Open-Meteo → TS weather → TS
  render → HTTP → Python sidecar → BLE → panel), a description of each
  component, why the boundaries exist, non-goals, and the carried risks
  (firmware variance, macOS addressing, single-maintainer library).
- Each ADR follows: title, Status, Date, Context, Decision, Consequences.
  ADR-0000 establishes the ADR process itself.
- GLOSSARY.md defines: iDotMatrix, panel, BLE, GATT, CoreBluetooth, bleak,
  sidecar, WeatherSnapshot, Open-Meteo, renderer, exit gate, ADR, walking
  skeleton.
- Create empty `sidecar/` and `src/` directories with a short `.gitkeep` or
  README noting which phase populates them.

Create all files, then print the resulting tree and stop. Do not begin Phase 0.
```

---

## After bootstrap

1. Review the generated docs (they should match this scaffold).
2. Open a fresh Claude Code session and say: *"Read CLAUDE.md and docs/ROADMAP.md.
   Let's do Phase 0."* — and only Phase 0.
3. Give the agent one phase at a time. Do not let it run ahead of the gates.
