# Weather Widget Compact Mode Plan

## Objectives
- Deliver a compact rendering path for the Weather widget that surfaces only the primary data points listed in `plan/compact_datapoints.md`.
- Honor a global compact mode toggle so the weather experience updates in lock-step with other polling widgets.
- Preserve existing non-compact behaviour behind the same component to avoid regressions in the rich layout.

## Current State Insights
- `apps/web/src/components/WeatherWidget.vue` already consumes `displaySettings` and `uiSettings` from `useWeatherConfig`, but the compact toggle only lives inside the widget’s settings drawer.
- The template renders extended content (hourly forecast, cache details, etc.) regardless of compact state, relying on flags such as `displaySettings.showHourlyForecast`.
- `PollingWidget.vue` controls the shared chrome but has no awareness of compact spacing or typography adjustments.
- No cross-widget store exists for shared preferences; each widget manages its own `compactMode`.

## Implementation Steps
1. **Introduce global compact mode state**
   - Create a new composable (e.g. `apps/web/src/composables/useUiPreferences.ts`) backed by a `type UiPreferencesState = { compactMode: boolean }` localStorage-friendly store.
   - Expose `isCompact`, `setCompactMode`, and `toggleCompactMode` along with an event emitter or ref so widgets can subscribe reactively.
   - Ensure the composable can be imported without pulling Vue-only helpers into runtime builds (align with existing TypeScript guidance).
2. **Bridge Weather configuration with the global toggle**
   - In `WeatherWidget.vue`, derive `const isCompact = computed(() => globalCompact.value ?? displaySettings.value.compactMode)`.
   - When the global toggle changes, reflect it through `updateUISettings({ compactMode: globalValue })` so the widget stays in sync without duplicating watchers.
   - Update the settings drawer to show the new global control status (disable or show helper text when overridden).
3. **Refine the compact layout**
   - Update the main summary block to strictly render: current temperature, current condition, location, humidity, and wind (respecting availability of each field).
   - Gate the hourly forecast, detailed cache text, and other secondary elements behind `!isCompact`.
   - Apply compact-specific classes (e.g. `polling-widget--compact`) via a new optional prop or CSS utility to reduce padding/typography.
4. **Adjust shared PollingWidget styling**
   - Add an optional `compact` boolean prop that applies reduced paddings/margins via classes so every widget benefits consistently.
   - Ensure prop defaults keep existing styling untouched, and document the new prop in the script setup section.
5. **Wire the global toggle into the app shell**
   - Surface a single control (likely in a global toolbar or settings sheet) that flips `compactMode` using the new composable, ensuring WeatherWidget reacts automatically.
   - Persist the choice if required (e.g. `localStorage`) without blocking SSR.

## Testing & Validation
- Expand `WeatherWidget` unit tests (create if missing) to assert that compact mode hides the hourly forecast and only renders the mandated data points.
- Add composable tests covering the new global preferences module, including default state and persistence behaviour.
- Run `npm run build --workspace=@automata/web` after wiring the global store to catch type regressions.

## Open Questions
- Should the per-widget compact toggle remain available as an override, or should the global setting fully control the state? The compact mode should be override-able for each widget via the widget settings.
- Do we need to persist global compact mode between sessions, and if so, where should that storage live (VueUse, custom helper, etc.)? Persist via local storage.
