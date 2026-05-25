# Glossary

Short definitions of terms used across the docs and code.
For system context, see [[SPEC]].

**iDotMatrix** — A family of cheap Bluetooth LED pixel displays sold on
AliExpress and controlled by a vendor mobile app. Sizes include 16×16, 32×32,
and 64×64. This project targets the 32×32 unit.

**Panel / display / device** — The physical iDotMatrix 32×32 unit,
`IDM_32*32_9362`. Used interchangeably in the docs.

**BLE (Bluetooth Low Energy)** — The wireless protocol the panel speaks. Range
is a few meters; only one "central" (controller) can be connected at a time.

**GATT** — The BLE attribute protocol used to write data to the panel. Writes
are small (~20 bytes), so images are split into many chunks by the library.

**CoreBluetooth** — Apple's BLE stack on macOS. Notably, it hides device MAC
addresses and exposes a per-Mac random UUID instead.

**bleak** — The cross-platform Python BLE library the sidecar relies on
(through `idotmatrix-api-client`). On macOS it sits on top of CoreBluetooth.

**Sidecar** — The small Python HTTP service that owns all Bluetooth
communication. The TypeScript app talks to it over localhost HTTP.

**WeatherSnapshot** — The internal, source-agnostic representation of current
weather (temperature, condition, day/night) produced by the `weather/` module.
Decouples the rest of the app from whichever weather API is used.

**Open-Meteo** — The free, no-API-key weather data source used by this project.

**Renderer** — The `render/` module that converts a `WeatherSnapshot` into a
32×32 image (PNG). The one component with a genuine visual-design challenge.

**Exit gate** — A concrete, verifiable condition in `ROADMAP.md` that must be
true before the next phase begins.

**ADR (Architecture Decision Record)** — A short document capturing one
significant technical decision, its context, and its consequences. Lives in
`docs/adr/`.

**Walking skeleton** — Phase 0: the thinnest possible end-to-end proof that the
hardware responds, before any real code is written.
