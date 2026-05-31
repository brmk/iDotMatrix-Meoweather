# 0007 — Raspberry Pi deployment via Docker Compose and self-hosted Actions runner

- **Status:** Accepted
- **Date:** 2026-05-25

## Context

The project now needs a low-touch Raspberry Pi deployment path. The repo should
remain focused on the LED matrix stack only; Home Assistant and other host-level
services are separate concerns.

The deployment goal is:

- keep the Pi mostly immutable and easy to recreate
- avoid manual `git pull` / dependency install loops on the device
- preserve the existing TypeScript app + Python BLE sidecar split
- allow the same Pi to host other containerized services

## Decision

Deploy the LED matrix stack on Raspberry Pi as two OCI images (`app` and
`sidecar`) orchestrated by `docker compose`.

Updates are delivered by GitHub Actions:

- GitHub-hosted runners build ARM64 images and push them to GHCR
- a self-hosted runner on the Pi syncs the repo, pulls the tagged images, and
  runs `docker compose up -d`

Boot-time startup on the Pi is handled by a user-level `systemd` service that
starts the compose stack from a fixed deployment directory.

## Consequences

- **Cleaner host:** the Pi mainly needs Docker, a checked-out deployment
  directory, and a user service
- **Repo stays source-of-truth:** compose, Dockerfiles, workflow, and service
  installer live in the same repo as the app
- **Private repo friendly:** no public repository is required for deployment
- **BLE remains special:** the sidecar container needs host networking and D-Bus
  access on Linux, so it is intentionally less isolated than the TS app
- **Production path differs from macOS dev:** local launchd remains supported for
  development, while Raspberry Pi uses compose + systemd
