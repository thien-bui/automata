# Business Logic Migration - Actionable Implementation Plan
Refer to plan/web-app-business-logic-analysis.md for indepth analysis.

## Overview
This document provides a step-by-step implementation plan for migrating business logic from the client-side to the API. Each task is actionable and can be implemented iteratively.

## Phase 1: Core Business Logic Migration (High Priority)

### 1.1 Alert Management Migration
- [ ] **Task 1.1.1**: Create alert threshold API endpoint
  - File: `apps/api/src/routeUpdate the md files/alert.ts`
  - Endpoint: `GET /api/alerts/threshold`
  - Interface: `AlertThresholdResponse`
  - Dependencies: None

- [ ] **Task 1.1.2**: Create route alerts API endpoint
  - File: `apps/api/src/routes/alert.ts`
  - Endpoint: `GET /api/alerts/route`
  - Interface: `RouteAlertResponse`
  - Dependencies: Task 1.1.1

- [ ] **Task 1.1.3**: Create alert acknowledgment API endpoint
  - File: `apps/api/src/routes/alert.ts`
  - Endpoint: `POST /api/alerts/acknowledge`
  - Interface: `AlertAcknowledgeRequest`
  - Dependencies: Task 1.1.2

- [ ] **Task 1.1.4**: Update client composable to use new API
  - File: `apps/web/src/composables/useAlertThreshold.ts`
  - Replace localStorage with API calls
  - Dependencies: Task 1.1.1

- [ ] **Task 1.1.5**: Update route alerts composable to use new API
  - File: `apps/web/src/composables/useRouteAlerts.ts`
  - Replace client-side calculations with API calls
  - Dependencies: Task 1.1.2, Task 1.1.3

### 1.2 Auto-Mode Logic Migration
- [ ] **Task 1.2.1**: Create auto-mode status API endpoint
  - File: `apps/api/src/routes/autoMode.ts`
  - Endpoint: `GET /api/auto-mode/status`
  - Interface: `AutoModeStatusResponse`
  - Dependencies: None

- [ ] **Task 1.2.2**: Create auto-mode configuration API endpoint
  - File: `apps/api/src/routes/autoMode.ts`
  - Endpoint: `POST /api/auto-mode/config`
  - Interface: `AutoModeConfigUpdate`
  - Dependencies: Task 1.2.1

- [ ] **Task 1.2.3**: Create auto-mode scheduler service
  - File: `apps/api/src/services/autoModeScheduler.ts`
  - Server-side time window calculations
  - Dependencies: Task 1.2.1

- [ ] **Task 1.2.4**: Update client composable to use new API
  - File: `apps/web/src/composables/useAutoMode.ts`
  - Replace client-side calculations with API calls
  - Dependencies: Task 1.2.1, Task 1.2.3

- [ ] **Task 1.2.5**: Remove client-side scheduler utilities
  - File: `apps/web/src/utils/autoModeScheduler.ts`
  - Delete file after migration
  - Dependencies: Task 1.2.4

### 1.3 Configuration Management Migration
- [ ] **Task 1.3.1**: Create configuration API endpoint
  - File: `apps/api/src/routes/config.ts`
  - Endpoint: `GET /api/config`
  - Interface: `AppConfigResponse`
  - Dependencies: None

- [ ] **Task 1.3.2**: Create configuration update API endpoint
  - File: `apps/api/src/routes/config.ts`
  - Endpoint: `POST /api/config`
  - Interface: `ConfigUpdateRequest`
  - Dependencies: Task 1.3.1

- [ ] **Task 1.3.3**: Create configuration service
  - File: `apps/api/src/services/configService.ts`
  - Centralized config validation and defaults
  - Dependencies: Task 1.3.1

- [ ] **Task 1.3.4**: Update client to use API configuration
  - File: `apps/web/src/composables/useUiPreferences.ts`
  - Replace localStorage with API calls
  - Dependencies: Task 1.3.1, Task 1.3.3

- [ ] **Task 1.3.5**: Remove client-side config files
  - Files: `apps/web/src/config/*.json`
  - Delete files after migration
  - Dependencies: Task 1.3.4

## Phase 2: Scheduling & Reminders (Medium Priority)

### 2.1 Server-Side Scheduling
- [ ] **Task 2.1.1**: Create scheduler status API endpoint
  - File: `apps/api/src/routes/scheduler.ts`
  - Endpoint: `GET /api/scheduler/status`
  - Interface: `SchedulerStatusResponse`
  - Dependencies: Phase 1 complete

- [ ] **Task 2.1.2**: Create scheduler events API endpoint
  - File: `apps/api/src/routes/scheduler.ts`
  - Endpoint: `POST /api/scheduler/events`
  - Interface: `SchedulerEvent`
  - Dependencies: Task 2.1.1

- [ ] **Task 2.1.3**: Create server-side scheduler service
  - File: `apps/api/src/services/schedulerService.ts`
  - Replace client-side scheduling logic
  - Dependencies: Task 2.1.1

