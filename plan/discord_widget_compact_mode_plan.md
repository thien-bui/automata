# Discord Widget Compact Mode Plan

## Objectives
- Enable a compact rendering of the Discord member status widget that surfaces the critical data points identified in `plan/compact_datapoints.md`.
- Align the widget with the global compact mode toggle so Discord visuals respond alongside Weather and Route.
- Preserve the ability to inspect individual member details when expanded while keeping the compact experience lightweight.

## Current State Insights
- `MemberStatusWidget.vue` already maintains a `displaySettings.compactMode` flag, but it is only configurable via the widget’s settings drawer.
- The component renders chips, avatars, and the full member list even when `compactMode` is `true`; only avatar sizes and chip visibility change.
- `useDiscordConfig` exposes both `displaySettings` and `uiSettings`, yet there is no shared store to sync with other widgets.
- Polling chrome lacks awareness of compact styling; spacing adjustments must be coordinated with Weather/Route.

## Implementation Steps
1. **Wire up the shared compact preference**
   - Import the global composable (`useUiPreferences`) and derive `const isCompact = computed(() => globalCompact.value ?? displaySettings.value.compactMode)`.
   - Update both `displaySettings` and `uiSettings` via `useDiscordConfig` helper methods when the global flag changes so persisted config matches the UI.
   - Ensure the settings drawer reflects when the global setting is active (disable the checkbox or show a helper note).
2. **Tighten compact data presentation**
   - In compact mode, display only the guild name, total/online counts, and a concise status breakdown (e.g. inline badges rather than full chips).
   - Replace the detailed member list with a trimmed view: show top N members or a collapsed summary (“View details” button) when compact is enabled.
   - Hide avatars and secondary metadata to reduce vertical space; keep screen-reader labels for accessibility.
3. **Introduce shared compact styling**
   - Utilize the new `compact` prop on `PollingWidget` (from Weather plan) to reduce padding and typography.
   - Add a scoped class (e.g. `.member-status--compact`) to adjust grid gaps, font sizes, and spacing for the summary counters.
4. **Performance considerations**
   - When compact, avoid computing or sorting the full member list if it will not be rendered; lazily evaluate when expanding to the full view.
   - Ensure that toggling between compact and expanded modes does not trigger unnecessary re-fetches or watchers.
5. **Extend global toggle exposure**
   - Surface the shared compact toggle in a global toolbar/settings entry so Discord users can opt-in/out without opening the widget-specific drawer.
   - Coordinate analytics or logging if required to understand usage of the new mode.

## Testing & Validation
- Update `MemberStatusWidget` unit tests to assert that compact mode hides avatars/member list and only renders the minimal summary data.
- Add coverage for the global composable to ensure Discord-specific watchers correctly propagate overrides.
- Run `npm run build --workspace=@automata/web` to verify type safety after wiring the new store.

## Open Questions
- How should we handle “Show More” interactions when the global compact mode is active—should expanding temporarily disable compact mode for the widget? In compact mode, there is not show more option.
- Do we need persistence (e.g. local storage) for display preferences per user, or is an in-memory toggle sufficient for now? In memory toggle.
