1. Product & Scope
- MVP goals: deliver LAN-only dashboard hosting pluggable widgets with Route Time widget supporting Simple and Nav modes, configurable freshness, and in-app alerts.
- Out of scope: user authentication, external cloud services, mobile apps, multi-city routing, persistent user profiles, third-party widget store, offline support.
- Simple mode stories: (1) As a dispatcher on LAN, I view the estimated travel time between two saved endpoints every 5 minutes. (2) As an operator, I adjust the freshness window to 3 minutes and see the widget update accordingly.
- Nav mode stories: (1) As a dispatcher, I open Nav mode to monitor travel time and a mini map preview without leaving the dashboard. (2) As an operator, I receive a banner alert when travel time exceeds my configured threshold while Nav mode is active.

2. Architecture Diagram & Rationale
- Diagram:
  Browser (Vite/Vue app) ⇄ Fastify API (`apps/api`) ⇄ Redis cache ⇄ Google Directions API / Google Maps JS API
- Rationale: Browser calls Fastify for route data, Fastify proxies Google APIs to hide server key, apply caching, and enforce rate limits. Redis stores route responses with TTL and stale markers. Google Maps JS loads in browser via restricted browser key for embedding. Server proxy centralizes logging and mitigates quota bursts.

3. API Design
- Endpoint: `GET /api/route-time?from&to&mode&freshnessSeconds`
- Query validation (Fastify + zod):
  - `from` (string, required, URL-encoded address or `lat,lng`).
  - `to` (string, required).
  - `mode` (enum `driving|walking|transit`, default `driving`).
  - `freshnessSeconds` (int, optional, min 60, max 900, default `ROUTE_CACHE_TTL_SECONDS` env = 300).
- Response JSON:
```json
{
  "durationMinutes": 0,
  "distanceKm": 0,
  "provider": "google-directions",
  "mode": "driving",
  "lastUpdatedIso": "2025-01-01T12:00:00Z",
  "cache": {
    "hit": false,
    "ageSeconds": 0,
    "staleWhileRevalidate": false
  }
}
```
- Error model:
  - 400 with `{ code: "INVALID_REQUEST", message, details }` for validation errors.
  - 429 with `{ code: "RATE_LIMITED", retryAfterSeconds }` when per-IP limit exceeded.
  - 502 with `{ code: "PROVIDER_ERROR", message, providerStatus }` on Google failure; serve stale cache when available.
  - 504 with `{ code: "TIMEOUT", message }` when upstream exceeds 5 minutes.
- Rate limiting: per-IP sliding window 5 requests/minute with burst of 10; fallback to cached stale data and surface toast alert when hard limit hit.

4. Data & State
- Persistence limited to Redis cache; no relational database.
- Redis keys: `route:{mode}:{fromHash}:{toHash}` storing JSON payload and metadata.
- TTL: default 300s (`ROUTE_CACHE_TTL_SECONDS`); SWR sets `staleWhileRevalidate` true once age > TTL, but keeps cached value for extra 120s grace to serve stale while background refresh runs.
- In-memory state: Fastify retains Google client instance and rate limiter; Vue stores widget settings in component state and localStorage (optional) for threshold/freshness per session.

5. Frontend Plan
- Components:
  - `RouteWidget.vue`: main card with mode toggle, travel time display, fetch logic.
  - `AlertBell.vue`: Vuetify icon button controlling threshold dialog.
  - `SettingsDrawer.vue`: adjusts freshness, origin/destination presets.
  - `MapPreview.vue`: renders Google Maps JS API map when Nav mode active.
  - `ToastHost.vue`: central toast/snackbar manager using Vuetify.
- Behavior: Simple mode shows time only, refresh interval equals `freshnessSeconds`. Nav mode locks polling to 5-minute (300) cadence and ensures map iframe renders once per poll. Alerts fire via toast/banner when `durationMinutes` exceeds threshold.
- Google Maps embed: load JS API via async loader configured with restricted browser key (HTTP referrer limited to LAN hostnames); map instance created on Nav mode mount, destroyed on exit.
- Accessibility/responsiveness: use Vuetify grid, ensure color contrast > 4.5, keyboard focus on mode toggle, ARIA live region for alerts, responsive layout for 1080p kiosk screens down to tablets.