- [ ] **Task 2.1.4**: Update client to use server scheduling
  - File: `apps/web/src/composables/useRoutePolling.ts`
  - Replace client-side polling with server coordination
  - Dependencies: Task 2.1.3

- [ ] **Task 2.1.5**: Remove client-side scheduling utilities
  - File: `apps/web/src/utils/midnightScheduler.ts`
  - Delete file after migration
  - Dependencies: Task 2.1.4

### 2.2 Reminder Management Enhancement
- [ ] **Task 2.2.1**: Enhance reminder API with server calculations
  - File: `apps/api/src/routes/reminder.ts`
  - Add `overdueCount` and `serverTime` to response
  - Dependencies: Phase 1 complete

- [ ] **Task 2.2.2**: Create reminder auto-refresh API endpoint
  - File: `apps/api/src/routes/reminder.ts`
  - Endpoint: `POST /api/reminder/auto-refresh`
  - Interface: `AutoRefreshConfig`
  - Dependencies: Task 2.2.1

- [ ] **Task 2.2.3**: Update reminder composable to use enhanced API
  - File: `apps/web/src/composables/useDailyReminders.ts`
  - Replace client-side overdue calculations
  - Dependencies: Task 2.2.1, Task 2.2.2

- [ ] **Task 2.2.4**: Update reminder widget to use server time
  - File: `apps/web/src/components/reminder/ReminderWidget.vue`
  - Replace client-side date handling
  - Dependencies: Task 2.2.3

## Phase 3: Enhanced Caching (Low Priority)

### 3.1 Server-Side Cache Management
- [ ] **Task 3.1.1**: Create cache invalidation API endpoint
  - File: `apps/api/src/routes/cache.ts`
  - Endpoint: `POST /api/cache/invalidate`
  - Interface: `CacheInvalidationRequest`
  - Dependencies: Phase 2 complete

- [ ] **Task 3.1.2**: Enhance route time API with polling info
  - File: `apps/api/src/routes/routeTime.ts`
  - Add `polling` and enhanced `cache` fields
  - Dependencies: Task 3.1.1

- [ ] **Task 3.1.3**: Update route time composable
  - File: `apps/web/src/composables/useRouteTime.ts`
  - Use server-provided polling recommendations
  - Dependencies: Task 3.1.2

- [ ] **Task 3.1.4**: Update weather composable
  - File: `apps/web/src/composables/useWeather.ts`
  - Use server-provided polling recommendations
  - Dependencies: Task 3.1.2

- [ ] **Task 3.1.5**: Update Discord composable
  - File: `apps/web/src/composables/useDiscord.ts`
  - Use server-provided polling recommendations
  - Dependencies: Task 3.1.2

## Implementation Guidelines

### Before Starting Each Task
1. Review the existing code patterns in the API
2. Check for existing utilities that can be reused
3. Ensure TypeScript strict mode compliance
4. Plan testing strategy

### During Implementation
1. Follow established Fastify plugin patterns
2. Use dependency injection via plugin options
3. Implement proper error handling with structured responses
4. Add Zod validation for all inputs
5. Include comprehensive logging

### After Implementation
1. Run `npm run build --workspace=@automata/api`
2. Run relevant test suites
3. Verify no TypeScript errors
4. Test functionality end-to-end
5. Update this todo list

### Testing Strategy
- **Unit Tests**: Test each new API endpoint with Vitest
- **Integration Tests**: Test API endpoints with Fastify test server
- **E2E Tests**: Verify client integration with Playwright
- **Migration Tests**: Ensure backward compatibility during transition

### Success Criteria
- [ ] All Phase 1 tasks completed and tested
- [ ] Client-side business logic reduced by 60%+
- [ ] Server-authoritative calculations implemented
- [ ] No regression in functionality
- [ ] Improved consistency across clients
- [ ] Enhanced security through server-side validation

### Risk Mitigation
- **Backward Compatibility**: Implement feature flags for gradual migration
- **Performance**: Monitor server load during implementation
- **Testing**: Comprehensive test coverage for each migration step
- **Rollback Plan**: Keep client-side logic until fully validated

## Dependencies Between Tasks

```
Phase 1:
├── Alert Management (1.1.1 → 1.1.5)
├── Auto-Mode Logic (1.2.1 → 1.2.5)
└── Configuration (1.3.1 → 1.3.5)

Phase 2:
├── Server Scheduling (2.1.1 → 2.1.5) [depends on Phase 1]
└── Reminder Enhancement (2.2.1 → 2.2.4) [depends on Phase 1]

Phase 3:
└── Cache Management (3.1.1 → 3.1.5) [depends on Phase 2]
```

## Next Steps
1. Review and approve this implementation plan
2. Start with Task 1.1.1 (Alert threshold API)
3. Implement tasks in order within each phase
4. Test thoroughly after each task completion
5. Monitor performance and reliability improvements
6. Proceed to next phase after successful completion
