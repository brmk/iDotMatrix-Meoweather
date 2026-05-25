# ADR-0006 — Perch behavior and pixel-animation state-machine lessons

**Date:** 2026-05-24  
**Status:** Accepted

---

## Context

Phase 5 added a `perch` behavior: the cat jumps up to the temperature-text
row, walks across it, then arcs back down. Building it produced several
non-obvious bugs in the shared-variable sub-phase pattern. This ADR records
those bugs and the fixes so future agents don't repeat them.

---

## The perch sub-phase pattern

`perch` is a single `PetBehavior` value that internally has three sequential
sub-phases: **arc-up → walk → arc-down**. A single `pet.perchY` number drives
the Y position during the arcs; `petBehaviorDur` counts the walk steps.

```
perchY: PET_Y_WALK(28) ──arc-up──▶ PET_Y_PERCH(17) ──walk──▶ (same) ──arc-down──▶ 28
                         dur>0, perchY>17             dur>0,perchY=17  dur=0
```

---

## Bug: infinite 17↔19 oscillation

### Symptom

Cat reached the text, took its walk steps, then oscillated forever between
`perchY=17` and `perchY=19` without ever returning to the floor.

### Root cause

The arc-up condition was `pet.perchY > PET_Y_PERCH`. Once the walk depleted
(`petBehaviorDur = 0`) and arc-down started, `perchY` incremented to 19. But
`19 > 17` re-triggered arc-up, decrementing back to 17. Infinite loop.

### Fix

Gate arc-up on `petBehaviorDur > 0`:

```typescript
if (pet.perchY > PET_Y_PERCH && petBehaviorDur > 0) {
  // arc up
} else if (petBehaviorDur > 0) {
  // walk
} else {
  // arc down — perchY may be above PET_Y_PERCH here, that's intentional
}
```

### General rule

When multiple sub-phases of a behavior share a position variable, the
conditions must be **mutually exclusive via a secondary discriminator** (here:
`petBehaviorDur > 0`). Never rely on a position variable alone to decide which
sub-phase is active.

---

## Bug: visual "push-up" oscillation on the text

### Symptom

Cat appeared to bob up and down in place instead of walking left/right.

### Root cause (1): leg animation too fast

`walkFrame` was advancing every frame (150 ms). At 32×32 resolution the two
leg sprites (spread / together) flickering at 6.7 Hz look like vertical
bouncing, not walking.

**Fix:** advance `walkFrame` every 2 steps:
```typescript
if (petBehaviorDur % 2 === 0) pet.walkFrame = (pet.walkFrame + 1) % 2;
```

### Root cause (2): tail oscillation at face/body level

The tail pixel at `baseY + TAIL_Y[phase]` oscillated between `y=18` and `y=19`
while the cat body occupied `y=17..20`. A single brown pixel appearing at face
height alternating with body height looked like the whole cat wobbling.

**Resolution:** the oscillation between `baseY+1` (eye level) and `baseY+2`
(spine level) is the correct animation for a perching cat's raised tail.
The original "wobbling" impression was caused by the leg animation bug
(root cause 1) running simultaneously. With that fixed, the normal
`TAIL_Y` behaviour is used unchanged for `perch`.

---

## Lessons for future pixel animations

| Lesson | Detail |
|---|---|
| **Sub-phase gating** | Use a secondary variable as a phase discriminator. Never rely on a shared position crossing a threshold alone. |
| **Animation rate** | On a 32×32 display at 150 ms/frame, sprite alternation faster than every 2 frames looks like oscillation, not animation. |
| **Tail at non-floor baselines** | When `baseY` is significantly above `PET_Y_WALK`, the `TAIL_Y` offsets land on the cat's body rows. Either recalculate offsets or suppress the tail. |
| **Debug logging first** | For animation state-machine bugs, add `console.log` on every sub-phase transition before optimising. The log pattern (arc-up, arc-dn, arc-up, arc-dn…) made the oscillation immediately obvious. |
| **`petStepCounter` accumulates during arcs** | The step counter keeps incrementing during the arc-up phase. Reset it (`petStepCounter = 0`) at the end of each arc frame so the first walk step fires on a predictable schedule. |

## See also

- [[../PHASE6-PLAN]] — Part B unit tests cover every regression case documented here
- [[0005-pixel-pet-sprite-system]] — sprite system design that this behavior builds on
