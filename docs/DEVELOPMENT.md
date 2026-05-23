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

# One-time setup (also installs the idotmatrix library from the Phase 0 clone)
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install -e /path/to/idotmatrix-api-client   # adjust path

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

> **TODO:** the dev script that fetches weather and writes `out.png`.

Inspect `out.png` directly. The panel is not involved in this phase. If the
image is unreadable at 32×32, iterate here, not on the device.

## Phase 3 — full loop

> **TODO:** start order (sidecar first, then TS app) and the config values.

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
