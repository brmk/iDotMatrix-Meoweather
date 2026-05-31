# Contributing

Contributions are welcome. This document covers the things that aren't obvious from the code.

---

## Key architectural constraint

**Bluetooth code stays in `sidecar/` (Python). TypeScript never imports a BLE library.**

The iDotMatrix BLE protocol is undocumented and only exists as a reverse-engineered Python library. The sidecar is a sealed appliance: a 32×32 PNG goes in via HTTP, the panel updates. If you're working on rendering, weather, scheduling, or the control API, you never need to touch the sidecar. See [docs/adr/0001-language-split-ts-python-sidecar.md](docs/adr/0001-language-split-ts-python-sidecar.md) for the full reasoning.

---

## Iterating on weather icons

Each icon type is an independent animator in `src/render/icons/`. Adding or changing a scene means:

1. Edit the relevant file in `src/render/icons/`.
2. Run `npm run dev:sim` and switch to the **Simulator** tab — changes hot-reload instantly without hardware.
3. Run `npm test` to catch rendering regressions.

The test suite includes deterministic hash-based regression snapshots for all 9 icon types. If your change intentionally alters rendering, update the hashes:

```bash
npm run test -- --update-snapshots
```

---

## Iterating on the pixel pet

The pet's sprite frames are defined in `src/sprites.ts` as colour-coded strings. The easiest way to edit them is the **Studio** tab in the dev app:

```bash
npm run dev:sim
# Open http://localhost:8766 → Studio tab
```

Studio lets you edit individual frames pixel-by-pixel and preview them live in the simulator. Clicking **Save all** writes the changes back to `src/sprites.ts`.

To add a new behaviour:

1. Add sprite frames in `src/sprites.ts` (or via Studio).
2. Register a drawer in `src/render/pet/behaviors.ts` (`BEHAVIOR_DRAWERS`).
3. Register an advancer in `src/render/pet/advancers.ts` (`BEHAVIOR_ADVANCERS`).
4. Wire up the transition logic in `src/render/pet/state.ts`.

The state machine and advancers have unit tests in `src/render/pet.test.ts`.

---

## Hardware notes

- **Device variance** — "iDotMatrix 32×32 from AliExpress" is a family, not one model. If a sidecar command works for your device but isn't in the upstream library, open an issue with your device's Bluetooth name and firmware version.
- **macOS BLE addressing** — CoreBluetooth hides MAC addresses and assigns a per-Mac random UUID. The sidecar always discovers by name prefix (`IDM`), never by address. Don't hardcode UUIDs.
- **One BLE central at a time** — if the panel is connected to the vendor phone app, the sidecar won't find it. Disconnect the vendor app first.

---

## Code quality

Before opening a PR, run the standard verification pass:

```bash
npm run format
npm run lint
npm run typecheck
npm test
```

Coverage thresholds are enforced at 85% lines/statements and 85% functions. New behaviour or rendering logic should come with tests.

---

## Architecture decisions

Non-obvious decisions are documented as ADRs in [`docs/adr/`](docs/adr/). Read the relevant ADR before proposing a change that touches a boundary (language split, HTTP contract, PNG wire format, rendering approach, sprite system, deployment shape). If your change supersedes an ADR, update or add one.