6. Repo Layout
- Root `package.json` with workspaces `apps/*` and `packages/*`.
- `apps/web`:
  - `src/main.ts`, `src/App.vue`, `src/components/RouteWidget.vue`, `vite.config.ts`, `tsconfig.json`, `public/index.html`.
- `apps/api`:
  - `src/server.ts`, `src/plugins/redis.ts`, `src/routes/routeTime.ts`, `tsconfig.json`, `fastify.config.ts`.
- `packages/types`:
  - `src/index.ts` exporting shared DTO interfaces, `tsconfig.json`, `package.json`.
- Config: `.eslintrc.cjs`, `prettier.config.cjs`, `turbo.json` optional for task orchestration.

7. Code Stubs
- `apps/api/src/server.ts`:
```ts
import Fastify from 'fastify';
import routeTime from './routes/routeTime';
import { redisPlugin } from './plugins/redis';

const app = Fastify({ logger: true });
app.register(redisPlugin);
app.register(routeTime, { prefix: '/api' });

export async function start() {
  await app.listen({ port: Number(process.env.API_PORT) || 4000, host: '0.0.0.0' });
}

if (require.main === module) {
  start().catch((err) => {
    app.log.error(err, 'server-start-failed');
    process.exit(1);
  });
}
```
- `apps/api/src/routes/routeTime.ts`:
```ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getRouteWithCache } from '../services/routeService';

const querySchema = z.object({
  from: z.string().min(3),
  to: z.string().min(3),
  mode: z.enum(['driving', 'walking', 'transit']).default('driving'),
  freshnessSeconds: z
    .string()
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n >= 60 && n <= 900, 'freshnessSeconds invalid')
    .optional(),
});

export default async function routeTime(app: FastifyInstance) {
  app.get('/route-time', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parse = querySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ code: 'INVALID_REQUEST', message: 'Invalid query', details: parse.error.flatten() });
    }
    const data = await getRouteWithCache(app, parse.data);
    return reply.send(data);
  });
}
```
- `apps/api/src/services/routeService.ts` (placeholder):
```ts
export async function getRouteWithCache(app, params) {
  const cacheKey = buildKey(params);
  const redis = app.redis;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const payload = JSON.parse(cached);
    if (payload.cache.hit && !payload.cache.staleWhileRevalidate) {
      return payload;
    }
    triggerBackgroundRevalidate(app, params);
    return { ...payload, cache: { ...payload.cache, staleWhileRevalidate: true } };
  }
  const fresh = await fetchFromGoogle(params);
  await redis.set(cacheKey, JSON.stringify(fresh), 'PX', ttlMillis(params));
  return fresh;
}
```
- `apps/api/src/plugins/redis.ts`:
```ts
import fp from 'fastify-plugin';
import Redis from 'ioredis';

type RedisPluginOptions = { url?: string };

export const redisPlugin = fp<RedisPluginOptions>(async (app, opts) => {
  const client = new Redis(opts.url || process.env.REDIS_URL);
  app.decorate('redis', client);
  app.addHook('onClose', async () => client.quit());
});
```
- `apps/web/src/components/RouteWidget.vue`:
```vue
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import MapPreview from './MapPreview.vue';

const mode = ref<'simple' | 'nav'>('simple');
const freshnessSeconds = ref(Number(import.meta.env.VITE_DEFAULT_FRESHNESS) || 300);
const pollMs = computed(() => (mode.value === 'nav' ? 300 * 1000 : freshnessSeconds.value * 1000));
const timer = ref<number | null>(null);

function toggleMode(next: 'simple' | 'nav') {
  mode.value = next;
  schedule();
}

function schedule() {
  if (timer.value) window.clearInterval(timer.value);
  timer.value = window.setInterval(fetchRoute, pollMs.value);
}

async function fetchRoute() {
  // TODO: call /api/route-time and update reactive state; emit alerts when threshold exceeded
}

onMounted(() => {
  fetchRoute();
  schedule();
});

onBeforeUnmount(() => {
  if (timer.value) window.clearInterval(timer.value);
});
</script>

<template>
  <v-card>
    <v-toolbar density="compact">
      <v-btn-toggle model-value="mode" @update:model-value="toggleMode">
        <v-btn value="simple">Simple</v-btn>
        <v-btn value="nav">Nav</v-btn>
      </v-btn-toggle>
    </v-toolbar>
    <!-- TODO: display travel time, distance, alerts -->
    <MapPreview v-if="mode === 'nav'" />
  </v-card>
</template>
```

