# Transformation Tracker

> Single source of progress for the [[README|transformation plan pack]]. Each agent updates its row
> on completion. Status: ⬜ not started · 🔄 in progress · ✅ done · ⛔ blocked.

## Status

| # | Phase | Status | Depends on | Branch / PR | Date | Notes |
|---|-------|--------|-----------|-------------|------|-------|
| 1 | [[phase-1-store-and-versioning]] | ✅ | — | `transform/phase-1-store-and-versioning` | 2026-06-06 | `CONFIG_PATH`=`customization.json` (project root, sibling of `runtime.json`). Backups: `customization.bak.v{N}.json`. Corrupt: `customization.corrupt.json`. `CURRENT_SCHEMA_VERSION=1`. Schema versioning covered in ADR-0009 (no separate ADR-0010). `runMigrationsWithTable` exported for test injection. |
| 2 | [[phase-2-render-seam]] | ✅ | 1 | `transform/phase-2-render-seam` | 2026-06-06 | `NIGHT_FACTOR=0.5`. Residue ramps: use hardcoded defaults when g/s match; generate proportionally otherwise (hand-crafted ramps don't reproduce from uniform factor). `BEHAVIOR_DUR` replaced by `getBehaviorDur()` deriving from active config. `setActiveCustomization` exported for Phase 3 hot-swap. |
| 3 | [[phase-3-backend-api]] | ✅ | 1, 2 | `transform/phase-3-backend-api` | 2026-06-06 | `GET/PUT /api/customization`, `POST /api/customization/reset`, `GET /api/version`. Hot-swap via `setActiveCustomization` after every write. Dev-only Vite `/save-sprites`+`/save-pet-config` plugins retained as optional export helpers — production write path is now the real API. |
| 4 | [[phase-4-studio-and-palette-editor]] | ⬜ | 3 | | | |
| 5 | [[phase-5-ui-restructure]] | ⬜ | 4 | | | |
| 6 | [[phase-6-mobile-and-touch]] | ⬜ | 5 | | | |
| 7 | [[phase-7-maturity-extras]] | ⬜ | 5 (6 recommended) | | | |

## Dependency graph

```
P1 ─► P2 ─► P3 ─► P4 ─► P5 ─► P6
                              └─► P7
```

P1 and P2 are backend-only and invisible to users. P3 exposes the API. P4 makes the Studio use it.
P5/P6 reshape the UI. P7 is maturity polish (needs the unified UI from P5).

## Decision log (fill in as phases land)

- **Schema version baseline:** `CURRENT_SCHEMA_VERSION = 1`. The initial schema defines `palette`,
  `sprites`, `behavior`, and optional `scene`/`location` slots. Record every future bump here with
  the migration it required and why.
- **Reserved palette chars:** `o g s l r` are structural roles referenced by key in `draw.ts`
  (tail=`s`, fur=`o`, accent=`r`, eyes=`g`, light=`l`). They are always present in the palette and
  may be recolored but never removed. User swatches use any other single ASCII char not in this set.
- **Night-darken factor (P2):** `NIGHT_FACTOR = 0.5`. Defaults carry explicit night values so
  auto-darken only applies to user swatches; 0.5 approximates the PET_DAY→PET_NIGHT ratio (≈0.48–0.52
  per channel). The regression test passes unchanged because defaults use explicit values, not darken().
- **Residue ramp strategy (P2):** PUKE/POO ramp constants are preserved verbatim when the resolved
  `g`/`s` day colors match their defaults. For non-default swatches, `buildFadeSteps` generates
  proportional ramps using fixed per-step factors. Rationale: the original hand-crafted ramps cannot
  be reproduced from base color alone (step ratios vary per channel).
- **ADR-0010 decision:** schema versioning strategy is covered in ADR-0009 (not a separate ADR).
- **Export-to-code path (P3):** Dev-only Vite plugins (`/save-sprites`, `/save-pet-config`) are retained as optional helpers for committing updated defaults back to source. Production never depends on them. Phase 4 (Studio) uses `PUT /api/customization` exclusively.

## Teardown checklist (closing agent)

- [ ] All phases ✅.
- [ ] ADR(s) written: `0009-runtime-customization-store` (+ `0010-customization-schema-versioning` if
      kept separate).
- [ ] `docs/ARCHITECTURE.md`, `docs/SPEC.md`, `docs/RUNBOOK.md`, `docs/ROADMAP.md` updated.
- [ ] `.gitignore` includes `customization.json` (+ backup files).
- [ ] **Delete `docs/transformation/`** in the same change as the final ROADMAP update.
