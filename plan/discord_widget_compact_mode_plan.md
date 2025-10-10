# Discord Widget Compact Mode Plan

## Objectives
- Deliver a compact Discord member summary that highlights totals and status counts from `plan/compact_datapoints.md` without overwhelming the layout.
- Respect the global/per-widget compact preference exposed by `useUiPreferences`, keeping Discord aligned with Weather and Route widget behavior.
- Preserve access to detailed member information on demand while trimming default rendering cost and visual noise in compact mode.

## Current State Insights
- `MemberStatusWidget.vue` now calls `isWidgetCompact('member-status-widget')` and forwards the flag to `PollingWidget`, but the template still renders chips, avatars, and the full member grid even when compact.
- `CompactModeControl` is present in the settings drawer, yet helper text does not clarify the relationship between global and per-widget overrides.
- The member list is always filtered, sorted, and sliced before rendering, so compact mode still performs the full computation work even if we later hide the list.
- Polling chrome receives the compact prop, but the widget lacks scoped styles and template guards to make use of the tighter spacing.

## Implementation Steps
1. **Gate non-essential UI**
   - Skip rendering the status chip group, full member grid, and avatar decorations when `isCompact` is true; replace with a concise status summary (badge row or list) and optional “Expand details” control.
   - Ensure the “Show More” toggle either disappears or opens a separate expanded view without conflicting with the compact layout.
2. **Introduce compact-specific styling**
   - Add a compact wrapper class (e.g. `member-status-widget--compact`) to trim padding, adjust typography, and keep the guild overview readable inside `polling-widget--compact`.
   - Verify the summary section aligns vertically with the PollingWidget spacing and avoids empty gutters.
3. **Optimize computed work**
   - Short-circuit member sorting/filtering when the compact path avoids rendering the list, or lazily compute the list only when the user expands details.
   - Ensure alerting/toast behavior and polling cadence remain unaffected by the new branching.
4. **Clarify preference UX**
   - Update `CompactModeControl` helper copy (or add supporting text near the control) to explain how global overrides interact with widget-specific choices for Discord.
   - Consider surfacing the global compact toggle entry point if Discord is often the widget where users look for the control.
5. **Hardening and accessibility**
   - Reevaluate focus order after hiding interactive elements so the remaining controls remain keyboard-friendly.
   - Confirm that screen reader announcements still expose online totals and status changes even when avatars and chips are hidden.

## Testing & Validation
- Extend `MemberStatusWidget` unit tests to cover compact mode: expect status chips/member list to be hidden, summary text to remain, and any expand controls to behave.
- Add a test double to `useUiPreferences` in specs verifying that per-widget overrides flip between compact and full render paths.
- Run `npm run build --workspace=@automata/web` to ensure the compact-mode refactor stays within TypeScript constraints.

## Open Questions
- Should compact mode offer a dedicated “Expand member details” action, or do we keep the full list inaccessible until the user disables compact?
** Answer: Compact mode should show a list of members and their online status. This can be the same component currently being used in the detailed view.
- Do we want to promote the status breakdown summary into a reusable composable/shared component for Weather/Route consistency?
** Answer: Yes, break up the discord widget component to reduce complexity and promose reusability.
- Is it acceptable to skip computing the member list when compact, even if analytics or other consumers rely on the filtered data downstream?
** The member list and status needs to be available in compact mode.
