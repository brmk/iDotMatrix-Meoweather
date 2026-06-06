# Architecture

> See [[SPEC]] for the one-page system overview and navigation table.

## Overview

The system is split across a **language boundary** that exists for one reason:
the iDotMatrix BLE protocol is undocumented and only exists as a
reverse-engineered Python library. We keep that risk isolated in a small Python
sidecar and do everything else in TypeScript.
→ [[adr/0001-language-split-ts-python-sidecar]]

```
┌──────────────────────────── local host (awake, in BLE range) ───────────────────────────┐
│                                                                                          │
│   Open-Meteo API                                                                         │
│        │  HTTPS                                                                          │
│        ▼                                                                                  │
│   ┌─────────────────────────── Node.js / TypeScript ───────────────────────────┐        │
│   │  weather/   → WeatherSnapshot                                               │        │
│   │  render/    → 32×32 RGB buffer → PNG                                        │        │
│   │  scheduler/ → every N minutes                                              │        │
│   │  transport/ → POST PNG ────────────────┐                                   │        │
│   └─────────────────────────────────────────┼───────────────────────────────────┘        │
│                                              │  HTTP (localhost): POST /display (PNG)     │
│                                              ▼                                            │
│   ┌─────────────────────────── Python sidecar (bleak) ─────────────────────────┐        │
│   │  FastAPI: /display, /health                                                │        │
│   │  idotmatrix-api-client → host BLE stack                                   │        │
│   └─────────────────────────────────────────┬───────────────────────────────────┘        │
│                                              │  BLE GATT (~20-byte packets, chunked)      │
│                                              ▼                                            │
│                                   iDotMatrix 32×32  (IDM_32*32_9362)                      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Components

### customization/ (TypeScript)

Versioned runtime store for panel customization (palette, sprites, behavior). Persists to
`customization.json` next to `runtime.json`. Code constants in `render/pet/colors.ts`,
`sprites.ts`, and `pet/config.ts` remain as fallback defaults — the store deep-merges loaded
values over them so missing fields are always filled. Schema versioned at `CURRENT_SCHEMA_VERSION`
with a forward migration runner; tolerant of missing, corrupt, or future-version files (defaults
returned in all failure modes, never throws). Consumed by the renderer starting Phase 2.
→ [[adr/0009-runtime-customization-store]]

### weather/ (TypeScript)
Fetches current conditions from Open-Meteo, caches the response, and maps it to
an internal `WeatherSnapshot` (temperature, condition code, day/night). Nothing
downstream knows or cares which API was used.

### render/ (TypeScript)
Pure function: `WeatherSnapshot → PNG (32×32)`. No I/O beyond writing the file.
This is the only component with a real design challenge (drawing legibly on
1024 pixels) and the only one worth iterating on visually. It must be testable
without any hardware — given a snapshot, it produces a file you can open.

The render subsystem is now split by concern rather than kept in a single file:

- `render/canvas.ts` — low-level buffer primitives and display dimensions
- `render/icons/` — icon contracts, palettes, geometry/effects, registry wiring,
  and weather-code mapping
- `render/text/` — glyph data, width measurement, and explicit text layout/draw
  helpers
- `render/pet/` — pet palettes, sprite parsing/cache, behavior draw resolution,
  and final overlay drawing. `render/pet/active.ts` holds the runtime-active
  customization (sprites, day/night palette, dream color, fade ramps, behavior
  config), seeded at startup from `loadCustomization()` and hot-swappable via
  `setActiveCustomization()`. The draw module reads exclusively from this holder;
  `colors.ts`, `sprites.ts`, and `pet/config.ts` are now fallback defaults only.
  → [[adr/0009-runtime-customization-store]]
- `render/scene/` — scene description, frame composition, temperature
  formatting, and night tinting
- `render/index.ts` — the stable render/PNG boundary exported to the rest of the
  app

Module imports now target these concrete files directly. Re-export-only
compatibility barrels were removed once the refactor stabilized.

### scheduler/ (TypeScript)
A plain interval loop: fetch → render → hand to transport. No cron daemon
needed for the MVP.

### control/ (TypeScript)
The local control server (`src/control.ts`) handles all HTTP traffic on port 3000. It exposes:

- **Customization API** — `GET /api/customization`, `PUT /api/customization`, `POST /api/customization/reset`, and `GET /api/version`. The `PUT` route calls `saveCustomization(patch)` then `setActiveCustomization(saved)` for a zero-restart live hot-swap; `POST /reset` calls `resetCustomization()` then hot-swaps. This is the **production write path** for the Studio; the dev-only Vite middleware (`/save-sprites`, `/save-pet-config` in `vite.config.ts`) is retained as an optional helper for committing nice default sprites/config back to source but production never depends on it.
  → [[adr/0009-runtime-customization-store]]
- **Observability** — app logs captured into a bounded in-memory `LogStore` with cursor-based snapshot reads (`GET /api/logs`) and live tail SSE (`GET /api/logs/stream`). Intentionally recent-history-only: avoids unbounded memory growth during long uptimes, does not persist across restarts, and does not include Python sidecar logs.
- **Runtime control** — behavior overrides, brightness, night hours, pause, power schedule, weather overrides.
- **Sidecar proxy** — `/api/sidecar/*` routes forwarded to Python sidecar at `config.sidecarUrl`.

### transport/ (TypeScript)
Knows the sidecar's HTTP contract (ADR-0002) and nothing about Bluetooth. Sends
the PNG, surfaces sidecar errors. This is the TS side of the language boundary.

### sidecar/ (Python)
The only component that touches Bluetooth. Wraps `idotmatrix-api-client`, owns
the connection lifecycle, exposes `/display` and `/health`. Treat it as a
sealed appliance: a PNG goes in, the panel updates.

## Deployment shape

There are now two first-class runtime envelopes:

- **macOS development runtime** — `npm run dev`, separate local processes,
  launchd helper for background running
- **Raspberry Pi production runtime** — `docker compose` stack with two images:
  `app` (TypeScript scheduler/renderer) and `sidecar` (BLE bridge)

The production compose stack is intentionally image-based. GitHub Actions builds
ARM64 images, pushes them to GHCR, and a self-hosted runner on the Pi syncs the
repo and restarts the stack. Boot-time startup is delegated to a user-level
`systemd` unit that runs `docker compose up -d`.

## Boundaries and why they exist

- **TS ↔ Python over HTTP**, not FFI or a child-process pipe, so each side can be
  run, tested, and restarted independently. The sidecar can be exercised with
  `curl` with zero TypeScript present.
- **PNG as the wire format** (not raw pixels or a custom struct) because it is
  self-describing (dimensions baked in), trivially inspectable, and decouples the
  TS renderer's internals from the sidecar.
  → [[adr/0002-http-boundary-png-contract]]
- **Render internals stay pure and deterministic.** The render pipeline is
  covered by unit tests, hash-based regression tests for representative scenes,
  and enforced global coverage thresholds in Vitest so visual drift is caught
  without hardware.
- **Production deployment stays repo-defined.** Dockerfiles, compose, deploy
  scripts, and the Actions workflow live with the app code so the Pi can be
  rebuilt from repo state instead of ad-hoc host mutations.

## Non-goals (for the MVP)

- No remote/cloud control — BLE requires physical proximity.
- No cloud control plane for the panel — deployment can be remote, but BLE still
  requires the physical host to stay near the display.
- No protocol re-implementation in TypeScript.
- No multi-device support.

## Key risks (carried from research)

1. **Device firmware variance.** "iDotMatrix 32×32 from AliExpress" is a family,
   not one model. The library may connect but mis-handle some commands. This is
   why Phase 0 validates against the *real* unit before any code is written.
2. **Linux container BLE access.** The Raspberry Pi sidecar container depends on
   host D-Bus / Bluetooth access and is less isolated than a normal web app.
3. **macOS BLE addressing.** No MAC address is exposed; discover by name.
4. **Library maintenance.** The upstream library is a single-maintainer fork
   (the original author stepped back). It works, but it is not enterprise-grade.
   Pin the version once Phase 0 succeeds.
