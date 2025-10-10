# Route Widget Compact Mode Plan

## Objectives
- Provide a compact presentation of route data limited to the primary data points in `plan/compact_datapoints.md`.
- Respect a shared global compact mode toggle that keeps Route, Weather, and Discord widgets visually consistent.
- Maintain existing monitoring controls (mode switch, alerts) while trimming secondary visuals for compact view.

## Current State Insights
- `RouteWidget.vue` renders the map preview, alert list, and other secondary content without considering a compact setting.
- No compact wiring exists in `useRouteTime` or related composables; the widget currently has no notion of `compactMode`.
- Polling chrome relies on `PollingWidget.vue`, which cannot yet adjust spacing for compact layouts.
- A global compact preference is not surfaced, so any new control must coordinate across widgets.

## Implementation Steps
1. **Adopt the shared compact preference**
   - Reuse the global composable introduced for Weather (e.g. `useUiPreferences`) to obtain a reactive `isCompact`.
   - Mirror the global state into any existing local storage (if added alongside Weather) so Route receives updates in real time.
   - Consider extending `@automata/types` with a `type PollingDisplayPrefs = { compactMode: boolean }` if cross-package sharing is required.
2. **Define compact rendering rules**
   - Limit the main summary to duration, distance, and the origin → destination subtitle already supplied via props.
   - Surface the current monitoring mode label in the header while hiding the map preview and alert list when compact.
   - Replace the removed visuals with concise text indicators if critical (e.g. show alert count badge instead of full list).
3. **Update template and script logic**
   - Add `const isCompact = computed(() => globalCompact.value)` and gate sections (`MapPreview`, alert `v-alert`, status text) behind `!isCompact`.
   - Ensure computed values and watchers that feed hidden sections do not perform expensive work when compact (early returns).
   - Thread `compact` into `PollingWidget` once the shared prop exists so padding/headings tighten appropriately.
4. **Expose global toggle in settings drawer**
   - Display the current compact status with helper copy (e.g. “Global compact mode enabled”).
   - If per-widget overrides are allowed, offer a tri-state control; otherwise, remove the local checkbox to avoid confusion.
5. **Accessibility and layout adjustments**
   - Verify keyboard focus order after removing elements—ensure the mode toggle and refresh buttons remain reachable.
   - Update responsive SCSS to avoid empty gaps when map/alerts are hidden, especially on narrow viewports.

## Testing & Validation
- Add or extend Route widget tests to confirm compact mode hides map and alerts while preserving duration/distance text.
- Create regression tests ensuring the monitoring mode toggle still emits events in both modes.
- Execute `npm run build --workspace=@automata/web` to confirm route updates align with TypeScript constraints.

## Open Questions
- Should we surface a summary of active alerts (count/status) in compact mode to avoid losing critical information entirely?
- Do we need a separate compact configuration for navigation vs simple mode, or is a single global flag sufficient?
