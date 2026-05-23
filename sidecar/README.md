# sidecar/ — Python BLE sidecar

Populated in **Phase 1** (see docs/ROADMAP.md). Owns all Bluetooth via
`markusressel/idotmatrix-api-client`. Exposes `POST /display` and `GET /health`.
TypeScript never touches this layer's concern.
