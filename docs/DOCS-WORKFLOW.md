# Documentation Workflow

> How agents keep documentation synchronized with implementation.
> Read this together with [[../AGENTS]], [[SPEC]], and any active tracker doc.

## Goal

Prevent drift between:

- code and actual runtime behavior
- phase/history docs and current project status
- temporary tracker docs and durable architecture/runbook docs

The intent is that agents perform doc sync as part of normal delivery, without
requiring the user to remember or police it.

---

## Core rule

If a session changes reality, it must update the document that describes that
reality in the same session.

Examples of "changes reality":

- code structure changed
- behavior changed
- command/workflow changed
- current phase/status changed
- a temporary tracker phase/task changed
- a design decision became stable enough to keep

---

## Source-of-truth map

Use each document for one job only.

| Document | Purpose | Update when |
|---|---|---|
| `AGENTS.md` | Standing agent rules and repo workflow | The default way agents should work changes |
| `docs/SPEC.md` | Current system state and navigation | The "what exists now" summary changes |
| `docs/ARCHITECTURE.md` | Stable architectural boundaries and component roles | Structure or boundaries changed in a durable way |
| `docs/RUNBOOK.md` | How to run, test, debug, and verify | Commands or developer workflow changed |
| `docs/ROADMAP.md` | Historical phase record | A numbered phase starts, completes, or is reclassified |
| `docs/PHASE6-PLAN.md` | Historical completion record for Phase 6 | Only if historical Phase 6 record was inaccurate |
| `docs/REFACTOR-TRACKER.md` | Temporary living tracker for active refactor/test work | Any tracked task/status changed during the session |
| `docs/adr/*.md` | Durable non-obvious technical decisions | A decision needs rationale preserved long-term |

Rule of thumb:

- temporary status lives in a tracker
- durable truth lives in `SPEC`, `ARCHITECTURE`, `RUNBOOK`, `ROADMAP`, and ADRs

---

## Required doc updates by change type

### 1. Code structure changed

Examples:

- files split or merged
- module boundaries changed
- new registry pattern introduced
- ownership of a concern moved between modules

Must update:

- `docs/ARCHITECTURE.md` if the structure is durable
- active tracker doc if the work is in progress
- ADR if the change reflects a meaningful design decision

### 2. Runtime or render behavior changed

Examples:

- pet behavior changed
- rendering pipeline changed
- animation timing changed
- transport/retry behavior changed

Must update:

- `docs/SPEC.md` if the current system summary changed
- `docs/ARCHITECTURE.md` if component responsibilities changed
- tracker doc status/log
- ADR if the behavior change reflects a durable design choice

### 3. Developer workflow changed

Examples:

- new verification command
- simulator workflow changed
- new required test step
- new setup or debug flow

Must update:

- `docs/RUNBOOK.md`
- `AGENTS.md` if agents must follow the new workflow by default

### 4. Phase or project status changed

Examples:

- a planned phase became complete
- a historical doc became stale
- active work moved from one tracker phase to another

Must update:

- `docs/ROADMAP.md`
- `docs/SPEC.md` navigation/status area if relevant
- active tracker doc

### 5. Temporary tracker work progressed

Must update:

- `Last updated`
- task and phase statuses
- session log
- open questions / decisions if changed

---

## Session-end documentation gate

Before handing work back, the agent must ask:

1. What changed in code or behavior?
2. Which document is the source of truth for that change?
3. Did I update the temporary tracker if this was tracked work?
4. Did I update durable docs if the change is now stable?
5. Did I leave contradictory statements anywhere?

If the answer to any of these is "no" or "not sure", doc sync is not complete.

---

## Temporary tracker lifecycle

For temporary tracker docs such as `docs/REFACTOR-TRACKER.md`:

- use them for active multi-session work
- keep statuses current after every meaningful session
- do not let them replace durable docs forever

When the tracked work stabilizes:

1. migrate durable conclusions into `ARCHITECTURE`, `RUNBOOK`, `SPEC`, `ROADMAP`, and ADRs as appropriate
2. remove stale links
3. delete the tracker

---

## Anti-patterns

Avoid these:

- updating code without updating the doc that claims to describe it
- treating `ROADMAP.md` as a future-only plan when it also contains history
- using a completed phase document as a live tracker
- leaving a temporary tracker as the only place where important durable facts exist
- adding a new doc when an existing one already owns that concern

---

## Minimal handoff note format

If a session changes docs, the agent's final summary should mention:

- what code changed
- which docs were updated
- whether the tracker status/log was updated
- whether any follow-up documentation migration is still pending
