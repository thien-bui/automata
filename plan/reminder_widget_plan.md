# Reminder Widget Implementation Plan

## Overview
- Build a reusable reminder widget that lists reminders for a given day, sorted from earliest to latest by scheduled time.
- Automatically remove reminders that are more than a configurable number of minutes past their scheduled time (default 15 minutes).
- Ensure recurring reminders generate daily instances so each day has a fresh set of reminders.
- Deliver both API and Vue/Vuetify frontend pieces, sharing strict TypeScript contracts across packages.

## Shared Types
- Add `ReminderTimeWindow`, `DailyReminder`, `DailyReminderPayload`, and `ReminderRemovalPolicy` type aliases in `packages/types/src/reminder.ts`.
- Export the new aliases through `packages/types/src/index.ts`.
- Keep all timestamps as UTC ISO-8601 strings to satisfy timezone guidance.

## Backend
- Introduce `apps/api/src/config/reminder.ts` to read `REMINDER_EXPIRE_WINDOW_MINUTES` (default 15) and expose helper utilities.
- Create repository adapter `apps/api/src/adapters/reminderRepository.ts` with `getRemindersForDate` and `seedRecurringReminders`, initially backed by Redis with JSON file seeding but ready for persistence.
- Add `apps/api/src/services/reminderScheduler.ts` to expand recurring templates into daily instances at startup (and optional daily cron hook).
- Implement Fastify route plugin `apps/api/src/routes/reminder/index.ts`:
  - Validate query `{ date: string }` via Zod.
  - Fetch matching reminders, filter out any more than the configured minutes past their `scheduledAt`, sort descending, and return `{ reminders, expiresAfterMinutes }`.
  - Inject dependencies via plugin options for testability and align with existing patterns.
  - Use the existing `redisPlugin` for data storage and caching.
- Cover route behavior and filtering logic with Fastify integration tests (`npm run test --workspace=@automata/api`).

## Frontend
- Create composable `apps/web/src/composables/useDailyReminders.ts` to fetch `/reminder?date=` and expose `reminders`, `isLoading`, `error`, `refresh`, and `overdueCount`.
- Build widget shell `apps/web/src/components/reminder/ReminderWidget.vue` using Vuetify `v-card`:
  - Accept optional `date` prop defaulting to today.
  - Display loading, empty, and error states with accessible Vuetify components.
  - Auto-refresh on an interval (e.g., every minute) so expired reminders disappear without a full page reload.
  - Follow existing component patterns seen in weather and route widgets.
- Add reusable subcomponents:
  - `ReminderWidgetHeader.vue` for date selection and manual refresh controls.
  - `ReminderListItem.vue` leveraging `v-list-item`, `v-chip`, and badges for recurring reminders.
  - `ReminderWidgetEmpty.vue` for no-reminder messaging.
- Convert UTC timestamps to local display using `Intl.DateTimeFormat`, ensuring keyboard and screen-reader accessibility.
- Leverage existing `useWidgetBase` composable for common widget functionality.

## Testing & Validation
- Write Vitest specs for the composable (mock API) and the widget components to verify sorting, filtering, and state rendering.
- Follow existing testing patterns: co-locate tests next to components using `*.spec.ts`.
- Run `npm run build --workspace=@automata/types` before shipping changes with new exports.
- Use existing test commands (`npm run test --workspace=@automata/api`, `npm run test --workspace=@automata/web`) and run targeted builds before shipping.

## Configuration & Data Management
- Store reminder templates in a JSON file that can be loaded into Redis at startup.
- Use Redis for runtime storage and caching, following existing patterns in the codebase.
- Keep expiration window global via configuration (not per-user).
- Maintain config-driven approach for recurring reminder templates.

## Open Questions
1. **JSON Template Structure**: What should the JSON template structure look like for recurring reminders? Should it include fields like title, description, scheduled time, recurrence pattern (daily, weekly, etc.), and priority? Include all those except priority.
2. **Reminder Categories**: Should reminders support categories or tags for better organization (e.g., "medication", "appointment", "daily routine")? It does not support categories.
3. **Notification Integration**: Should the reminder widget integrate with any notification systems (browser notifications, toast messages) when reminders are due or expiring? Integrate with toast message.
4. **Timezone Handling**: Should users be able to set their preferred timezone, or should we rely on browser timezone detection for display? All time should be stored in UTC, but displayed in local timezone.
5. **Reminder Actions**: Should reminders support actions (mark complete, snooze, dismiss) or are they read-only notifications? Reminders should support being marked as completed and removed from the task list.
6. **Priority Levels**: Should reminders support priority levels that affect their visual presentation or sorting order? Tasks should be ordered chronologically with the closes upcoming time set at the top. 
7. **Historical Data**: Should we maintain any historical data about completed/expired reminders, or are they immediately discarded? No need to maintain historical data.

## Best Practices Alignment
- **Type Safety**: Use strict TypeScript with proper type annotations for all exported functions
- **Error Handling**: Implement structured error handling with descriptive error codes
- **Performance**: Use Redis efficiently and implement proper caching strategies
- **Testing**: Maintain high test coverage with both unit and integration tests
- **Code Organization**: Follow established patterns for API routes, Vue components, and composables
- **Dependency Injection**: Use Fastify plugin options for testability and isolation
- **Logging**: Include proper structured logging for observability and debugging
