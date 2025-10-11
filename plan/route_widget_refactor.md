# Route Widget Refactor Plan

1. Audit `apps/web/src/components/RouteWidget.vue` to catalogue UI regions (summary, alerts, map, settings) and the state they need; note duplicated mode-toggle markup in both title actions and settings slots plus watcher responsibilities for polling, alerts, and toasts.
2. Introduce a `route/` folder under `apps/web/src/components/` and scaffold presentation components: `RouteSummary.vue` (duration/distance block), `RouteAlerts.vue` (full + compact alert render), `RouteModeToggle.vue` (shared toggle used in header/settings), and `RouteSettings.vue` (sliders + compact-control wrapper that emits updates instead of mutating parent refs).
3. Extract behavioral clusters from `RouteWidget.vue` into composables to shrink the script: e.g. `useRoutePolling` to encapsulate interval/auto-mode timers and `triggerPolling`, and `useRouteAlerts` to watch `routeData`/`thresholdMinutes`, manage acknowledgement state, and surface toast payloads; keep them colocated in `apps/web/src/composables/`.
4. Rewire `RouteWidget.vue` to consume the new components/composables: the parent holds top-level refs from `useRouteTime`, wires props/emitters into children, and forwards toast notifications via `useToasts`; MapPreview stays inline but wrapped with the new summary/alerts components in the `main-content` slot.
5. Update settings flow so `RouteSettings.vue` receives the current model (`mode`, `refreshInterval`, `thresholdMinutes`, `isNavMode`) and emits structured events (`update:mode`, `update:refreshInterval`, `reset-threshold`, `save`); parent bridges those events back to composables and still handles toast messaging.
6. Ensure types/interfaces shared across components are exported through `apps/web/src/components/route/index.ts` if reused elsewhere, annotate exported functions’ return types, and add targeted unit tests (e.g. mount `RouteAlerts` in compact/expanded modes) plus update any existing widget tests.
7. Validate with `npm run build --workspace=@automata/web` (and targeted tests if present) to confirm strict TS settings stay green, then plan follow-up QA on route alert thresholds and auto-mode boundaries.

## Questions

- Do we have existing unit or E2E coverage for the Route widget that should be updated alongside the refactor, or should we create new tests from scratch?
- Create new unit tests for each new components. Update the Route Widget test to be a high level integration, and happy path functionality test.
- Are there UX expectations for the new subcomponents (e.g., design tweaks) beyond mirroring the current behavior?
  - No new UX expectation. Move appropriate styles into appropriate sub components ans tweak as needed.
