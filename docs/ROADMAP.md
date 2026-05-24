# Roadmap

Phased delivery plan. Each phase has an **exit gate** — a concrete, verifiable
condition that must be true before the next phase starts. The gates exist
because the riskiest part of this project (BLE to a specific cheap device) is
at the very bottom of the stack, so we prove it first and build upward.

Do not work on a phase whose predecessor's gate is not met.

---

## Phase 0 — Walking skeleton (hardware validation)

**Goal:** prove that we can light up the *physical* panel from a script at all.
No project code yet — this is pure validation of the third-party library against
our specific device.

**Tasks**
- Clone `markusressel/idotmatrix-api-client` somewhere outside this repo.
- Install it (Python 3 + virtualenv + `poetry install`).
- Grant the terminal the macOS Bluetooth permission
  (System Settings → Privacy & Security → Bluetooth).
- Run the library's `example.py` with `ScreenSize.SIZE_32x32`.
- Resolve the macOS UUID-instead-of-MAC issue: discover the device by name
  (`IDM_32*32_9362`) rather than a hardcoded MAC address.
- Make the panel show *anything* — text, a brightness change, a solid color.

**Exit gate:** the real panel visibly changes in response to a command run from
the terminal. Write down in `docs/DEVELOPMENT.md` exactly which command worked
and how the device was addressed (UUID handling).

**If this gate fails:** STOP. The chosen library does not drive this specific
firmware. Do not proceed. Options: try another fork, capture the protocol, or
reconsider the device. Record the failure and findings as an ADR.

---

## Phase 1 — Sidecar as a service

**Goal:** wrap the proven Python path in a tiny local HTTP service so the rest
of the system never has to think about Bluetooth again.

**Tasks**
- Create `sidecar/` (Python, FastAPI or Flask).
- One endpoint: `POST /display` accepting a 32×32 PNG (see ADR-0002 for the
  exact contract).
- Endpoint decodes the PNG and pushes it to the panel via the library.
- Add `GET /health` returning connection status.
- Handle the connection lifecycle (connect once, reuse, reconnect on drop).

**Exit gate:** `curl -F file=@test32.png http://localhost:PORT/display` puts that
image on the physical panel. Bluetooth is now a black box behind HTTP.

---

## Phase 2 — TypeScript core (no hardware)

**Goal:** the weather→image pipeline in TS, tested entirely against PNG files on
disk. The panel is not involved in this phase.

**Tasks**
- Init Node.js + TypeScript project under `src/`.
- `weather/` module: fetch current weather from Open-Meteo for the configured
  coordinates (see ADR-0003). Cache; normalize to an internal `WeatherSnapshot`.
- `render/` module: turn a `WeatherSnapshot` into a 32×32 RGB buffer, then a PNG
  (see ADR-0004 for the rendering approach). Write the PNG to disk.
- A dev script that fetches weather and dumps `out.png` so you can eyeball it.

**Exit gate:** running the dev script produces a readable 32×32 weather PNG on
disk (icon + temperature). Verified by looking at the file, not the panel.

---

## Phase 3 — Wire it together (MVP)

**Goal:** end-to-end automated loop. This is the actual MVP.

**Tasks**
- `transport/` module in TS: `POST` the rendered PNG to the sidecar's `/display`.
- `scheduler/`: every N minutes → fetch weather → render → send.
- A single entry point that starts the loop.
- Minimal config (coordinates, interval, sidecar URL).

**Exit gate:** start the sidecar, start the TS app, and the panel updates with
current weather on its own on the configured interval.

---

## Phase 4 — Polish (complete 2026-05-24)

- **No-flash rendering** — replaced `upload_image_file` (clears screen on every
  frame) with `graffiti.set_pixels()` diff: only pixels that changed since the
  last frame are sent over BLE. Typical update at steady weather: 0 pixels sent.
  First frame after connect: ~215 pixels (full scene vs. unknown screen state).
- **Dev tooling** — `npm run dev` starts sidecar + TS together with a single
  command; both processes hot-reload on file save (uvicorn `--reload` for Python,
  `tsx watch` for TypeScript); TS no longer crashes if sidecar isn't ready yet.
- **Clean dependency** — `idotmatrix` library now installed directly from GitHub
  at a pinned commit inside the sidecar venv; no external checkout or hardcoded
  absolute paths required.
- **BLE retry + backoff** — `_ensure_connected()` retries up to 4 times with
  delays of 2 s, 5 s, 15 s. On write failure the client handle is reset so the
  next `/display` request triggers a fresh reconnect automatically.
- **`.env` config** — coordinates, interval, sidecar URL, and brightness values
  are now read from a `.env` file via `process.loadEnvFile()`. Copy
  `.env.example` and edit as needed; the file is gitignored.
- **Background service** — `scripts/start.sh` + `scripts/com.idotmatrix.weather.plist`
  run both processes as a macOS Login Item via launchd. Install with
  `npm run service:install`; tail logs with `npm run service:logs`.

**Deferred to future work**
- ~~Animations / multi-frame display~~ — implemented in Phase 5.

---

---

## Phase 5 — Animations & pixel pet (complete 2026-05-24)

- **Per-weather animations** — each of the 9 weather icon types now renders a
  looping multi-frame animation instead of a static image. The main loop drives
  a continuous `while(true)` cycle that advances frames and refreshes weather
  every 10 minutes in the background.
  - `clear-day` (8 frames): sun rays rotate clockwise as a sweeping cluster
  - `clear-night` (6 frames): 4 stars twinkle independently
  - `partly-cloudy` (8 frames): sun brightness pulses, cloud drifts ±1 px
  - `cloudy` (8 frames): cloud sways ±1 px horizontally
  - `fog` (8 frames): dashed fog lines scroll right
  - `rain` (8 frames): 3 rain drops fall with staggered phases
  - `heavy-rain` (8 frames): 6 drops, faster cycle
  - `snow` (12 frames): 5 cross-shaped flakes fall with horizontal drift
  - `thunder` (10 frames): dark cloud flashes bright on frames 6-7
- **Pixel pet** — a 5-wide Bengal-coloured pixel cat overlaid on every frame.
  Behaviours: walk (2-frame cycle, bounces at edges), sit (tail curled in sprite,
  eye blink), lie (squishes down, tail wags), jump (4-frame arc), perch (arcs
  up to temperature-text level, walks across it, arcs back down). Dims at night.
  See ADR-0005 and ADR-0006 for sprite system and state-machine design.

---

## Phase 6 — Refactor, tests, browser simulator (planned)

See `docs/PHASE6-PLAN.md` for the full plan. Key items:

- **Refactor** `advancePet` into per-behavior handler functions (cognitive
  complexity currently ~55; target ≤15 per function).
- **Unit tests** — Vitest covering all state-machine transitions and the
  specific regression cases from Phase 5 (perch oscillation bug, etc.).
- **Browser simulator** (`dev/simulator.html`) — renders the 32×32 scene on a
  scaled canvas with weather/pet controls; no panel or BLE required for visual
  iteration.

## Phase dependency at a glance

```
Phase 0  ──gate──▶  Phase 1  ──gate──▶  Phase 2  ──gate──▶  Phase 3  ──▶  Phase 4
(hardware)         (sidecar)          (TS render)         (MVP loop)    (polish)
```

The gate after Phase 0 is the project's make-or-break point. Everything else is
ordinary software work once the panel responds.
