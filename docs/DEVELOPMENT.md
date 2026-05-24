# Development

How to run, test, and debug this locally. Fill in the `TODO` markers as each
phase is completed — this file is also the project's running log of what
actually worked.

## Prerequisites

- macOS with Bluetooth enabled.
- Python 3 (latest) + ability to create virtualenvs.
- Node.js (LTS) + npm/pnpm.
- The physical iDotMatrix 32×32 panel powered on and within a few meters.

## macOS Bluetooth permission (do this once)

System Settings → Privacy & Security → Bluetooth → enable for the terminal app
you use (Terminal, iTerm, VS Code, etc.). Without this, BLE scans silently
return nothing and the device appears "not found".

## Phase 0 — validating the panel (no project code)

```bash
# Clone the upstream library (outside this repo)
git clone https://github.com/markusressel/idotmatrix-api-client ~/workspace/idotmatrix-api-client
cd ~/workspace/idotmatrix-api-client

# Create venv and install (poetry is not required — pip works fine)
python3 -m venv .venv
.venv/bin/pip install bleak pillow cryptography matplotlib watchdog
.venv/bin/pip install -e .

# Run the Phase 0 validation script (lives in the upstream clone)
.venv/bin/python phase0_validate.py
```

**What worked (verified 2026-05-24):**

- Script scans all BLE devices and matches on name prefix `IDM-`.
- Device BLE name: **`IDM-3B9362`**
- CoreBluetooth UUID (this Mac only): `57DFF2C9-3062-AA8B-BC50-75A0DBDE468A`
- `IDotMatrixClient(screen_size=ScreenSize.SIZE_32x32, mac_address=<uuid>)` connects successfully.
- `client.color.show_color("yellow")` lit up the panel. Gate passed.

Addressing on macOS: CoreBluetooth exposes a per-Mac random UUID — there is no
visible MAC address. Always discover by name (`IDM-`) rather than hardcoding the
UUID. The UUID above is recorded for reference but is unique to this Mac and will
differ on any other machine.

The library's built-in `discover_devices()` in `connection_manager.py` already
filters by `startswith("IDM-")`, which matches our device correctly.

## Phase 1 — running the sidecar

```bash
cd sidecar

# One-time setup — the idotmatrix library is declared in requirements.txt
# as a pinned git dependency; no separate checkout needed.
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Start the sidecar (default port 8765)
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8765
```

The sidecar scans for the panel on startup and connects automatically.
`PORT` and `SCAN_TIMEOUT` can be overridden via environment variables.

**What worked (verified 2026-05-24):**

```bash
# Health check — should show connected:true
curl http://localhost:8765/health

# Push a solid-colour 32x32 PNG — panel lights up
.venv/bin/python -c "from PIL import Image; Image.new('RGB',(32,32),(255,0,128)).save('/tmp/test32.png')"
curl -F file=@/tmp/test32.png http://localhost:8765/display
# → {"ok":true}
```

The `/display` endpoint rejects images that are not exactly 32×32.

## Phase 2 — rendering without hardware

```bash
# Install dependencies (once)
npm install

# Fetch live weather and write out.png
npm run dev

# Generate test PNGs for all icon types
./node_modules/.bin/tsx src/test-icons.ts
```

Open `out.png` (or any `test_*.png`) to verify the 32×32 rendering.
The panel is not involved in this phase.

**What was implemented (verified 2026-05-24):**

- `src/weather/index.ts` — fetches current conditions from Open-Meteo for
  Ternopil, Ukraine (lat=49.5535, lon=25.5948). Returns a `WeatherSnapshot`
  with temperature (°C, rounded integer), WMO `weatherCode`, `isDay` flag.
  Response is cached for 10 minutes; a failed fetch leaves the cache intact.
- `src/render/index.ts` — pure transform: `WeatherSnapshot → 32×32 RGB buffer → PNG`.
  Zero external dependencies; uses Node's built-in `zlib.deflateSync` to write
  valid PNG. Layout: weather icon in rows 0-17, 3×5 pixel-font temperature
  in rows 21-25. Nine icon types: clear-day, clear-night, partly-cloudy,
  cloudy, fog, rain, heavy-rain, snow, thunder.
- `src/dev.ts` — fetches live weather and writes `out.png`.
- `src/test-icons.ts` — writes one PNG per icon type for visual inspection.

The dev script output confirmed live weather fetch (code=1, 12°C, night)
and produced a valid 32×32 RGB PNG. Gate passed.

## Phase 3 — full loop

```bash
# Everything at once (recommended for dev)
npm run dev
```

This runs both the Python sidecar and the TypeScript scheduler in one terminal
with colour-prefixed output (`[sidecar]` / `[ts]`). Both processes hot-reload
on file save. The TS app tolerates a slow sidecar start — BLE scanning takes
~15 s on first connect.

For production (two separate terminals or a process manager):

```bash
# Terminal 1
npm run start:sidecar

# Terminal 2
npm start
```

Config lives in `src/config.ts`:

| Key | Default | Description |
|---|---|---|
| `latitude` / `longitude` | 49.5535 / 25.5948 | Ternopil, Ukraine |
| `intervalMs` | 600 000 (10 min) | How often to fetch + render + push |
| `sidecarUrl` | `http://127.0.0.1:8765` | Local sidecar address |
| `dayBrightness` | 80 % | Panel brightness when `isDay = true` |
| `nightBrightness` | 25 % | Panel brightness at night |

**What was verified (2026-05-24):** sidecar running, `npm start` launched, panel
updated with live weather automatically on every interval tick. Gate passed.

## Phase 4 — no-flash rendering + dev tooling

**No-flash updates (graffiti diff):**

The original `upload_image_file` path clears the display before each new frame,
causing a visible black flash. Replaced with `graffiti.set_pixels()` + frame
diff in `sidecar/main.py`:

- The sidecar stores the last rendered frame.
- On each `/display` call, only pixels that changed are sent via the graffiti
  BLE command (in batches of ≤ 255 coordinates per colour).
- At steady weather (same icon + temperature) → **0 BLE packets** sent, no
  flash, no wear on the BLE connection.
- On first connect the "previous frame" is treated as all-black, so all
  non-black pixels are sent once.

**`idotmatrix` dependency:**

`sidecar/requirements.txt` installs the library from GitHub at a pinned commit:

```
idotmatrix @ git+https://github.com/markusressel/idotmatrix-api-client.git@fbdbd6a...
```

No external checkout, no absolute paths, works on any machine.

## Debugging guide

- **Panel does nothing, no error:** almost always the macOS Bluetooth
  permission, or the Mac is out of range / asleep.
- **"Device not found":** confirm the panel isn't already connected to the phone
  app (BLE allows one central at a time). Disconnect the app first.
- **Connects then drops:** expected occasionally over BLE; Phase 4 adds retry.
  For MVP, just restart the sidecar.
- **Image looks wrong on panel but `out.png` looks fine:** the problem is in the
  sidecar's PNG→panel step, not the renderer. Keep the two concerns separate.
- **Image looks wrong in `out.png` too:** it's the renderer; fix it without the
  device attached.

## Conventions

- Keep all Bluetooth code in `sidecar/`. TypeScript never imports a BLE library.
- New non-obvious decisions get an ADR in `docs/adr/`, not a code comment.
- Pin the upstream Python library version once Phase 0 passes.
