# Agent Handoff Protocol

> Shared by every phase. Read [[README]] first, then this, then your single phase file.

## Workflow

1. **Pick up.** Confirm in [[TRACKER]] that all phases under your **Depends on** are ✅. If not,
   stop — do not start a blocked phase.
2. **Branch.** Work on a dedicated branch off `main`: `transform/phase-N-<slug>`
   (e.g. `transform/phase-1-store-and-versioning`). One phase per branch/PR.
3. **Implement.** Do the phase's tasks and nothing outside its scope. Reuse the existing patterns
   named in the phase file; do not introduce new dependencies without recording why.
4. **Meet the Definition of Done** (below) and the phase's own Acceptance criteria.
5. **Update [[TRACKER]]** — set the phase to ✅, fill in date, branch/PR, a one-line summary, and any
   deferred items or notes the next agent needs.
6. **Hand back** with: what changed, which docs you updated, verification status (ran vs pending),
   and an explicit "Phase N+1 unblocked" (or what still blocks it).

## Definition of Done (every phase)

A phase is done only when **all** of these hold:

- [ ] **Gates green:** `npm run format && npm run lint && npm run typecheck && npm test` all pass.
- [ ] **Coverage held:** Vitest thresholds still met (lines 85 / branches 75 / functions 85 /
      statements 85, see `vitest.config.ts`). New non-trivial logic ships with tests.
- [ ] **No unintended behavior change:** render-affecting phases keep
      `src/render/regression.test.ts` (PNG-hash) green. **Phase 2 must be pixel-identical** to
      pre-refactor output with default customization.
- [ ] **Docs synced in the same change** per [[../DOCS-WORKFLOW]] source-of-truth map:
      - New durable decision → an ADR under `docs/adr/` (next free number).
      - Structure/boundaries changed → `docs/ARCHITECTURE.md`.
      - "What exists now" changed → `docs/SPEC.md`.
      - Commands/workflow changed → `docs/RUNBOOK.md`.
      - Phase milestone → `docs/ROADMAP.md`.
      - This pack's status → [[TRACKER]].
- [ ] **Scope discipline:** the diff matches the phase; unrelated cleanups are out of scope.
- [ ] **Manual verification** from the phase's Verification section performed (or explicitly marked
      pending with the reason, e.g. no hardware available).

## Conventions

- **Commits:** end commit messages with the `Co-Authored-By` trailer the repo uses. Commit/push only
  when asked; otherwise leave the branch ready.
- **File I/O for config:** mirror `src/runtime-config.ts` — tolerant reads (missing/corrupt →
  defaults, never crash), pretty-printed JSON, atomic-ish single `writeFileSync`.
- **HTTP routes:** mirror `src/control.ts` `routeControl*` handlers and the `json()` / `readBody()`
  helpers; keep `Access-Control-Allow-Origin: *` consistent with existing routes.
- **TS module style:** ESM with explicit `.js` import specifiers (as the codebase already does).
- **Types:** reuse `Color`, `PetColor`, `RawPetSprites`, `SpriteKey`, `PetBehaviorConfig` from their
  existing modules — do not redefine.
- **Reserved palette roles:** `o g s l r` are structural (referenced by key in `draw.ts` and residue
  fades). They may be recolored but never removed or renamed. User swatches use other free chars.
- **Never touch BLE** (Python sidecar owns it — [[../adr/0001-language-split-ts-python-sidecar]]).
  Do not change the HTTP/PNG contract ([[../adr/0002-http-boundary-png-contract]]) or the panel-push
  strategy ([[../adr/0008-ble-panel-push-approach]]).
- **Testing renders:** verify by opening generated PNGs, never by debugging the picture and BLE path
  together ([[../adr/0004-rendering-approach-32x32]]).

## Teardown (final phase only)

After every phase is ✅ and durable docs are updated, the closing agent **deletes
`docs/transformation/`** in the same change that finalizes `docs/ROADMAP.md`, per the temporary
tracker convention in [[../DOCS-WORKFLOW]].
