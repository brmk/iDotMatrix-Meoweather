# 0003 — Use Open-Meteo as the weather data source

- **Status:** Accepted
- **Date:** 2026-05-24

## Context

The display shows current weather, so we need a weather API. The host is in
Ukraine (Ternopil region). Candidates: OpenWeatherMap, WeatherAPI, Open-Meteo,
and others. Selection criteria for a hobby project: free, no friction, reliable
access from the user's region, simple JSON.

## Decision

Use **Open-Meteo**.
- **Free** and requires **no API key / no registration** — nothing to manage,
  rotate, or leak.
- Returns plain JSON with current conditions and a numeric weather-condition code
  that maps cleanly to display icons.
- Queried by latitude/longitude, which suits a fixed home location.

The `weather/` module maps the response to an internal `WeatherSnapshot` so the
rest of the app is decoupled from this choice. Swapping providers later means
rewriting only that mapping.

## Consequences

- **Easier:** zero credential management; works out of the box.
- **Easier:** provider is isolated behind `WeatherSnapshot`; replaceable without
  touching render/scheduler.
- **Costs:** no API key also means no contractual SLA — fine for a wall display.
  Cache the last good snapshot so a failed fetch doesn't blank the panel.
- **Open item:** the weather-code → icon mapping is part of the renderer
  (ADR-0004); define it explicitly there.
