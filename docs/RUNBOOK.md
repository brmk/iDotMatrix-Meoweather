# Runbook

> Current workflow for running, configuring, and debugging this project.
> See [[SPEC]] for system context.

---

## Start the full system (recommended for dev)

```bash
npm run dev
```

Starts sidecar + TypeScript together with colour-prefixed output (`[sidecar]` /
`[ts]`). Both processes hot-reload on file save. TS tolerates a slow sidecar
start — BLE scanning takes ~15 s on first connect.

The Dev Tools `Logs` tab shows recent **app** logs from a bounded in-memory
buffer exposed by the TypeScript control server. It is suitable for live tail
and short recent history during long runtimes, but it does not persist across
restarts and it does not include Python sidecar logs.

## Start separately (production / two terminals)

```bash
# Terminal 1
npm run start:sidecar

# Terminal 2
npm start
```

## Raspberry Pi deployment (Docker Compose)

The repo includes a production deployment path for a Raspberry Pi host running
Docker. It keeps the app as two containers:

- `app` — TypeScript scheduler / renderer
- `sidecar` — Python BLE bridge

One-time host prep on the Pi:

1. Install Docker Engine (tested with v20.10). Note: the Pi may only have
   `docker-compose` v1 — the deploy script uses that, not `docker compose` v2.
2. Add your user to the `docker` group.
3. Enable user lingering once if you want startup before login:
   ```bash
   sudo loginctl enable-linger "$USER"
   ```

Initial deployment from your local machine:

```bash
cp .env.example .env
# edit .env: set LATITUDE/LONGITUDE, APP_IMAGE, SIDECAR_IMAGE, and RPI_HOST
# RPI_HOST format: user@<ip>  e.g. brmk@192.168.31.17
# do NOT set RPI_DIR — the script defaults to $HOME/led-matrix on the Pi

bash scripts/deploy.sh
```

The script:
1. Creates `~/led-matrix/` on the Pi if it doesn't exist
2. Rsyncs `compose.rpi.yml` to the Pi
3. Copies `.env.example` to `~/led-matrix/.env` on the Pi (first run only — does not overwrite)
4. Pulls updated images from GHCR and restarts the stack

On subsequent deploys (after pushing new code to `main` and waiting for CI to build):

```bash
bash scripts/deploy.sh
```

The compose stack uses `network_mode: host` and mounts `/run/dbus` because the
BLE sidecar talks to the host Bluetooth stack through D-Bus.

## Code quality commands

```bash
npm run format      # Prettier write mode, includes import organization
npm run format:check
npm run lint
npm run lint:fix
npm run typecheck
npm test
npm run test:coverage
```

Use `format + lint + typecheck` as the default final verification pass after
TypeScript or React changes. `npm test` should be added whenever behavior or
rendering logic changed. `npm run test:coverage` enforces the project's current
global thresholds (`85%` lines/statements, `75%` branches, `85%` functions).

## Verification cadence

Use verification in phases rather than paying the full cost after every small
feedback message.

- **Draft loop** — sprite tweaks, copy tweaks, and quick visual iteration may
  skip checks entirely.
- **Targeted check** — if a small code change needs confidence, run only the
  smallest relevant command set (for example a focused test file) instead of the
  whole suite.
- **Final checkpoint** — before closing a session or calling work finalized, run
  `npm run format`, `npm run lint`, and `npm run typecheck`. Add `npm test`
  whenever behavior, rendering, or shared logic changed.

If an intermediate handoff happens before the final checkpoint, call that out
explicitly so it is clear that full verification is still pending.

## Install as background service (Login Item)

```bash
npm run service:install   # symlinks plist into ~/Library/LaunchAgents and loads it
npm run service:logs      # tail live output
npm run service:uninstall # remove the service
```

The plist lives at `scripts/com.idotmatrix.weather.plist`. launchd keeps the
service alive and restarts it (30 s throttle) on crash. Logs go to
`logs/out.log` and `logs/err.log`.

---

## One-time setup

1. **Bluetooth permission** — System Settings → Privacy & Security → Bluetooth →
   enable for the terminal app you use. Without this, BLE scans silently return
   nothing.
2. **Node dependencies** — `npm install`
3. **Sidecar venv** —
   ```bash
   cd sidecar
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```
4. **Config** — `cp .env.example .env` then edit your coordinates if needed.

---

## Config reference

| Variable | Default | Description |
|---|---|---|
| `LATITUDE` / `LONGITUDE` | 49.5535 / 25.5948 | Your coordinates |
| `INTERVAL_SECONDS` | 600 | How often to fetch + render + push |
| `SIDECAR_URL` | `http://127.0.0.1:8765` | Local sidecar address |
| `SCAN_TIMEOUT` | `15` | BLE discovery timeout for the Python sidecar |
| `DEVICE_NAME_PREFIX` | `IDM` | BLE name prefix to match during discovery |
| `DAY_BRIGHTNESS` | 80 | Panel brightness when `isDay = true` (0–100) |
| `NIGHT_BRIGHTNESS` | 25 | Panel brightness at night (0–100) |

