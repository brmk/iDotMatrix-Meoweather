# 0004 — Rendering approach for a 32×32 display

- **Status:** Accepted
- **Date:** 2026-05-24

## Context

The frame is 32×32 = 1024 pixels. That is small, but four times roomier than the
16×16 variant: at 32×32 a weather icon **and** a temperature in a real (small)
font can coexist in a single frame, which is not comfortably true at 16×16.

The renderer is the only component with a genuine design challenge, and the
classic failure mode is debugging the picture and the Bluetooth path at the same
time.

## Decision

- The renderer is a **pure transform**: `WeatherSnapshot → 32×32 RGB buffer → PNG`.
  Its only side effect is writing the PNG file. It does not know the panel exists.
- Compose **icon + temperature in one frame** as the default (e.g. condition icon
  in the upper area, temperature text below). Multi-frame alternation is deferred
  to Phase 4 and is not needed for the MVP.
- Maintain an explicit **weather-code → icon** table (driven by the Open-Meteo
  condition code from ADR-0003). Icons are simple hand-placed pixel art sized for
  32×32; keep them in a dedicated asset/module.
- Use a small pixel-friendly font for the temperature. Avoid anti-aliasing that
  smears at this resolution; prefer crisp on/off pixels.
- **Always test by opening the generated PNG**, never by sending to the panel.
  The panel is introduced only at integration (Phase 3).

Implementation library is left open (e.g. `sharp`, `canvas`, or direct buffer
manipulation) — that's an implementation detail, not an architectural decision.

## Consequences

- **Easier:** rendering is iterated visually and in isolation; hardware bugs and
  drawing bugs can never be confused.
- **Easier:** because output is a 32×32 PNG (ADR-0002), the renderer is fully
  decoupled from the sidecar.
- **Costs:** pixel art and a tiny font are fiddly handwork; budget time for
  legibility tuning.
- **Constraint:** output must be exactly 32×32; the sidecar rejects other sizes.
