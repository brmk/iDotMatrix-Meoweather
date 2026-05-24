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

## Phase 4 — Polish (in progress)

**Completed**
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

**Still open**
- Graceful handling of BLE disconnects with retry + backoff.
- Animations / multi-frame display.
- `.env` for coordinates and other config.
- Run as a background service on login.

---

## Phase dependency at a glance

```
Phase 0  ──gate──▶  Phase 1  ──gate──▶  Phase 2  ──gate──▶  Phase 3  ──▶  Phase 4
(hardware)         (sidecar)          (TS render)         (MVP loop)    (polish)
```

The gate after Phase 0 is the project's make-or-break point. Everything else is
ordinary software work once the panel responds.
