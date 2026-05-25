# 0001 — Split languages: TypeScript app + Python BLE sidecar

- **Status:** Accepted
- **Date:** 2026-05-24

## Context

The user wants to build this in **Node.js + TypeScript**. However, the
iDotMatrix BLE protocol is **undocumented**. It exists in the wild only as
reverse-engineered code, and the mature, maintained implementation
(`markusressel/idotmatrix-api-client`, a continuation fork of
`derkalle4/python3-idotmatrix-library`) is in **Python**. It explicitly supports
`ScreenSize.SIZE_32x32`, which matches our device.

There is no equivalent maintained TypeScript/Node library. The only JS artifacts
found in research are a browser Web-Bluetooth demo (`jaku/idotmatrix`, 4 commits)
— not a usable protocol library.

Two options were considered:
- **A — Pure TypeScript:** port the protocol to TS on top of a Node BLE library
  (e.g. noble). This means re-implementing chunked GATT writes and every command
  by reading the Python source line by line, plus fighting Node BLE stack quirks.
- **B — Sidecar:** keep business logic in TS, delegate BLE to the proven Python
  library running as a separate local process.

The user stated language purity is not important ("whatever works").

## Decision

Adopt **Option B**. TypeScript owns weather, rendering, and scheduling. A small
Python sidecar owns BLE via `idotmatrix-api-client`. They communicate over a
local HTTP boundary (see ADR-0002).

## Consequences

- **Easier:** the highest-risk, least-documented work (the protocol) is reused,
  not rewritten. We stay in TypeScript for everything we actually want to build.
- **Easier:** the two halves are independently runnable and testable; the BLE
  path can be exercised with `curl` and zero TypeScript.
- **Harder / costs:** two runtimes to install and start (Node + Python venv).
  An inter-process hop adds a little latency (irrelevant for a weather display
  updating every few minutes).
- **Constraint:** TypeScript must never import a BLE library. All Bluetooth lives
  in the sidecar.
- The upstream library is GPL-3.0 and single-maintainer; pin its version after
  Phase 0 and be aware of the license if this is ever published.

## See also

- [[0002-http-boundary-png-contract]] — the HTTP boundary that results from this split
