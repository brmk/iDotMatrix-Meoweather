# Refactor Tracker

> Temporary living document for the current refactor + test expansion program.
> Update this file after every meaningful work session. When the program is
> complete, delete this document and migrate the durable conclusions into
> `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`, ADRs, and module-level docs.

**Status:** In progress  
**Owner:** Shared across sessions / agents  
**Last updated:** 2026-05-25  
**Supersedes:** none  
**Related docs:** [[ROADMAP]], [[ARCHITECTURE]], [[RUNBOOK]], [[PHASE6-PLAN]]

---

## Purpose

This document is the working source of truth for the next refactor cycle.
It exists to keep parallel or handoff-based sessions aligned on:

- current target architecture
- phase/task status
- acceptance criteria
- test strategy and coverage goals
- decisions that still need durable documentation later

This is intentionally a temporary tracker, not permanent architecture
documentation.

---

## Agent update protocol

Every agent continuing this work must update this file before ending the
session if anything meaningful changed.

Minimum required updates:

1. Update `Last updated`.
2. Update the relevant phase and task statuses.
3. Add a short entry to the session log.
4. If scope changed, update the "Open questions / decisions" section.
5. If a phase was completed, verify its exit criteria are reflected here.

Status vocabulary:

- `planned` — not started
- `in_progress` — actively being worked on
- `blocked` — cannot proceed without a decision or prerequisite
- `done` — implemented and verified against exit criteria
- `deferred` — intentionally postponed

Rules:

- Do not mark a task `done` if code is changed but tests were not updated where
  the task explicitly requires tests.
- Do not delete historical entries from the session log; append only.
- If the implementation diverges from this plan, update the plan instead of
  leaving it stale.

---

## Program goals

### Primary goals

- Make the TypeScript codebase more modular and easier to reason about.
- Reduce duplication in rendering and state-management code.
- Make extension paths explicit: new weather icons, new pet behaviors, new
  render features.
- Build strong automated test coverage around pure logic and visual rendering
  invariants.
- Lower regression risk when iterating on visuals or behavior rules.

### Non-goals

- Rewriting the Python sidecar architecture.
- Changing the external weather provider unless needed for a separate feature.
- Introducing a framework or abstraction layer that is larger than the problem.
- Chasing 100% coverage at the expense of useful test quality.

---

## Target architecture

### Render module shape

```text
src/render/
  canvas.ts
  colors.ts
  types.ts

  text/
    glyphs.ts
    measure.ts
    draw.ts

  icons/
    types.ts
    palette.ts
    primitives.ts
    effects.ts
    registry.ts
    weather-map.ts
    index.ts

  pet/
    colors.ts
    sprites.ts
    behaviors.ts
    draw.ts
    index.ts

  scene/
    format.ts
    frame.ts
    animation.ts
    tint.ts
    index.ts

  index.ts
```

### Architectural rules

- Pure render logic stays free of I/O and transport concerns.
- Domain mapping logic must not be mixed with pixel geometry code.
- Shared primitives and types should live in one place, not be redefined across
  modules.
- New icons and behaviors should be added through registries, not scattered
  conditionals.
- Layout constants and color palettes should be centralized and named.

---

## Phases and tasks

## Phase 1 — Baseline types and render contracts

**Status:** done  
**Goal:** establish stable low-level types and reduce accidental API drift.

### Tasks

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| 1.1 | done | Add shared render types (`Color`, shared frame/meta types) | Render modules consume shared types instead of ad hoc tuples and repeated shapes |
| 1.2 | done | Normalize low-level canvas APIs where this improves readability | `canvas.ts` and dependent modules use a consistent parameter model |
| 1.3 | done | Remove hardcoded canvas size usage from text/layout code | Text rendering imports shared dimensions instead of duplicating `32` |
| 1.4 | done | Centralize foundational render constants | Core dimensions / layout constants have one named home |

### Exit criteria

- Shared render types exist and are used by the main render entry points.
- No new render code relies on duplicated canvas-size literals.
- Existing behavior remains unchanged.

---

## Phase 2 — Scene pipeline deduplication

**Status:** done  
**Goal:** make one frame-building path the single source of truth.

### Tasks

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| 2.1 | done | Extract `formatTemperature()` into a scene formatting helper | Temperature formatting exists in one place and is reused |
| 2.2 | done | Introduce `renderFrame(snapshot, frame)` | Static and animated rendering share the same composition path |
| 2.3 | done | Move tinting and scene helpers into focused modules | Scene orchestration is split by responsibility, not by convenience |
| 2.4 | done | Remove duplicated logic between `render()` and `renderAnimation()` | Both call shared helpers with no duplicated layout or tint logic |

### Exit criteria

- A single frame renderer exists and powers both static and animated output.
- Scene composition logic is testable without animation loops.

---

## Phase 3 — Icons modularization

**Status:** planned  
**Goal:** split weather icon rendering into composable, extensible modules.

### Tasks

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| 3.1 | planned | Extract icon types/metadata into dedicated modules | Icon contracts no longer live in a mixed implementation file |
| 3.2 | planned | Move color palette and layout constants into icon-specific modules | Magic icon values are named and centralized |
| 3.3 | planned | Split primitives from effects and registry wiring | Geometry helpers, animation effects, and registration are separate concerns |
| 3.4 | planned | Isolate weather-code mapping from icon drawing | `codeToIcon` logic lives in its own module with tests |

### Exit criteria

- `icons.ts` is no longer a monolithic implementation bucket.
- Adding a new icon requires only local, well-defined edits.

---

## Phase 4 — Text rendering cleanup

**Status:** planned  
**Goal:** make text layout reusable and deterministic.

