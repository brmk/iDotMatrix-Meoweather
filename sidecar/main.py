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
import tempfile
from contextlib import asynccontextmanager
from typing import Optional

from bleak import BleakScanner, AdvertisementData
from fastapi import FastAPI, HTTPException, UploadFile
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
PORT = int(os.environ.get("PORT", "8765"))
EXPECTED_SIZE = 32

_client: Optional[IDotMatrixClient] = None
_device_address: Optional[str] = None
_device_name: Optional[str] = None
_connect_lock = asyncio.Lock()


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
    global _client, _device_address, _device_name

    async with _connect_lock:
        if _client is not None and _client._connection_manager.is_connected():
            return _client

        if _device_address is None:
            _device_address, _device_name = await _discover_device()

        logger.info(f"Connecting to {_device_name} ({_device_address})...")
        _client = IDotMatrixClient(
            screen_size=ScreenSize.SIZE_32x32,
            mac_address=_device_address,
        )
        await _client.connect()
        logger.info("Connected.")
        return _client


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
async def display(file: UploadFile):
    data = await file.read()

    # Validate: must be a 32x32 image
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

    client = await _ensure_connected()

    # Write to a temp file because the library takes a file path
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        await client.image.set_mode()
        await client.image.upload_image_file(file_path=tmp_path)
    except Exception as exc:
        logger.error(f"Failed to push image to panel: {exc}")
        raise HTTPException(status_code=502, detail=f"Panel error: {exc}")
    finally:
        os.unlink(tmp_path)

    return {"ok": True}
