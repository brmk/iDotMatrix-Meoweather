# 0008 — BLE panel push approach and rendering mode

- **Status:** Accepted
- **Date:** 2026-05-31

## Context

The sidecar pushes each rendered frame to the panel over BLE. Early implementation
used the `graffiti` module (pixel-diff per color group). As the pet animation grew
more complex we ran into visible rendering artefacts and explored alternatives.
This ADR records what was tried, why each approach failed or succeeded, and what
the current solution is.

## Approaches tried (in order)

### 1. Graffiti diff — original implementation

Send only changed pixels grouped by color via `client.graffiti.set_pixels()`.

**Problem:** each `set_pixels()` call is a separate BLE write that the panel renders
*immediately*. A typical frame diff touches 3–6 color groups, so the panel renders
3–6 intermediate states per frame. Visually: pixels in one color appear while the
old color is still visible — most noticeable as the cat's eyes "disappearing" a
frame before the new position appears.

Attempted mitigation: sort color groups so non-black pixels go first (cat appears
at new position before old position erases). Improved slightly, but the overlap
window (~15 ms per BLE round-trip × N groups) remained visible.

### 2. Graffiti with `response=False` (fire-and-forget)

Tried to reduce intermediate-state duration by sending all graffiti payloads with
`write_without_response`. Without ACK, the BLE link layer has no flow control and
the panel's receive buffer overflows silently. Result: random pixels wrong color,
cloud rendering from wrong position, stale pixels from previous frames.
**Do not use response=False for multi-packet graffiti sequences.**

### 3. `image.upload_image_pixeldata` with `set_mode` before every frame

The `ImageModule` sends all 3072 bytes (32×32×3) as a single protocol transfer;
the panel buffers the full image and renders it atomically — no intermediate states.

**Problem:** calling `client.image.set_mode(ImageMode.EnableDIY)` before every
frame clears the panel to black before the new image arrives, producing a visible
black flash on every frame (~100 ms at BLE speeds).

### 4. `image.upload_image_pixeldata` with `set_mode` once at connect ✓ (current)

Call `set_mode(ImageMode.EnableDIY)` **once** immediately after `candidate.connect()`
in `_ensure_connected`. Then each `/display` request only calls
`upload_image_pixeldata` (no mode switch). The panel stays in DIY mode, receives
the full frame atomically, and no black flash occurs.

**This is the current implementation.** Result: perfectly smooth animation with no
overlap or flicker.

## Additional optimisation — custom packet sender

`ImageModule._send_diy_image_data` calls `_send_packets(response=True)`, which
after the last BLE write also issues a `read_gatt_char`. The panel returns
`Read Not Permitted`, wasting ~20 ms per frame (one BLE round-trip).

Fix: build image packets with `client.image._create_diy_image_data_packets()` and
send them via a custom `_send_image_packets()` function that calls
`write_gatt_char(response=False)` for all packets except the last, and
`write_gatt_char(response=True)` for the last packet only (flow control ACK),
without the subsequent `read_gatt_char`.

## Brightness caching

`client.set_brightness()` was called on every frame (one BLE round-trip, ~20–40 ms).
Brightness changes only when day/night transitions. Cache in `_current_brightness`
and skip the BLE call when the value is unchanged.

## FPS ceiling

On macOS (CoreBluetooth) the BLE connection interval for this panel is ~50–100 ms.
With one `write_with_response` round-trip per frame we get **~4 FPS** regardless of
code optimisation — it is a hardware scheduling constraint of the host BLE stack,
not a software bottleneck.

On Raspberry Pi (BlueZ / Linux) connection intervals are shorter and controllable.
Expected throughput: **10–20 FPS** with the same code and no additional changes.

The TS main loop tick is `PET_TICK_MS = 50 ms` (20 FPS target). To keep the cat's
visual speed unchanged, `advancePet` is called every `PET_ADVANCE_EVERY_N_TICKS = 2`
display ticks (effective pet rate = 100 ms, same as before). Weather animation is
already decoupled from tick rate (wall-clock based), so it benefits from faster
ticks without code changes.

## GIF upload — not used

`client.gif.upload_gif_file()` can upload an animated GIF that the panel plays
natively (no per-frame BLE needed). Hard limits: 64 frames max, 2 s total duration.
The library itself notes reliability issues (second upload often fails, some frames
do not animate). Not suitable for a continuous, behavior-driven pet animation.

## Decision

Use `image.upload_image_pixeldata` with a custom packet sender (`_send_image_packets`)
and brightness caching. Call `set_mode(EnableDIY)` once after connect, never again.

## Consequences

- **No rendering artefacts** — atomic frame updates, no graffiti intermediate states.
- **No black flash** — `set_mode` is not called per-frame.
- **~20 ms saved per frame** — no spurious `read_gatt_char`.
- **~20–40 ms saved per frame** — brightness cached, BLE write skipped when unchanged.
- **FPS on macOS** remains ~4 (BLE hardware ceiling). On Pi: ~10–20 FPS.
- **Diff optimisation removed** — full 3072-byte frame sent every time. For 32×32
  the bandwidth cost is negligible compared to BLE scheduling overhead.
- **`_push_lock`** serialises frame uploads; concurrent `/display` requests wait
  rather than interleaving BLE writes (which caused the "half-black cat" bug).
