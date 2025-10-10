# Route Widget Compact Mode Plan

## Objectives
- Present core route metrics defined in `plan/compact_datapoints.md` through a smaller footprint that still reads clearly.
- Honor the global/per-widget compact preference managed by `useUiPreferences` so Route stays in sync with Weather and Discord.
- Preserve monitoring controls and alert awareness while reducing visual noise and maintaining accessibility.

## Current State Insights
- `RouteWidget.vue` now derives `isWidgetCompact('route-widget')` and forwards `:compact="isCompact"` to `PollingWidget`, yet the map preview, alert list, and status extras render regardless of that flag.
- `CompactModeControl` is already wired into the Route settings drawer, persisting overrides to localStorage alongside the global compact preference.
- `PollingWidget.vue` applies compact layout classes when the prop is set, but Route-specific markup and styles have not been tuned to benefit from the condensed spacing.
- Data fetching and alert watchers continue to run as before, so the widget still does work for sections that compact mode intends to hide; no compact-focused tests exist.

## Implementation Steps
1. **Gate heavy sections**
   - Wrap `MapPreview` and the detailed alert list in `v-if="!isCompact"` and provide a lightweight fallback (badge, icon, or summary line) so alert context is not lost.
   - Ensure status extra content respects the compact flag, keeping only essential text when space is limited.
2. **Condense the summary**
   - Adjust the `widget-summary` markup and styling to read well inside `polling-widget--compact`, trimming padding and ensuring duration/distance/cache text stay legible.
   - Verify the header subtitles and mode toggle spacing remain balanced when PollingWidget switches layouts.
3. **Trim unnecessary work**
   - Short-circuit watchers or computed branches that solely support hidden UI (e.g. skip constructing alert list items when compact).
   - Confirm toasts and alert emissions remain accurate even when the detailed list is suppressed.
4. **Align preferences UX**
   - Review helper copy in `CompactModeControl` so Route users understand the interaction between global and per-widget states.
   - Surface the global compact toggle entry point (or link to it) if Route needs to expose that control in its settings drawer.
5. **Accessibility and responsiveness**
   - Re-test keyboard flow and focus order with compact sections removed.
   - Fill negative space when visuals disappear and confirm narrow viewports do not collapse key information.

## Testing & Validation
- Extend Route widget unit tests to assert that compact mode hides the map/alert list and renders any new badges or summaries.
- Add regression coverage for the monitoring mode toggle, manual refresh, and alert acknowledgement workflows in both layouts.
- Run `npm run build --workspace=@automata/web` to verify the updated wiring passes TypeScript checks.

## Open Questions
- Should compact mode swap the detailed alert list for a badge or icon, or is it acceptable to omit alert visibility entirely?
**Answer: For now it swap to icon.
- Does navigation mode need a distinct compact variant (e.g. must the map stay visible) compared to simple mode?
** Answer: Compact mode should be similar to how it is now with a nav mode toggle that can show a map preview.
- Are we comfortable skipping MapPreview rendering entirely when compact, or do we need a static thumbnail as a fallback?
** Answer: We still need the map preview should the user want switch to nav mode. Nav mode should still work based off the automatic hour mode switch.
