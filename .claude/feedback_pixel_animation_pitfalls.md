---
name: feedback-pixel-animation-pitfalls
description: Hard-won lessons from Phase 5 pixel-pet animation — sub-phase state bugs, rate/oscillation issues, tail suppression
metadata:
  type: feedback
---

Sub-phase state machines that share a position variable must gate each branch
with a secondary discriminator — e.g. `petBehaviorDur > 0` on the arc-up
condition in the perch behavior. Using only `perchY > PET_Y_PERCH` caused
infinite 17↔19 oscillation once arc-down raised perchY above the threshold.

**Why:** Found by adding console.log on every sub-phase transition. The log
showed arc-up/arc-dn alternating forever, pointing directly at the condition.

**How to apply:** Whenever you encode multiple sub-phases in a single behavior
value, draw a state diagram first and confirm the conditions are mutually
exclusive via something other than the shared position variable.

---

Sprite alternation faster than every 2 animation frames (≈150 ms each) looks
like oscillation/push-ups on a 32×32 display, not walking.

**How to apply:** Gate `walkFrame` advances with `if (counter % 2 === 0)` or
similar. Never advance walkFrame every single frame.

---

The tail pixel at `baseY + TAIL_Y[phase]` oscillates between face and body
rows when `baseY` is high on screen (e.g. perch at y=17). This single brown
pixel moving 1 row looked like the whole cat wobbling. Fix: suppress tail
(`drawTail = false`) for any behavior where baseY is not PET_Y_WALK.

**How to apply:** Before adding a behavior at a new baseline, check whether
TAIL_Y offsets land on the cat's own sprite rows. If yes, set drawTail=false.

---

Debug approach: add `console.log` on every sub-phase transition first, before
trying to reason about the bug from code. State machine bugs in pixel animation
are nearly impossible to spot by reading code alone; the log pattern is
immediately obvious.
