# Agentic Implementation Plan

## 1. Kickoff & Environment Sync
- [x] Confirm repo structure matches `project_plan_overview.md` expectations; auto-run `ls` checks via agent shell.
- [x] Agent loads `.env.example` context, drafts `.env` placeholder with dummy keys (do not commit secrets).
- [x] Establish npm workspace by generating root `package.json` skeleton; delegate to code agent with explicit file edits.
- [x] Record baseline timestamp ISO 8601 for execution log.

## 2. Workspace Scaffolding
- [x] Agent generates `apps/api` and `apps/web` directories with TypeScript configs following plan.
- [x] Create shared `packages/types` module exporting DTO interfaces.
- [x] Configure root tooling (`tsconfig.base.json`, ESLint, Prettier) using automated edits; agent verifies lint config syntax.

## 3. Backend Bootstrapping (`apps/api`)
- [x] Implement Fastify server bootstrap per stub; agent writes `src/server.ts` and ensures logger config matches plan.
- [x] Add Redis plugin module; integrate ioredis dependency.
- [x] Stub Google Directions adapter with mock response and TODO for API integration.
- [x] Implement `/api/route-time` route with zod validation, cache lookups, SWR placeholder.
- [x] Define error handling utilities (rate limit, provider failure) and register Fastify rate limiter.
- [x] Add health endpoint `/health` for Docker healthcheck support.
- [x] Update `package.json` scripts: `dev`, `build`, `start`, `test`.

## 4. Backend Testing Harness
- [x] Configure Vitest for API package (prefer Vitest for speed); scaffold `vitest.config.ts`.
- [x] Author unit tests for cache logic using mocked Redis.
- [x] Create contract test for `/api/route-time` leveraging Fastify instance with mocked Google adapter.
- [x] Set up coverage thresholds and CI-friendly npm script (`test:ci`).

## 5. Frontend Bootstrapping (`apps/web`)
- [x] Initialize Vite Vue 3 project in workspace; ensure Vuetify plugin installed and registered.
- [x] Implement core layout: `App.vue` embedding `RouteWidget`.
- [x] Create component stubs (`RouteWidget`, `AlertBell`, `SettingsDrawer`, `MapPreview`, `ToastHost`).
- [x] Wire mode toggle logic, reactive state, and polling hook placeholder.
- [x] Integrate Vuetify theming with responsive defaults and ARIA attributes.

## 6. Frontend Data Layer
- [x] Implement composable `useRouteTime` fetching API with SWR awareness.
- [x] Handle alert threshold settings, storing in `localStorage` via composable.
- [x] Integrate Google Maps JS loader with restricted browser key placeholder; guard to only instantiate in Nav mode.
- [x] Create toast/banner system using Vuetify snackbars; ensure accessible live region.

## 7. Frontend Testing
- [x] Configure Vitest for unit/component tests with `@vue/test-utils`.
- [x] Write tests for `useRouteTime` handling of stale cache and alert triggers.
- [x] Set up Playwright with Docker-friendly config; create E2E specs for Compact/Nav mode and alert flows.

## 8. Shared Types Package (`packages/types`)
- [ ] Define TypeScript interfaces matching API response and request query options.
- [ ] Export reused enums (`RouteMode`, `CacheMetadata`).
- [ ] Configure build step (`tsup` or `tsc --emitDeclarationOnly`) to generate declaration files.
- [ ] Update API and web packages to consume shared types via workspace alias.

## 9. Configuration & Secrets
- [ ] Populate `.env.example` with variables specified in overview; ensure `VITE_` prefix for browser key.
- [ ] Implement config loaders: backend reads via dotenv-safe or similar; frontend uses Vite env.
- [ ] Document key management in `README` or plan doc; highlight LAN-only restrictions.

## 10. Dockerization
- [x] Author multi-stage Dockerfile for `apps/api` (builder + runtime) with `npm` install strategy.
- [x] Author multi-stage Dockerfile for `apps/web`, final stage `nginx:alpine` serving `dist` with template config.
- [x] Create `docker-compose.yml` wiring `api`, `web`, `redis`, optional `nginx`; configure healthchecks and shared network.
- [x] Provide `Makefile`/scripts for `docker-compose build` and `up` to streamline agent workflows.

## 11. Observability & Ops
- [ ] Configure Fastify Pino logging with requestId plugin; expose `/metrics` using `prom-client` (local only).
- [ ] Implement cache hit/miss logging and Google latency timers.
- [ ] Add exponential backoff retry wrapper and stale data fallback logic.
- [ ] Surface operational states (stale data, rate limit) to frontend via response metadata.

## 12. Security Hardening
- [ ] Add Fastify Helmet with CSP tuned for Google Maps domains; disable frameguard for map when needed.
- [ ] Configure CORS to LAN CIDR from env; verify headers in integration tests.
- [ ] Ensure server API key remains server-side; verify no `GOOGLE_MAPS_API_KEY` leak in frontend bundle using build inspection.

## 13. QA & Sign-off
- [ ] Run `npm run lint`, `npm run test`, `npm run build` across workspaces.
- [ ] Execute Playwright E2E in Docker; capture screenshot/video artifacts.
- [ ] Validate `docker-compose up` end-to-end; confirm widget behavior in Compact/Nav modes.
- [ ] Update delivery checklist in plan; prepare release notes for LAN demo.

## 14. Agent Workflow Automation Tips
- Prefer iterative commits per section; use `git status` after each major step.
- Utilize AI-assisted code generation for repetitive boilerplate (component scaffolding, API models).
- Schedule validation commands via task runner script to standardize agent execution.
- Maintain running changelog noting ISO timestamps and durations in minutes for each significant task.