All variables have hard-coded fallbacks; `.env` is optional.

---

## Customize colors and sprites in the Studio

The Studio tab in the Dev Tools UI (`npm run dev`) is the production surface for
editing palette colors, sprite pixel art, and pet behavior config.

1. Run `npm run dev` (full stack — both backend API and frontend must be running).
2. Open `http://localhost:8766` and click **Studio**.
3. Edit sprites by clicking the frame tabs and painting on the pixel grid.
4. Edit palette colors in the **PALETTE** panel: change day/night colors, add custom
   swatches, or remove unused ones. Reserved roles (`o g s l r`) can be recolored
   but not removed.
5. Edit behavior probabilities and durations in the behavior panels.
6. Click **Save all** (header) to persist via `PUT /api/customization`.
   The live render hot-swaps immediately — no restart needed.
7. Click **Discard** to reset to the last saved defaults (`POST /api/customization/reset`).

> `npm run dev:sim` (UI only) can render the Studio preview but cannot save —
> `PUT /api/customization` requires the backend. Use `npm run dev` for editing.

The persisted file is `customization.json` at the project root (sibling of
`runtime.json`). It is gitignored — user data, not source. To commit updated
code defaults, export the designed sprites/palette back to the source files via
the dev-only `/save-sprites` / `/save-pet-config` Vite plugin helpers (dev
environment only).

## Inspect and reset customization

```bash
# Show the current customization (palette, sprites, behavior) and schema version
curl http://localhost:3000/api/customization | jq .

# Show the app version and schema version
curl http://localhost:3000/api/version

# Apply a palette patch and hot-swap the live render (no restart needed)
curl -X PUT http://localhost:3000/api/customization \
  -H 'Content-Type: application/json' \
  -d '{"palette":[{"key":"o","day":[200,150,80]},{"key":"g","day":[100,200,100]},{"key":"s","day":[180,120,50]},{"key":"l","day":[255,220,180]},{"key":"r","day":[220,80,80]}]}'

# Reset customization to code defaults (also hot-swaps)
curl -X POST http://localhost:3000/api/customization/reset | jq .

# The persisted file (sibling of runtime.json):
cat customization.json
```

`customization.json` lives at the project root (sibling of `runtime.json`). It is gitignored — user data, not source. Missing or corrupt file → code defaults on next load. Use `POST /api/customization/reset` to delete the file and revert to defaults.

---

## Health check

```bash
curl http://localhost:8765/health
# → {"connected": true, ...}
```

Sidecar needs ~18 s after startup for the BLE scan to complete.

For the Raspberry Pi compose stack, run the same check on the host after
`docker-compose up -d`:

```bash
curl http://127.0.0.1:8765/health
```

If you see `"connected": false`, the sidecar hasn't paired yet — it retries
automatically on the first `/display` request. Check logs with:

```bash
docker logs led-matrix_sidecar_1 --tail 30
```

## Test PNG generation

Use the sidecar venv (system Python may lack Pillow):

```bash
sidecar/.venv/bin/python -c "from PIL import Image; Image.new('RGB',(32,32),(255,0,128)).save('/tmp/test32.png')"
curl -F file=@/tmp/test32.png http://localhost:8765/display
```

```bash
# Generate PNGs for all 9 icon types
./node_modules/.bin/tsx src/test-icons.ts
```

Representative render regressions are also covered automatically in the test
suite via deterministic hash assertions. They do not write image files during
normal test runs.

---

## Debugging guide

- **Panel silent, no error** — almost always the macOS Bluetooth permission, or
  the Mac is out of range / asleep.
- **"Device not found"** — confirm the panel isn't already connected to the phone
  app (BLE allows one central at a time). Disconnect the vendor app first.
- **Connects then drops** — expected occasionally over BLE; Phase 4 added
  automatic retry with backoff. No manual sidecar restart needed.
- **Pi container cannot see Bluetooth** — confirm the sidecar service is running
  with host networking, `/run/dbus` mounted, and the host Bluetooth stack is up.
- **Two sets of containers running on Pi** — if you had a previous deployment in
  a different directory (e.g. `~/apps/led-matrix-idotmatrix/`), stop it with
  `docker-compose -f ~/apps/led-matrix-idotmatrix/compose.rpi.yml down` before
  the new stack can bind port 8765 and pair BLE.
- **Image wrong on panel but `out.png` looks fine** — the problem is in the
  sidecar's PNG→panel step, not the renderer. Debug sidecar with `curl` alone.
- **Image wrong in `out.png` too** — it's the renderer; fix without the panel.

---

## Conventions

- All Bluetooth code stays in `sidecar/`. TypeScript never imports a BLE library.
- Non-obvious decisions get an ADR in `docs/adr/`, not a code comment.
- Code leaving the repo should already pass `npm run format`, `npm run lint`,
  and `npm run typecheck`.
