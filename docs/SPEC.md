# System Spec

> One-page mental model for this project. Read this after [[../AGENTS]] to get full context.

A small home-server stack that fetches current weather from the internet and
renders it as a looping pixel animation on an iDotMatrix 32×32 LED display over
Bluetooth. Day-to-day development happens on macOS; the repo also ships a
Raspberry Pi deployment path based on Docker Compose. The display runs
autonomously — no phone app, no cloud, no interaction required.

---

## Hard invariants

- **BLE stays in the sidecar.** TypeScript must never import a Bluetooth library.
  The only path to the panel is `POST /display` over localhost HTTP.
  → [[adr/0001-language-split-ts-python-sidecar]]

- **PNG is the wire format.** The TS renderer produces a 32×32 PNG; the sidecar
  decodes it. No raw pixel buffers cross the HTTP boundary.
  → [[adr/0002-http-boundary-png-contract]]

- **Discover the device by name, not address.** On macOS, CoreBluetooth hides MAC
  addresses and exposes a per-Mac random UUID. Always scan for `IDM-` prefix.

- **Test rendering against PNG files, not the panel.** The visual and the
  Bluetooth paths are debugged separately, never together.

- **Palette and sprite changes go through `setActiveCustomization()`.** At
  runtime, `render/pet/active.ts` is the single source of truth for the live
  palette, sprites, and behavior config. Code constants in `colors.ts`,
  `sprites.ts`, and `pet/config.ts` are fallback defaults only; they are no
  longer read directly by the draw module.
  → [[adr/0009-runtime-customization-store]]

---

## Data flow

