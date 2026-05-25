# Architecture

> See [[SPEC]] for the one-page system overview and navigation table.

## Overview

The system is split across a **language boundary** that exists for one reason:
the iDotMatrix BLE protocol is undocumented and only exists as a
reverse-engineered Python library. We keep that risk isolated in a small Python
sidecar and do everything else in TypeScript.
→ [[adr/0001-language-split-ts-python-sidecar]]

```
┌─────────────────────────── macOS host (awake, in BLE range) ───────────────────────────┐
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
│   │  FastAPI/Flask: /display, /health                                          │        │
│   │  idotmatrix-api-client → CoreBluetooth                                     │        │
│   └─────────────────────────────────────────┬───────────────────────────────────┘        │
│                                              │  BLE GATT (~20-byte packets, chunked)      │
│                                              ▼                                            │
│                                   iDotMatrix 32×32  (IDM_32*32_9362)                      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Components

### weather/ (TypeScript)
Fetches current conditions from Open-Meteo, caches the response, and maps it to
an internal `WeatherSnapshot` (temperature, condition code, day/night). Nothing
downstream knows or cares which API was used.

### render/ (TypeScript)
Pure function: `WeatherSnapshot → PNG (32×32)`. No I/O beyond writing the file.
This is the only component with a real design challenge (drawing legibly on
1024 pixels) and the only one worth iterating on visually. It must be testable
without any hardware — given a snapshot, it produces a file you can open.

### scheduler/ (TypeScript)
A plain interval loop: fetch → render → hand to transport. No cron daemon
needed for the MVP.

### transport/ (TypeScript)
Knows the sidecar's HTTP contract (ADR-0002) and nothing about Bluetooth. Sends
the PNG, surfaces sidecar errors. This is the TS side of the language boundary.

### sidecar/ (Python)
The only component that touches Bluetooth. Wraps `idotmatrix-api-client`, owns
the connection lifecycle, exposes `/display` and `/health`. Treat it as a
sealed appliance: a PNG goes in, the panel updates.

## Boundaries and why they exist

- **TS ↔ Python over HTTP**, not FFI or a child-process pipe, so each side can be
  run, tested, and restarted independently. The sidecar can be exercised with
  `curl` with zero TypeScript present.
- **PNG as the wire format** (not raw pixels or a custom struct) because it is
  self-describing (dimensions baked in), trivially inspectable, and decouples the
  TS renderer's internals from the sidecar.
  → [[adr/0002-http-boundary-png-contract]]

## Non-goals (for the MVP)

- No remote/cloud control — BLE requires physical proximity.
- No 24/7 uptime — the Mac is the host; it runs when it runs.
- No protocol re-implementation in TypeScript.
- No multi-device support.

## Key risks (carried from research)

1. **Device firmware variance.** "iDotMatrix 32×32 from AliExpress" is a family,
   not one model. The library may connect but mis-handle some commands. This is
   why Phase 0 validates against the *real* unit before any code is written.
2. **macOS BLE addressing.** No MAC address is exposed; discover by name.
3. **Library maintenance.** The upstream library is a single-maintainer fork
   (the original author stepped back). It works, but it is not enterprise-grade.
   Pin the version once Phase 0 succeeds.