### Tasks

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| 4.1 | planned | Split glyph data from draw logic | Glyph data is stored separately from rendering functions |
| 4.2 | planned | Add `measureText()` and explicit layout helpers | Width calculation is reusable and testable |
| 4.3 | planned | Add `drawTextAt()` and `drawCenteredText()` | Alignment is explicit rather than baked into one public function |

### Exit criteria

- Text layout can be tested independently from pixel drawing.
- Scene code no longer relies on hidden centering behavior.

---

## Phase 5 — Pet module cleanup

**Status:** planned  
**Goal:** bring pet rendering and behavior structure up to the same standard as icons.

### Tasks

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| 5.1 | planned | Split pet colors, sprite parsing, behavior resolution, and drawing | Pet code responsibilities are clearly separated |
| 5.2 | planned | Remove duplicated pose-selection logic where feasible | Similar behaviors reuse shared helpers instead of copy-paste |
| 5.3 | planned | Keep sprite cache behavior efficient and explicit | Re-parsing behavior is deliberate and documented |

### Exit criteria

- Pet drawing and pet state advancement remain conceptually separate.
- New pet behavior can be added without modifying unrelated draw code.

---

## Phase 6 — Automated test expansion

**Status:** in_progress  
**Goal:** achieve strong coverage on pure logic and meaningful regression protection on rendering.

### Tasks

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| 6.1 | done | Add low-level tests for `canvas.ts` | Bounds and primitive drawing behavior are covered |
| 6.2 | in_progress | Add focused tests for text rendering helpers | Glyph, measurement, and alignment logic are covered |
| 6.3 | planned | Add table-driven tests for weather-code mapping and icon registry integrity | Mapping and registry drift become hard to miss |
| 6.4 | done | Add scene tests for frame rendering and tint behavior | Static vs animated render composition is protected |
| 6.5 | planned | Extend pet tests beyond state advancement where useful | Sprite parsing and draw invariants are covered |
| 6.6 | planned | Add visual regression or golden-style render tests for representative scenes | Key render outputs are protected against silent drift |
| 6.7 | planned | Add coverage thresholds to the test setup / CI path | Coverage target is enforced, not aspirational |

### Exit criteria

- Core pure logic has broad unit-test coverage.
- Representative render outputs are checked by deterministic regression tests.
- Coverage thresholds are codified in tooling.

---

## Coverage targets

These are working targets, not dogma:

- `85%+` line coverage overall
- `75%+` branch coverage overall
- `90%+` line coverage for pure logic in `src/render/`, `src/pet/`, `src/weather/`
- Critical functions should have explicit branch coverage where practical:
  - weather-code mapping
  - frame composition
  - night tinting
  - pet state transitions
  - sprite parsing

Golden / visual regression tests count as first-class protection even when they
do not maximize raw branch percentage.

---

## Verification matrix

| Area | Verification |
|---|---|
| Formatting | `npm run format:check` |
| Lint | `npm run lint` |
| Types | `npm run typecheck` |
| Unit/integration tests | `npm test` |
| Render regressions | golden / deterministic render assertions |
| Manual smoke checks | browser simulator where UI/rendering changes are substantial |

Default completion bar for a meaningful refactor task:

- code updated
- relevant tests updated
- `format:check`
- `lint`
- `typecheck`
- `test`

If one of these is skipped, the session log should say why.

---

## Open questions / decisions

### Pending

- Do we want `src/render/core.ts` to remain a compatibility barrel long-term, or
  should downstream imports move to more explicit module entry points?
- Should visual regression tests use committed golden artifacts or purely
  programmatic pixel assertions?
- Do we want a dedicated `src/domain/` layer, or is the current size still best
  served by `weather/ + render/ + pet/ + transport/` only?

### Decisions already made

- `docs/PHASE6-PLAN.md` remains a historical record and should not be reused as
  the tracker for this new refactor cycle.
- This tracker is temporary and should be deleted after the work is folded into
  stable project documentation.
- Render modules now share `Color` and `AnimationFrame` contracts plus named
  display-dimension constants; future refactors should extend these rather than
  reintroducing tuple aliases or duplicated `32x32` literals.
- Scene composition now flows through dedicated `scene/format`, `scene/frame`,
  and `scene/tint` modules, with `src/render/scene.ts` retained as a
  compatibility re-export during the refactor program.

---

## Session log

| Date | Author | Summary |
|---|---|---|
| 2026-05-25 | Codex | Created this temporary tracker for the next refactor/test-improvement cycle. No code changes yet; all phases start as `planned`. |
| 2026-05-25 | Codex | Completed Phase 1 by introducing shared render types/constants, normalizing low-level canvas color APIs, and removing duplicated canvas-size literals from render/text paths. Added baseline `canvas` and `font` tests; verification passed via `npm run format`, `npm run lint`, `npm run typecheck`, and `npm test`. |
| 2026-05-25 | Codex | Completed Phase 2 by extracting scene formatting/tint/frame helpers into focused modules and moving static plus animated rendering onto one shared `renderFrame()` composition path. Added scene tests for temperature formatting, shared composition, animation metadata, and night tint behavior; verification passed via `npm run format`, `npm run lint`, `npm run typecheck`, and `npm test`. |

---

## Final migration checklist

Delete this file only after all of the following are true:

- phase statuses are either `done` or intentionally `deferred`
- durable architectural outcomes were migrated into `docs/ARCHITECTURE.md`
- developer workflow/test expectations were migrated into `docs/RUNBOOK.md`
- any non-obvious design decisions were captured as ADRs
- stale links to this file were removed from the rest of the docs
