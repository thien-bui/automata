# Cline Development Instructions

## Project Overview
This is a TypeScript monorepo with:
- **API**: Fastify backend in `apps/api/`
- **Web**: Vue 3 + Vuetify frontend in `apps/web/`
- **Types**: Shared TypeScript types in `packages/types/`

## TypeScript & Tooling Guidelines

### Compiler Settings
- Target Node 20 features while maintaining compatibility with `tsconfig.base.json`
- Use `type` aliases for object shapes crossing package boundaries
- Reserve `interface` for class-like shapes that need extending/implementing
- Co-locate types with implementation when small; promote shared contracts to `packages/`
- Use `tsx` for local execution (`npm run dev` scripts)
- Run `npm run build --workspace=<pkg>` before shipping changes with new exports

### TypeScript Best Practices
- Keep `strict` compiler options enabled
- Treat implicit any/unknown warnings as blockers
- Annotate return types for exported functions, composables, and Fastify handlers
- Narrow external data with Zod schemas or custom type guards
- Prefer `unknown` over `any` when validation is pending
- Use `satisfies` for object literals aligning with shared contracts
- Leverage exhaustiveness checks on discriminated unions
- Prefer async/await over promise chaining
- Model recoverable errors with `Result`-style utilities instead of throwing
- Specify types for parameters, objects, and variables when possible

## Backend Development (Fastify)

### Route Structure
- Build new routes as Fastify plugins under `apps/api/src/routes/`
- Register routes from a single entrypoint for encapsulation
- Validate external input with Zod schemas
- Convert validation errors to Fastify-friendly replies with descriptive `code` fields

### Dependency Management
- Use dependency injection via plugin options instead of importing singletons
- Inject Redis, third-party clients through plugin options for test isolation
- Standardize error handling with helpers from `apps/api/src/utils`
- Log context using Fastify's Pino logger
- Wrap hotspots in try/catch and return structured error payloads (no raw stack traces)

## Services & Integrations

### Redis Usage
- Reuse single Redis connection per request scope via shared `redisPlugin`
- Close clients in tests with `t.afterAll`

### Google APIs
- Keep API keys and endpoints configurable through environment variables in `apps/api/.env`
- Guard third-party calls with sensible timeouts/retries
- Emit metrics or structured logs for observability

## Frontend Development (Vue 3 + Vuetify)

### Component Structure
- Use `<script setup lang="ts">` with Composition API
- Prefer `defineProps/defineEmits` and typed refs/computed values
- Keep Vuetify layout/styling in SFC `<style scoped lang="scss">` blocks
- Defer global tokens to root theme config

### State Management
- Derive UI state from props or composables instead of mutating inputs
- Leverage watchers with cleanup helpers for side effects (e.g., maps)
- Wrap external browser APIs (Maps, Geolocation) in composables under `apps/web/src/composables`
- Prefer declarative data flows (Pinia/composables) over ad-hoc event buses
- Keep cross-cutting state co-located with domain features

### Testing
- Co-locate component unit tests next to components using `*.spec.ts`
- Exercise primary user flows with Playwright E2E tests

## Modern Web Fundamentals

### Accessibility & Performance
- Ship accessible experiences first: verify focus order, keyboard paths, and ARIA roles
- Keep bundles lean with dynamic `import()` for map-heavy or admin-only routes
- Surface loading fallbacks for slow networks
- Harden client security by sanitizing HTML, limiting inline scripts, and honoring CSP/nonces

### Monitoring
- Monitor UX health with Web Vitals sampling in production
- Feed signals back into Fastify logs/metrics for correlation

## Timezone Handling
- Persist backend timestamps as UTC ISO-8601 strings and only localize at the presentation layer
- Require explicit timezone offsets from external inputs; validate with Zod before converting to native `Date`
- Use a single datetime utility (`Intl` or a vetted library) per module to avoid mixed rounding rules
- Pass timezone context through function parameters instead of reading globals so tests can fix deterministic expectations

## Testing Strategy

### Unit Tests (Vitest)
- Favor deterministic Vitest unit tests
- Mock network and Redis dependencies with lightweight adapters
- Seed fixture data via helper factories under `test/` directories
- Clean up with `beforeEach/afterEach` hooks

### Integration Tests
- Spin up Fastify via `buildServer` and hit the HTTP layer
- Assert against full responses, not internals

### E2E Tests
- Capture regression cases in Playwright scenarios
- Keep tests fast by mocking external APIs where possible

## Testing Commands

### Vitest Commands
```bash
# Single run for API
npm run test --workspace=@automata/api

# Watch mode while iterating
npm run test:watch --workspace=@automata/api

# Generate coverage reports
npm run test:ci --workspace=@automata/api
```

## Development Workflow

### Before Making Changes
1. Read existing code patterns in the relevant directory
2. Check for existing composables, utilities, or types that can be reused
3. Ensure TypeScript strict mode compliance
4. Plan testing strategy

### Making Changes
1. Follow the established patterns for the specific area (API routes, Vue components, composables)
2. Add proper TypeScript annotations
3. Include error handling and validation
4. Write tests alongside implementation
5. Update documentation if needed
6. Document complex code or logic
7. Dont run the application, only do a build test

### Before Shipping
1. Run `npm run build --workspace=<pkg>` for affected packages
2. Run relevant test suites
3. Verify no TypeScript errors
4. Test functionality end-to-end

## File Organization Patterns

### API Structure
```
apps/api/src/
├── routes/          # Fastify route plugins
├── adapters/        # External API adapters
├── config/          # Configuration modules
├── plugins/         # Fastify plugins
├── utils/           # Utility functions
└── test/            # Test utilities and fixtures
```

### Web Structure
```
apps/web/src/
├── components/      # Vue components
├── composables/     # Composition API functions
├── plugins/         # Vue plugins
└── tests/           # E2E tests
```

### Shared Types
```
packages/types/src/
└── index.ts         # Shared TypeScript types
```

## Key Principles
1. **Type Safety First**: Maintain strict TypeScript compliance
2. **Test Coverage**: Write tests for all new functionality
3. **Accessibility**: Ensure WCAG compliance in UI components
4. **Performance**: Optimize bundle sizes and runtime performance
5. **Maintainability**: Follow established patterns and conventions
6. **Security**: Validate inputs and sanitize outputs
7. **Observability**: Include proper logging and monitoring