8. Configuration
- `.env.example`:
```
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_BROWSER_KEY=
API_PORT=4000
WEB_PORT=5173
ROUTE_CACHE_TTL_SECONDS=300
ALLOWED_ORIGINS=http://192.168.1.0/24,http://localhost:5173
REDIS_URL=redis://redis:6379
```
- Server API key stored only in `.env` for api service; restrict by IP (LAN CIDR) and usage type (Directions API). Browser key limited to Maps JS API with HTTP referrer restrictions; stored in web `.env` as `VITE_GOOGLE_MAPS_BROWSER_KEY` and injected at build time.

9. Dockerization
- `apps/api/Dockerfile` multi-stage: base `node:20-alpine`, builder installs dependencies, builds TypeScript, runtime installs production deps and copies dist with `node dist/server.js` entry.
- `apps/web/Dockerfile`: stage 1 build Vite app, stage 2 uses `nginx:alpine` serving `dist` artifacts, env-config via entrypoint script replacing template values.
- `docker-compose.yml` services:
  - `api`: build `./apps/api`, expose `${API_PORT}`, depends_on redis, env from `.env`, healthcheck hitting `/health` every 60 seconds.
  - `web`: build `./apps/web`, expose `${WEB_PORT}`, depends_on api, environment for `VITE_*` keys.
  - `redis`: image `redis:7-alpine`, command enabling appendonly no, healthcheck `redis-cli ping` every 60 seconds.
  - Optional `nginx`: reverse proxy combining web/api behind LAN hostname, config in `deploy/nginx.conf`, healthcheck HTTP 200.
  - Shared network `lan_dashboard_net` with static IPs optional for demo.

10. Observability & Ops
- Fastify logging: use pino with level `info`, pretty logs in dev, JSON logs in demo; include request-id and latency.
- Metrics: instrument cache hit rate, cache age, Google API latency, request counts, alert threshold violations using `prom-client` with `/metrics` endpoint (LAN only).
- Failure handling: on provider failure serve stale cache if available (age < 420s), apply exponential backoff (base 30 seconds) before retrying Google, surface toast banner when using stale data or when rate-limited.

11. Testing & QA
- Unit tests (`apps/api/src/services/__tests__`): mock Redis and Google adapter to verify SWR, TTL, key generation.
- Contract test (`apps/api/test/contract/routeTime.test.ts`): run Fastify instance with mocked Google responses ensuring status codes and schema compliance.
- E2E tests (`apps/web/tests/e2e` with Playwright): scenarios covering Simple mode render, Nav mode map load, adjusting freshness, threshold alert, stale indicator messaging.
- Test durations targeted under 15 minutes for full suite using npm scripts and Docker test compose.

12. Security Notes
- Server API key never exposed; stored in Docker secrets or `.env` mounted to `api` container; Fastify proxy adds required headers.
- CORS configured to LAN CIDR hosts from `ALLOWED_ORIGINS`; preflight responses locked to GET.
- Input validation with zod ensures sanitized payload; add Fastify Helmet plugin for basic headers (frameguard disabled for map embed but CSP tightened to Google domains).

13. Delivery Checklist
- Builds succeed: `npm run build` in `apps/api` and `apps/web`.
- `docker-compose up` launches api, web, redis with healthy status.
- Route Time widget fetches data, respects configured freshness, provides alerts when threshold exceeded.
- Simple mode shows travel time with refresh cadence; Nav mode adds map preview and uses fixed 5-minute polling.
- Alerts surface via toast/banner without external notifications.
- Map preview renders with restricted browser key and responds to polling updates.

Quickstart
```
npm install
cp .env.example .env
export GOOGLE_MAPS_API_KEY=... && export GOOGLE_MAPS_BROWSER_KEY=...
docker-compose build
docker-compose up
```
