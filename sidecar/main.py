"""
Python BLE sidecar for the iDotMatrix 32x32 panel.

Endpoints:
  POST /display   — accepts a 32x32 PNG (multipart field "file"), pushes to panel
  GET  /health    — returns connection status

On macOS, CoreBluetooth exposes a per-Mac UUID instead of a MAC address.
The device is discovered by BLE name prefix "IDM-" on startup.

Run:
  .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8765 --reload
"""

import asyncio
import io
import logging
import os
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Optional

from bleak import BleakScanner
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from idotmatrix.client import IDotMatrixClient
from idotmatrix.screensize import ScreenSize
from PIL import Image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s :: %(levelname)s :: %(name)s :: %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("bleak").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

DEVICE_NAME_PREFIX = "IDM-"
SCAN_TIMEOUT = float(os.environ.get("SCAN_TIMEOUT", "15"))
EXPECTED_SIZE = 32
GRAFFITI_CHUNK = 255  # max pixels per set_pixels call

# Exponential backoff delays (seconds) between reconnect attempts.
RECONNECT_DELAYS = (2.0, 5.0, 15.0)

_client: Optional[IDotMatrixClient] = None
_device_address: Optional[str] = None
_device_name: Optional[str] = None
_connect_lock = asyncio.Lock()

# Previous frame as a flat list of (r,g,b) tuples, row-major. None = unknown.
_prev_frame: Optional[list[tuple[int, int, int]]] = None


def _png_to_pixels(data: bytes) -> list[tuple[int, int, int]]:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return list(img.getdata())


async def _discover_device() -> tuple[str, str]:
    logger.info(f"Scanning for BLE device with prefix '{DEVICE_NAME_PREFIX}' ({SCAN_TIMEOUT}s)...")
    async with asyncio.timeout(SCAN_TIMEOUT):
        devices = await BleakScanner.discover(return_adv=True)

    for address, (device, adv) in devices.items():
        name = adv.local_name or device.name or ""
        if name.startswith(DEVICE_NAME_PREFIX):
            logger.info(f"Found panel: {name!r} at {address}")
            return address, name

    raise RuntimeError(
        f"No BLE device found with prefix '{DEVICE_NAME_PREFIX}'. "
        "Ensure the panel is on, in range, and not connected to another app."
    )


async def _ensure_connected() -> IDotMatrixClient:
    """Connect (or reconnect) with exponential backoff. Thread-safe via _connect_lock."""
    global _client, _device_address, _device_name, _prev_frame

    async with _connect_lock:
        if _client is not None and _client._connection_manager.is_connected():
            return _client

        _client = None  # discard stale handle before retrying
        delays = (*RECONNECT_DELAYS, None)  # None sentinel = last attempt, no sleep after
        last_exc: Exception = RuntimeError("unknown")

        for attempt, delay in enumerate(delays, start=1):
            try:
                if _device_address is None:
                    _device_address, _device_name = await _discover_device()

                logger.info(
                    f"Connecting to {_device_name!r} ({_device_address}) "
                    f"[attempt {attempt}/{len(delays)}]..."
                )
                candidate = IDotMatrixClient(
                    screen_size=ScreenSize.SIZE_32x32,
                    mac_address=_device_address,
                )
                await candidate.connect()
                _client = candidate
                _prev_frame = None  # screen state unknown after (re)connect
                logger.info("Connected.")
                return _client

            except Exception as exc:
                last_exc = exc
                logger.warning(f"Connection attempt {attempt} failed: {exc}")
                if delay is not None:
                    logger.info(f"Retrying in {delay:.0f}s...")
                    await asyncio.sleep(delay)

        raise RuntimeError(
            f"Could not connect after {len(delays)} attempts"
        ) from last_exc


def _reset_client() -> None:
    """Mark the client as dead so the next call to _ensure_connected reconnects."""
    global _client, _prev_frame
    _client = None
    _prev_frame = None


async def _push_frame_diff(
    client: IDotMatrixClient,
    new_pixels: list[tuple[int, int, int]],
) -> int:
    """Send only changed pixels via graffiti. Returns number of pixels sent."""
    global _prev_frame

    # When _prev_frame is None the panel state is unknown — send every pixel
    # unconditionally so stale content (e.g. red from a crashed session) is cleared.
    full_refresh = _prev_frame is None
    prev = _prev_frame if _prev_frame is not None else [(-1, -1, -1)] * (EXPECTED_SIZE * EXPECTED_SIZE)

    # Group changed pixels by new color
    by_color: dict[tuple[int, int, int], list[tuple[int, int]]] = defaultdict(list)
    for idx, (new_color, old_color) in enumerate(zip(new_pixels, prev)):
        if full_refresh or new_color != old_color:
            x = idx % EXPECTED_SIZE
            y = idx // EXPECTED_SIZE
            by_color[new_color].append((x, y))

    total = sum(len(v) for v in by_color.values())
    if total == 0:
        return 0

    for color, coords in by_color.items():
        # send in chunks of GRAFFITI_CHUNK
        for i in range(0, len(coords), GRAFFITI_CHUNK):
            await client.graffiti.set_pixels(color=color, xys=coords[i:i + GRAFFITI_CHUNK])

    _prev_frame = new_pixels
    return total


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await _ensure_connected()
    except Exception as exc:
        logger.error(f"Startup connection failed: {exc}")
        logger.warning("Sidecar running without panel — will retry on first /display request.")
    yield
    if _client is not None:
        try:
            await _client._connection_manager.disconnect()
        except Exception:
            pass


app = FastAPI(title="iDotMatrix sidecar", lifespan=lifespan)


@app.get("/health")
async def health():
    connected = (
        _client is not None and _client._connection_manager.is_connected()
    )
    return JSONResponse({
        "connected": connected,
        "device_name": _device_name,
        "device_address": _device_address,
    })


@app.post("/display")
async def display(file: UploadFile, brightness: int = Form(default=80)):
    data = await file.read()

    try:
        img = Image.open(io.BytesIO(data))
        w, h = img.size
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {exc}")

    if w != EXPECTED_SIZE or h != EXPECTED_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Image must be {EXPECTED_SIZE}x{EXPECTED_SIZE}, got {w}x{h}.",
        )

    new_pixels = _png_to_pixels(data)
    client = await _ensure_connected()

    try:
        brightness = max(5, min(100, brightness))
        await client.set_brightness(brightness_percent=brightness)
        changed = await _push_frame_diff(client, new_pixels)
        logger.info(f"Updated {changed} pixels")
    except Exception as exc:
        _reset_client()  # force reconnect on next request
        logging.exception("Failed to push frame — client reset, will reconnect next request")
        raise HTTPException(status_code=502, detail=f"Panel error: {exc}")

    return {"ok": True, "changed_pixels": changed}
