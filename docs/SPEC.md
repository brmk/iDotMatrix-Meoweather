# System Spec

> One-page mental model for this project. Read this after [[../CLAUDE]] to get full context.

A macOS home-server that fetches current weather from the internet and renders it
as a looping pixel animation on an iDotMatrix 32×32 LED display over Bluetooth.
The display runs autonomously — no phone app, no cloud, no interaction required.

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

- **Sprite changes go through the Studio dev app.** Run `npm run dev:sim`, open
  the Studio tab, edit and preview, click "Save sprites" → writes `src/sprites.ts`.
  → [[adr/0005-pixel-pet-sprite-system]]

---

## Data flow

```
┌─────────────────────────── macOS host (awake, in BLE range) ───────────────────────────┐
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
│   │  idotmatrix-api-client → CoreBluetooth                                     │        │
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

- Host OS: **macOS**. BLE goes through CoreBluetooth via `bleak`.
- **No visible MAC address** — CoreBluetooth exposes a per-Mac random UUID.
  Discover by name (`IDM-` prefix), never by hardcoded UUID.
- Mac must be awake and within BLE range. No cloud path; local-only.
- The terminal running the sidecar needs macOS Bluetooth permission
  (System Settings → Privacy & Security → Bluetooth). A silent "device not found"
  almost always means this permission is missing.
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

## Active work

Phase 5 complete (2026-05-24). Phase 6 planned: refactor `advancePet`, add Vitest
unit tests, build browser simulator. → [[PHASE6-PLAN]]

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
| What's next? | [[PHASE6-PLAN]] |
