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
from contextlib import asynccontextmanager
from typing import Optional

from bleak import BleakScanner
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from idotmatrix.client import IDotMatrixClient
from idotmatrix.modules.image import ImageMode
from idotmatrix.screensize import ScreenSize
from PIL import Image

_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s :: %(levelname)s :: %(name)s :: %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("bleak").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

DEVICE_NAME_PREFIX = os.environ.get("DEVICE_NAME_PREFIX", "IDM")
SCAN_TIMEOUT = float(os.environ.get("SCAN_TIMEOUT", "15"))
EXPECTED_SIZE = 32

# Exponential backoff delays (seconds) between reconnect attempts.
RECONNECT_DELAYS = (2.0, 5.0, 15.0)

_client: Optional[IDotMatrixClient] = None
_device_address: Optional[str] = None
_device_name: Optional[str] = None
_connect_lock = asyncio.Lock()
_push_lock = asyncio.Lock()
_bg_tasks: set[asyncio.Task] = set()  # keeps fire-and-forget tasks alive until done

# Previous frame as a flat list of (r,g,b) tuples, row-major. None = unknown.
_prev_frame: Optional[list[tuple[int, int, int]]] = None
_current_brightness: Optional[int] = None


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
                await candidate.image.set_mode(ImageMode.EnableDIY)
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
    global _client, _prev_frame, _current_brightness
    if _client is not None:
        # Fire-and-forget disconnect so the OS (CoreBluetooth/BlueZ) releases the
        # connection instead of holding it until the Python object is GC'd.
        task = asyncio.ensure_future(_client._connection_manager.disconnect())
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
    _client = None
    _prev_frame = None
    _current_brightness = None


async def _send_image_packets(client: IDotMatrixClient, packets: list) -> None:
    """Send image packets with ATT write-response ACK but without the extra GATT read."""
    import time
    from idotmatrix.const import UUID_CHARACTERISTIC_WRITE_DATA
    ble = client._connection_manager.client
    total_packets = sum(len(chunk) for chunk in packets)
    for chunk in packets:
        for i, ble_packet in enumerate(chunk):
            last = i == len(chunk) - 1
            t = time.monotonic()
            await ble.write_gatt_char(UUID_CHARACTERISTIC_WRITE_DATA, ble_packet, response=last)
            ms = (time.monotonic() - t) * 1000
            logger.debug(f"  packet {i+1}/{total_packets} response={last} → {ms:.1f}ms")


async def _push_frame(
    client: IDotMatrixClient,
    new_pixels: list[tuple[int, int, int]],
) -> bool:
    """Upload full frame atomically. set_mode is called once on connect, not here."""
    import time
    global _prev_frame

    async with _push_lock:
        if new_pixels == _prev_frame:
            return False

        t0 = time.monotonic()
        pixel_data = bytearray(b for px in new_pixels for b in px)
        t1 = time.monotonic()
        packets = client.image._create_diy_image_data_packets(pixel_data)
        t2 = time.monotonic()
        await _send_image_packets(client, packets)
        t3 = time.monotonic()

        logger.info(
            f"Frame uploaded — build:{(t1-t0)*1000:.1f}ms "
            f"pack:{(t2-t1)*1000:.1f}ms "
            f"send:{(t3-t2)*1000:.1f}ms "
            f"total:{(t3-t0)*1000:.1f}ms"
        )
        _prev_frame = new_pixels
        return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await _ensure_connected()
    except Exception as exc:
        logger.exception(f"Startup connection failed: {exc}")
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


@app.get("/ble/scan")
async def ble_scan(scan_timeout: float = 8.0):
    """Scan for nearby BLE devices and return all that have a name."""
    scan_timeout = max(3.0, min(30.0, scan_timeout))
    logger.info(f"BLE scan started ({scan_timeout}s)...")
    try:
        async with asyncio.timeout(scan_timeout):
            devices = await BleakScanner.discover(return_adv=True)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="BLE scan timed out")
    except Exception as e:
        logger.exception("BLE scan failed")
        raise HTTPException(status_code=503, detail=f"BLE scan failed: {e}")

    results = []
    for address, (device, adv) in devices.items():
        name = adv.local_name or device.name or ""
        if not name:
            continue
        results.append({
            "address": address,
            "name": name,
            "is_idm": name.startswith(DEVICE_NAME_PREFIX),
            "is_connected": address == _device_address and _client is not None and _client._connection_manager.is_connected(),
        })

    results.sort(key=lambda d: (not d["is_idm"], d["name"]))
    logger.info(f"BLE scan complete — {len(results)} named devices found")
    return JSONResponse({"devices": results})


@app.post("/ble/connect")
async def ble_connect_device(body: dict):
    """Disconnect from current device and connect to the specified address."""
    global _client, _device_address, _device_name, _prev_frame

    address = body.get("address")
    name = body.get("name", address)
    if not address:
        raise HTTPException(status_code=400, detail="address required")

    async with _connect_lock:
        if _client is not None:
            try:
                await _client._connection_manager.disconnect()
            except Exception:
                pass
            _client = None
            _prev_frame = None

        _device_address = address
        _device_name = name

    logger.info(f"Connecting to {name!r} ({address}) via /ble/connect...")
    try:
        await _ensure_connected()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"ok": True, "address": address, "name": name}


@app.post("/ble/disconnect")
async def ble_disconnect():
    """Gracefully disconnect from the BLE panel and release the connection."""
    global _client, _prev_frame
    async with _connect_lock:
        if _client is not None:
            try:
                await _client._connection_manager.disconnect()
                logger.info("BLE disconnected (pause requested)")
            except Exception:
                pass
            _client = None
            _prev_frame = None
    return {"ok": True}


@app.post("/reset-frame")
async def reset_frame():
    """Forget the last-sent frame so the next /display call does a full repaint."""
    global _prev_frame
    _prev_frame = None
    logger.info("Frame state reset — next display will be a full refresh")
    return {"ok": True}


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
        global _current_brightness
        brightness = max(5, min(100, brightness))
        if brightness != _current_brightness:
            await client.set_brightness(brightness_percent=brightness)
            _current_brightness = brightness
        sent = await _push_frame(client, new_pixels)
        if sent:
            logger.info("Frame uploaded")
    except Exception as exc:
        _reset_client()  # force reconnect on next request
        logging.exception("Failed to push frame — client reset, will reconnect next request")
        raise HTTPException(status_code=502, detail=f"Panel error: {exc}")

    return {"ok": True}
