# Roadmap

> **Phases 0–5 complete as of 2026-05-24. Phase 6 in planning — see [[PHASE6-PLAN]].**
>
> This document is the project's phase history. Each phase records its goal and
> exit gate. For the current system state, see [[SPEC]].

---

## Phase 0 — Walking skeleton (hardware validation) ✅

**Goal:** prove that we can light up the *physical* panel from a script at all.
No project code — pure validation of the third-party library against our specific
device.

**What was done:**
- Cloned `markusressel/idotmatrix-api-client` outside this repo.
- Installed it (Python 3 + virtualenv).
- Granted the terminal the macOS Bluetooth permission.
- Resolved the macOS UUID-instead-of-MAC issue: discovered the device by name
  (`IDM_32*32_9362`) rather than a hardcoded MAC address.
- Displayed a solid yellow color on the panel.

**Exit gate met:** the real panel visibly changed in response to a command run
from the terminal. See [[HISTORY]] for the exact commands and verified UUID.

---

## Phase 1 — Sidecar as a service ✅

**Goal:** wrap the proven Python path in a tiny local HTTP service so the rest
of the system never has to think about Bluetooth again.

**What was built:**
- `sidecar/` (Python, FastAPI).
- `POST /display` — accepts a 32×32 PNG, decodes it, pushes to the panel
  (see [[adr/0002-http-boundary-png-contract]]).
- `GET /health` — returns connection status.
- Connection lifecycle: connect once, reuse, reconnect on drop.

**Exit gate met:** `curl -F file=@test32.png http://localhost:8765/display` put
the image on the physical panel. Bluetooth is now a black box behind HTTP.

---

## Phase 2 — TypeScript core (no hardware) ✅

**Goal:** the weather→image pipeline in TS, tested entirely against PNG files on
disk. The panel is not involved.

**What was built:**
- `src/weather/index.ts` — fetches Open-Meteo, caches, maps to `WeatherSnapshot`
  (see [[adr/0003-weather-data-source]]).
- `src/render/index.ts` — pure function: `WeatherSnapshot → 32×32 PNG`
  (see [[adr/0004-rendering-approach-32x32]]).
- `src/dev.ts` — dev script that fetches weather and writes `out.png`.

**Exit gate met:** running the dev script produced a readable 32×32 weather PNG
on disk (icon + temperature). Verified by looking at the file, not the panel.

---

## Phase 3 — Wire it together (MVP) ✅

**Goal:** end-to-end automated loop.

**What was built:**
- `src/transport/` — POSTs rendered PNG to the sidecar's `/display`.
- `src/scheduler/` — every N minutes → fetch weather → render → send.
- Single entry point that starts the loop.
- Minimal config (coordinates, interval, sidecar URL).

**Exit gate met:** started the sidecar, started the TS app, panel updated with
current weather automatically on the configured interval.

---

## Phase 4 — Polish ✅ (complete 2026-05-24)

- **No-flash rendering** — replaced `upload_image_file` (clears screen on every
  frame) with `graffiti.set_pixels()` diff: only changed pixels are sent over
  BLE. At steady weather: 0 pixels sent.
- **Dev tooling** — `npm run dev` starts sidecar + TS together; both hot-reload
  on file save.
- **Clean dependency** — `idotmatrix` library installed directly from GitHub at a
  pinned commit inside the sidecar venv.
- **BLE retry + backoff** — `_ensure_connected()` retries up to 4 times with
  delays of 2 s, 5 s, 15 s. Auto-reconnects after write failures.
- **`.env` config** — coordinates, interval, sidecar URL, and brightness values
  read from `.env` via `process.loadEnvFile()`.
- **Background service** — `scripts/start.sh` + launchd plist run both processes
  as a macOS Login Item.

---

## Phase 5 — Animations & pixel pet ✅ (complete 2026-05-24)

- **Per-weather animations** — each of the 9 weather icon types renders a looping
  multi-frame animation instead of a static image.
  - `clear-day` (8 frames), `clear-night` (6 frames), `partly-cloudy` (8 frames),
    `cloudy` (8 frames), `fog` (8 frames), `rain` (8 frames), `heavy-rain` (8 frames),
    `snow` (12 frames), `thunder` (10 frames).
- **Pixel pet** — a 5-wide Bengal-coloured pixel cat overlaid on every frame.
  Behaviours: walk, sit, lie, jump, perch. Dims at night.
  See [[adr/0005-pixel-pet-sprite-system]] and [[adr/0006-perch-behavior-and-state-machine-lessons]].

---

## Phase 6 — Refactor, tests, browser simulator (planned)

See [[PHASE6-PLAN]] for the full plan.

---

## Phase dependency diagram

```
Phase 0  ──gate──▶  Phase 1  ──gate──▶  Phase 2  ──gate──▶  Phase 3  ──▶  Phase 4  ──▶  Phase 5
(hardware)         (sidecar)          (TS render)         (MVP loop)    (polish)      (animations)
```

The gate after Phase 0 was the project's make-or-break point. Everything else
was ordinary software work once the panel responded.
