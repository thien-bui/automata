You are a senior software architect. Produce a complete, build-ready SOFTWARE DEVELOPMENT PLAN (v1 MVP) for a LAN-only web dashboard that hosts pluggable widgets. Output must follow all requirements below exactly.

WRITING RULES
- Tone: concise, implementation-focused, no fluff.
- Organize with numbered top-level sections.
- Within each section, use short paragraphs or bullet lists; prefer code/config snippets over prose where useful.
- Include file paths with forward slashes and relative to repo root.
- All durations in minutes; timestamps ISO 8601; TTLs in seconds.

GOAL
- MVP dashboard with a single widget: “Route Time”.

CORE REQUIREMENTS
- Two UI modes:
  1. Simple mode: only travel time estimate.
  2. Nav mode: travel time + embedded mini map preview.
- Widget freshness configurable; default 5 minutes.
- In-app alerts only (toast/banner) when time exceeds threshold.
- No authentication (LAN only).
- Dockerized for local deployment.
- Ops scope: local dev + LAN demo; no cloud dependencies.

STACK (fixed)
- Frontend: Vite + Vue 3 + TypeScript, and Vuetify.
- Backend: Node.js (TypeScript) + Fastify.
- Routing provider: Google Maps JS API.
- Cache: Redis with TTL + stale-while-revalidate.
- Hosting: Local Docker Compose. No external cloud services.

DELIVERABLE SECTIONS
1) Product & Scope
   - MVP goals, explicit out-of-scope items.
   - User stories for Simple and Nav modes (at least 2 each).

2) Architecture Diagram & Rationale
   - Text-based diagram showing Browser ↔ Fastify API ↔ Google APIs ↔ Redis.
   - Justify server-side proxying of Google APIs (key safety, caching, rate limits).

3) API Design (contract-first)
   - Define `GET /api/route-time?from&to&mode&freshnessSeconds`.
   - Detail query validation (types/defaults) and response JSON: `durationMinutes`, `distanceKm`, `provider`, `mode`, `lastUpdatedIso`, `cache{hit, ageSeconds, staleWhileRevalidate}`.
   - Describe error model for provider/rate-limit failures with HTTP codes/payload.
   - Outline API rate limiting (per IP, burst, fallback).

4) Data & State
   - Identify any persistence beyond cache (should be minimal).
   - Specify Redis keys, TTLs (default 300s), stale-while-revalidate flow, and in-memory state considerations.

5) Frontend Plan
   - Component breakdown (RouteWidget, AlertBell, Settings, plus supporting components).
   - Simple vs Nav mode behavior, polling intervals (Nav fixed 5m; Simple uses freshness setting).
   - Describe Google Maps JS embed strategy and safe browser key handling.
   - Accessibility and responsive layout notes.
   - Use Vuetify and existing vuetify components over building custom UI components.

6) Repo Layout
   - Monorepo structure using `npm`; directories: `apps/web`, `apps/api`, `packages/types` (shared).
   - List critical files per package (entry points, config files).

7) Code Stubs (concise)
   - Fastify bootstrap (`apps/api/src/server.ts`).
   - `/api/route-time` handler with Redis cache + SWR placeholder logic.
   - Redis helper module.
   - Vue `RouteWidget` component stub with mode toggle and polling hook.

8) Configuration
   - `.env.example` with `GOOGLE_MAPS_API_KEY`, `API_PORT`, `WEB_PORT`, `ALLOWED_ORIGINS`, `REDIS_URL`.
   - Explain server API key vs browser JS key, scope restrictions, storage locations.

9) Dockerization
   - Multi-stage Dockerfiles for `apps/api` and `apps/web`.
   - `docker-compose.yml` including `api`, `web`, `redis`, optional `nginx` reverse proxy; note healthchecks, networks, environment wiring.

10) Observability & Ops (local)
   - Fastify logging setup, log levels.
  - Metrics to capture (cache hit rate, Google API latency).
   - Failure handling: serve stale cache, exponential backoff, alert surfacing.

11) Testing & QA
   - Unit tests for Google adapter + cache logic.
   - Contract test for `/api/route-time` (mock Google API).
   - Playwright E2E coverage: configure widget, Simple/Nav render, alert thresholds, map loads.

12) Security Notes
   - Never expose server API key to browser; describe secret handling.
   - CORS locked to LAN hosts.
   - Input validation via Zod/JSON Schema; mention helmet-like hardening if applicable.

13) Delivery Checklist
   - Definition of done list covering builds, docker-compose up, widget behavior in both modes, refresh cadence, alerts, map rendering.

CLOSING ITEMS
- Provide a “Quickstart” section with shell commands to run locally via Docker.
- Ensure instructions are self-contained; do not reference any external document.
