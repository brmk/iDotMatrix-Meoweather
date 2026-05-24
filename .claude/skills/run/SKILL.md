---
description: Launch the iDotMatrix weather display app (sidecar + TypeScript)
---

# Running the app

## Full dev stack (sidecar + TS, hot-reload)

```bash
npm run dev
```

This starts both processes via `concurrently`:
- **sidecar** (cyan): `uvicorn main:app --reload` on `http://127.0.0.1:8765`
- **ts** (yellow): `tsx watch src/main.ts`

Redirect output to a log file if you need to inspect it later:

```bash
npm run dev > /tmp/idotmatrix.log 2>&1 &
sleep 5 && tail -30 /tmp/idotmatrix.log
```

## What a successful start looks like

Within ~20 s you should see:

```
[sidecar] INFO: Uvicorn running on http://127.0.0.1:8765
[sidecar] 18:xx:xx :: INFO :: Scanning for BLE device with prefix 'IDM-' (15.0s)...
[ts] Starting — sidecar http://127.0.0.1:8765
[ts] [ISO-TIMESTAMP] weather code=N temp=N°C isDay=true — N animation frames
```

The sidecar needs ~15 s for the initial BLE scan. The TS process starts
immediately and will retry the sidecar until it is ready (it does not crash on
connection failure).

## Checking the sidecar alone

```bash
curl -s http://localhost:8765/health
```

Returns `{"status":"ok","connected":true}` when connected to the panel.

## Restarting after code changes

`tsx watch` and `uvicorn --reload` hot-reload on file save, so a restart is
only needed if you changed `package.json` or `sidecar/requirements.txt`.

To kill and restart manually:

```bash
pkill -f "tsx.*main.ts"; pkill -f "uvicorn main:app"
lsof -ti :8765 | xargs kill -9 2>/dev/null
npm run dev > /tmp/idotmatrix.log 2>&1 &
```

## Prerequisites and gotchas

- `.env` must exist (copy from `.env.example`). The app has fallback defaults
  so it won't crash without it, but coordinates and brightness won't be yours.
- The **macOS Bluetooth permission** must be granted to the terminal/process.
  Without it: silent "device not found". Grant in System Settings → Privacy &
  Security → Bluetooth.
- Only one BLE central at a time. If the vendor phone app is connected, the
  sidecar can't connect. Disconnect the app first.
- The panel must be powered on and within a few meters.
