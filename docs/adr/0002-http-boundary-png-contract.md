# 0002 — HTTP boundary with PNG as the wire format

- **Status:** Accepted
- **Date:** 2026-05-24

## Context

ADR-0001 splits the system into a TypeScript app and a Python sidecar. They need
a way to talk. Options for the boundary: a child-process stdin/stdout pipe, an
FFI binding, or a local network protocol. And a payload format: raw pixel bytes,
a custom binary struct, or a standard image format.

## Decision

**Transport:** a minimal **local HTTP** API exposed by the sidecar.
- `POST /display` — body is a **32×32 PNG**; the sidecar decodes it and pushes it
  to the panel. Returns success/failure.
- `GET /health` — reports whether the sidecar currently holds a panel connection.

**Payload:** the rendered frame is a **PNG**, not raw pixels or a custom format.

## Consequences

- **Easier:** each side runs, restarts, and is tested independently. The sidecar
  is verifiable with `curl` alone.
- **Easier:** PNG is self-describing (dimensions and color are baked in), so the
  contract can't drift on pixel layout; it's trivially inspectable on disk; and
  the TS renderer's internal buffer representation stays private.
- **Harder / costs:** PNG encode on the TS side and decode on the Python side —
  negligible at one frame per few minutes.
- **Constraint:** the image is exactly 32×32. The sidecar should reject other
  sizes rather than silently rescaling, to catch renderer bugs early.
- The port is a config value shared by both sides (see ADR/roadmap config notes).
