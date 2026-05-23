# 0000 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-05-24

## Context

This is an agent-driven project: AI agents (Claude Code) will do most of the
implementation across separate sessions, with no shared memory between them. A
later agent has no way to know *why* an earlier decision was made unless it is
written down. Code comments are too local; commit messages get lost.

## Decision

We use **Architecture Decision Records (ADRs)**. Each significant, non-obvious
technical decision gets one numbered file in `docs/adr/`, using the format of
this repository:

- A title line `# NNNN — short imperative title`.
- Status (Proposed / Accepted / Superseded by NNNN), date.
- Context — the forces and constraints at play.
- Decision — what we chose, stated plainly.
- Consequences — what becomes easier and what becomes harder.

ADRs are immutable once Accepted. To change a decision, write a new ADR that
supersedes the old one and update the old one's status.

## Consequences

- Any agent can reconstruct the project's reasoning from `docs/adr/` alone.
- There is a small upfront cost to writing an ADR, paid back the first time an
  agent is tempted to "simplify" a decision it doesn't understand.
- The numbering is sequential; new ADRs take the next free number.
