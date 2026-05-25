# src/ — TypeScript application

Runtime code lives in `weather/`, `render/`, `pet/`, `transport/`, and the
top-level `main.ts` loop. The render subsystem is split into direct-import
modules under `render/icons/`, `render/text/`, `render/pet/`, and
`render/scene/`. No Bluetooth code ever lives here.