```
┌──────────────────────────── local host (awake, in BLE range) ───────────────────────────┐
│                                                                                          │
│   Open-Meteo API                                                                         │
│        │  HTTPS                                                                          │
│        ▼                                                                                 │
│   ┌─────────────────────────── Node.js / TypeScript ───────────────────────────┐        │
│   │  weather/   → WeatherSnapshot                                               │        │
│   │  render/    → 32×32 RGB buffer → PNG                                        │        │
│   │  scheduler/ → every N minutes                                               │        │
│   │  transport/ → POST PNG ────────────────┐                                   │        │
│   └─────────────────────────────────────────┼───────────────────────────────────┘        │
│                                              │  HTTP (localhost): POST /display (PNG)    │
│                                              ▼                                           │
│   ┌─────────────────────────── Python sidecar (bleak) ─────────────────────────┐        │
│   │  FastAPI: /display, /health                                                 │        │
│   │  idotmatrix-api-client → host BLE stack                                    │        │
│   └─────────────────────────────────────────┬───────────────────────────────────┘        │
│                                              │  BLE GATT (~20-byte packets, chunked)     │
│                                              ▼                                           │
│                                   iDotMatrix 32×32  (IDM_32*32_9362)                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component responsibilities

| Component | Language | Does |
|---|---|---|
| `weather/` | TypeScript | Fetches Open-Meteo, caches, maps to `WeatherSnapshot` |
| `render/` | TypeScript | Pure function: `WeatherSnapshot → 32×32 PNG` |
| `scheduler/` | TypeScript | Interval loop: fetch → render → send |
| `transport/` | TypeScript | POSTs PNG to sidecar; surfaces errors |
| `sidecar/` | Python | Owns BLE; decodes PNG; drives the panel |

Full component detail: [[ARCHITECTURE]]

---

## Runtime constraints

- Supported dev host: **macOS**. The documented production deployment path is
  **Linux / Raspberry Pi via Docker Compose**.
- On macOS, `bleak` uses CoreBluetooth and exposes a per-Mac random UUID.
  Discover by name (`IDM-` prefix), never by hardcoded UUID.
- The host must be awake and within BLE range. No cloud path; local-only.
- On macOS, the terminal running the sidecar needs Bluetooth permission
  (System Settings → Privacy & Security → Bluetooth). A silent "device not found"
  almost always means this permission is missing.
- On Raspberry Pi, the sidecar container needs host networking and D-Bus access
  to the host Bluetooth stack.
- BLE GATT writes are ~20 bytes; the library chunks images automatically.

---

## Known failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Panel silent, no error | Missing Bluetooth permission, or Mac out of range / asleep | Grant permission; check proximity |
| "Device not found" | Panel connected to phone app (BLE: one central at a time) | Disconnect the vendor app first |
| Connects then drops | Transient BLE drop (expected) | Sidecar auto-retries with backoff; no manual restart needed |
| Image wrong on panel, `out.png` looks fine | Bug in sidecar PNG→panel step | Debug sidecar in isolation with `curl` |
| Image wrong in `out.png` too | Bug in TS renderer | Fix renderer without the panel attached |

---

## HTTP API surface

All routes are served by the Node.js control server on port 3000.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | System health (behavior, weather, brightness, schedules) |
| `GET` | `/api/state` | SSE stream of health updates (1 s tick) |
| `GET` | `/api/frame` | SSE stream of rendered frames (base64 PNG) |
| `GET` | `/api/logs` | Log snapshot (`?after=ID&limit=N`) |
| `GET` | `/api/logs/stream` | SSE log stream |
| `GET` | `/api/customization` | Current `Customization` JSON (incl. `schemaVersion`) |
| `PUT` | `/api/customization` | Patch customization (partial `{palette,sprites,behavior,scene}`); hot-swaps live render; `400` on invalid |
| `POST` | `/api/customization/reset` | Reset to code defaults; hot-swaps live render |
| `GET` | `/api/version` | `{ app: string, schema: number }` — package.json version + schema version |
| `POST` | `/api/control/behavior` | Override active behavior |
| `POST` | `/api/control/brightness` | Set day/night brightness (0–100) |
| `POST` | `/api/control/night-hours` | Set or clear night hours |
| `POST` | `/api/control/pause` | Pause/resume matrix |
| `POST` | `/api/control/power-schedule` | Set or clear power-off schedule |
| `POST` | `/api/control/weather` | Override weather snapshot |
| `POST` | `/api/control/weather/clear` | Clear weather override |
| `GET/POST` | `/api/sidecar/*` | Proxy to Python sidecar |

→ [[adr/0009-runtime-customization-store]]

---

## Current state

Phase 3 (Backend API) is complete (2026-06-06). Phase 6 post-phase pet enhancements (2026-05-25):

- **`poo` behavior** — new sprite pair (POO_A/POO_B, squatting pose), brown
  fading floor residue, registered in `BEHAVIOR_ADVANCERS`.
- **Multiple scene items** — `PetState` no longer holds single `pukeX/Y/TTL`
  and `pooX/Y/TTL` scalars. Both are now `pukeItems: SceneItem[]` and
  `pooItems: SceneItem[]` (each `{ x, y, ttl }`). Every burp/poo event pushes
  a new independent item; items tick and expire individually.
- **Night-walk oscillation fix** — the old logic forced `facingRight` every
  frame based on absolute position, causing a 24↔25 oscillation. Now direction
  only flips when `x >= 25`; otherwise the current direction is preserved.
- **Dream bubbles** — made more compact: 1 px vertical step (was 2 px), max 3 px
  above base (was 6 px).
- **Behavior balance** — day walk chance raised to ~47% (perch reduced from 50%
  to 18%); night rest-weighted with dream at 50%, lie at 20%, walk ~19%.
- **Studio robustness** — `CODE_BEHAVIOR_CONFIG` snapshot prevents
  `syncBehaviorConfigRuntime` mutations from poisoning `defaultBehaviorConfig()`;
  `mergeWithDefaults` fills missing localStorage keys from code defaults;
  `vite.config.ts` generators updated for BURP/POO sprites and residue TTL fields.
- **Deployment path** — the repo now includes Raspberry Pi deployment assets:
  `Dockerfile.app`, `Dockerfile.sidecar`, `compose.rpi.yml`, deploy scripts, and
  a GitHub Actions workflow for compose-based rollout via a self-hosted runner.

---

## Navigation

| Question | Read |
|---|---|
| Why TS + Python sidecar? | [[adr/0001-language-split-ts-python-sidecar]] |
| What is the HTTP contract? | [[adr/0002-http-boundary-png-contract]] |
| Why Open-Meteo? | [[adr/0003-weather-data-source]] |
| How does 32×32 rendering work? | [[adr/0004-rendering-approach-32x32]] |
| Sprite system design? | [[adr/0005-pixel-pet-sprite-system]] |
| Pixel animation bugs to avoid? | [[adr/0006-perch-behavior-and-state-machine-lessons]] |
| Full component diagram? | [[ARCHITECTURE]] |
| How to run right now? | [[RUNBOOK]] |
| Why Raspberry Pi deploy uses Compose + Actions? | [[adr/0007-raspberry-pi-compose-deployment]] |
| What's next? | [[ROADMAP]] |
