## TypeScript & Tooling
- Target Node 20 features but keep builds compatible with the repo `tsconfig.base.json` compiler settings.
- Prefer `type` aliases for object shapes that cross package boundaries; reserve `interface` for extending/implementing class-like shapes.
- Co-locate types with implementation when small, but promote shared contracts into `packages/` (e.g. `@automata/types`).
- Use `tsx` for local execution (`npm run dev` scripts) and keep runtime code free of TypeScript-only helpers.
- Run `npm run build --workspace=<pkg>` before shipping changes that add new exports to ensure no TS errors are introduced.

## TypeScript Coding Practices
- Keep `strict` compiler options enabled; treat new implicit any/unknown warnings as blockers until resolved.
- Annotate the return type of exported functions, composables, and Fastify handlers to prevent inference drift.
- Narrow external data via Zod schemas or custom type guards and prefer `unknown` over `any` when validation is pending.
- Use `satisfies` for object literals that must align with shared contracts and leverage exhaustiveness checks on discriminated unions.
- Prefer async/await over promise chaining and model recoverable errors with `Result`-style utilities instead of throwing.
- Prefer async/await over promise chaining.

## Backend (Fastify)
- Build new routes through Fastify plugins under `apps/api/src/routes`, and register them from a single entrypoint to keep encapsulation.
- Validate external input with Zod schemas; convert validation errors into Fastify-friendly replies with descriptive `code` fields.
- Use dependency injection via plugin options instead of importing singletons (e.g. inject Redis, third-party clients) to keep tests isolated.
- Standardize error handling with helpers from `apps/api/src/utils` and log context using Fastify's Pino logger.
- Favor async/await for readability; wrap hotspots in try/catch and return structured error payloads (no raw stack traces).

## Services & Integrations
- Reuse a single Redis connection per request scope via the shared `redisPlugin`; close clients in tests with `t.afterAll`.
- When calling Google APIs, keep API keys and endpoints configurable through environment variables (`apps/api/.env`).
- Guard third-party calls with sensible timeouts/retries and emit metrics or structured logs for observability.

## Frontend (Vue 3 + Vuetify)
- Use `<script setup lang="ts">` and the Composition API; prefer `defineProps/defineEmits` and typed refs/computed values.
- Keep Vuetify layout/styling in SFC `<style scoped lang="scss">` blocks; defer global tokens to the root theme config.
- Derive UI state from props or composables instead of mutating inputs; leverage watchers with cleanup helpers for side effects (e.g. maps).
- Wrap external browser APIs (Maps, Geolocation) in composables under `apps/web/src/composables` for reuse and easier mocking.
- Co-locate component unit tests next to components using `*.spec.ts` and exercise primary user flows with Playwright E2E tests.

## Modern Web Fundamentals
- Ship accessible experiences first: verify focus order, keyboard paths, and ARIA roles in every new feature.
- Keep bundles lean with dynamic `import()` for map-heavy or admin-only routes; surface loading fallbacks for slow networks.
- Prefer declarative data flows (Pinia/composables) over ad-hoc event buses; keep cross-cutting state co-located with domain features.
- Harden client security by sanitizing HTML, limiting inline scripts, and honoring CSP/nonces defined in the API.
- Monitor UX health with Web Vitals sampling in production and feed signals back into Fastify logs/metrics for correlation.

## Testing Strategy
- Favor deterministic Vitest unit tests; mock network and Redis dependencies with lightweight adapters.
- For integration tests, spin up Fastify via `buildServer` and hit the HTTP layer—assert against full responses, not internals.
- Seed fixture data via helper factories under `test/` directories and clean up with `beforeEach/afterEach` hooks.
- Capture regression cases in Playwright scenarios; keep them fast by mocking external APIs where possible.

## Vitest
- Use `npm run test --workspace=@automata/api` for a single run.
- Use `npm run test:watch --workspace=@automata/api` while iterating; press `q` to exit watch mode.
- Use `npm run test:ci --workspace=@automata/api` to produce coverage reports.