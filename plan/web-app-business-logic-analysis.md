## Executive Summary

After analyzing the web application codebase, I've identified **significant business logic** that should be moved from the client-side to the API for improved reliability, security, and consistency. The current implementation has the client performing complex calculations, scheduling, and business rule enforcement that should be server-authoritative.

## Key Findings & Recommendations

### 1. Time-Based Business Logic (useAutoMode.ts)
**Current Location**: Client-side time window calculations  
**Business Logic**: Time range validation, mode switching logic, boundary calculations  
**Should Move**: ✅ **YES** - Time-based business rules should be server-authoritative

**Issues**:
- Client-side time calculations can be manipulated
- Different clients may have different time zones
- Complex boundary calculations should be centralized
- Mode switching logic should be consistent across all clients

**Recommended API Changes**:
```typescript
// New endpoint: GET /api/auto-mode/status
interface AutoModeStatusResponse {
  currentMode: 'Compact' | 'Nav';
  nextBoundary: string; // ISO timestamp
  activeWindow: {
    name: string;
    mode: 'Compact' | 'Nav';
    startTime: { hour: number; minute: number };
    endTime: { hour: number; minute: number };
  } | null;
  timeUntilNextBoundary: number; // seconds
}

// New endpoint: POST /api/auto-mode/config
interface AutoModeConfigUpdate {
  enabled?: boolean;
  timeWindows?: AutoModeTimeWindow[];
  defaultMode?: 'Compact' | 'Nav';
  navModeRefreshSeconds?: number;
}
```

### 2. Reminder Management (useDailyReminders.ts)
**Current Location**: Client-side reminder state management  
**Business Logic**: Overdue calculations, date handling, auto-refresh scheduling  
**Should Move**: ✅ **YES** - Reminder business rules should be centralized

**Issues**:
- Client calculates overdue status (15-minute window)
- Date validation and handling scattered across clients
- Auto-refresh scheduling logic duplicated
- Midnight update logic should be server-driven

**Recommended API Changes**:
```typescript
// Extend existing: GET /api/reminder
interface ReminderResponse {
  reminders: DailyReminder[];
  overdueCount: number; // Server-calculated
  expiresAfterMinutes: number;
  cache: CacheInfo;
  serverTime: string; // ISO timestamp for sync
}

// New endpoint: POST /api/reminder/auto-refresh
interface AutoRefreshConfig {
  enabled: boolean;
  intervalSeconds: number;
  midnightUpdate: boolean;
}
```

### 3. Complex Scheduling (autoModeScheduler.ts, midnightScheduler.ts)
**Current Location**: Client-side scheduling logic  
**Business Logic**: Time-based job scheduling, boundary calculations  
**Should Move**: ✅ **YES** - Scheduling should be server-side for reliability

**Issues**:
- Client-side timers unreliable (page refresh, browser suspension)
- Multiple clients may trigger same actions
- Time zone inconsistencies
- Resource intensive on client devices

**Recommended API Changes**:
```typescript
// New endpoint: GET /api/scheduler/status
interface SchedulerStatusResponse {
  autoModeJobs: ScheduledJob[];
  midnightJobs: ScheduledJob[];
  nextExecution: string | null; // ISO timestamp
}

// New endpoint: POST /api/scheduler/events
interface SchedulerEvent {
  type: 'mode-change' | 'midnight-update' | 'reminder-refresh';
  timestamp: string;
  data: Record<string, unknown>;
}
```

### 4. Data Fetching & Caching (useRouteTime.ts, useWeather.ts, useDiscord.ts)
**Current Location**: Client-side data management  
**Business Logic**: Cache invalidation, freshness calculations, polling logic  
**Should Move**: 🔄 **PARTIAL** - Some caching logic should be server-side

**Issues**:
- Each client maintains separate cache state
- Freshness calculations inconsistent across clients
- Polling logic duplicated
- No server-driven cache invalidation

**Recommended API Changes**:
```typescript
// Extend existing: GET /api/route-time
interface RouteTimeResponse {
  // ... existing fields
  cache: {
    hit: boolean;
    ageSeconds: number;
    staleWhileRevalidate: boolean;
    nextRefresh: string; // ISO timestamp
  };
  polling: {
    recommendedInterval: number; // seconds
    lastProviderCall: string; // ISO timestamp
  };
}

// New endpoint: POST /api/cache/invalidate
interface CacheInvalidationRequest {
  type: 'route' | 'weather' | 'discord' | 'reminder';
  keys?: string[];
  reason: string;
}
```

### 5. Alert Management (useRouteAlerts.ts, useAlertThreshold.ts)
**Current Location**: Client-side alert logic  
**Business Logic**: Threshold calculations, alert generation  
**Should Move**: ✅ **YES** - Alert rules should be server-authoritative

**Issues**:
- Threshold validation scattered across clients
- Alert generation logic duplicated
- No centralized alert history
- Inconsistent alert dismissal

**Recommended API Changes**:
```typescript
// New endpoint: GET /api/alerts/route
interface RouteAlertResponse {
  alerts: RouteAlert[];
  threshold: number;
  lastUpdated: string;
  acknowledged: boolean;
}

// New endpoint: POST /api/alerts/acknowledge
interface AlertAcknowledgeRequest {
  alertIds: string[];
  type: 'route' | 'weather' | 'reminder';
}

// Extend existing: GET /api/alerts/threshold
interface AlertThresholdResponse {
  thresholdMinutes: number;
  minThreshold: number;
  maxThreshold: number;
  lastUpdated: string;
}
```

### 6. Configuration Management
**Current Location**: Client-side config files and localStorage  
**Business Logic**: Configuration validation, defaults, persistence  
**Should Move**: ✅ **YES** - Configuration should be server-managed

**Issues**:
- Configuration scattered across JSON files and localStorage
- No validation consistency
- Difficult to update across all clients
- Default values not centralized

**Recommended API Changes**:
```typescript
// New endpoint: GET /api/config
interface AppConfigResponse {
  autoMode: AutoModeConfig;
  weather: WeatherConfig;
  discord: DiscordConfig;
  alerts: {
    defaultThresholdMinutes: number;
    minThreshold: number;
    maxThreshold: number;
  };
  ui: {
    defaultCompactMode: boolean;
    refreshIntervals: {
      route: number;
      weather: number;
      discord: number;
      reminder: number;
    };
  };
}

// New endpoint: POST /api/config
interface ConfigUpdateRequest {
  section: 'autoMode' | 'weather' | 'discord' | 'alerts' | 'ui';
  config: Record<string, unknown>;
}
```

## Migration Priority

### High Priority (Security & Consistency)
1. **Alert Management** - Server-authoritative thresholds and generation
2. **Auto-Mode Logic** - Time-based business rules
3. **Configuration Management** - Centralized config validation

### Medium Priority (Reliability)
4. **Reminder Management** - Server-side overdue calculations
5. **Scheduling Logic** - Server-driven job scheduling

### Low Priority (Optimization)
6. **Data Fetching** - Enhanced server-side caching
7. **Cache Management** - Server-driven invalidation

## Implementation Strategy

### Phase 1: Core Business Logic Migration
- Move alert threshold and generation logic to API
- Implement server-authoritative auto-mode calculations
- Create centralized configuration management

### Phase 2: Scheduling & Reminders
- Implement server-side scheduling for auto-mode switching
- Move reminder overdue calculations to API
- Create server-driven reminder refresh logic

### Phase 3: Enhanced Caching
- Implement server-side cache invalidation
- Add polling coordination
- Optimize data fetching patterns

## Benefits of Migration

1. **Security**: Prevent client-side manipulation of business rules
2. **Consistency**: Ensure all clients follow same logic
3. **Reliability**: Server-side scheduling more reliable than client-side
4. **Performance**: Reduce client-side computational overhead
5. **Maintainability**: Centralized logic easier to update and debug
6. **Scalability**: Server can optimize based on usage patterns

## Technical Considerations

1. **WebSocket Integration**: Real-time updates for mode changes and alerts
2. **Backward Compatibility**: Gradual migration with feature flags
3. **Performance**: Server-side caching to reduce external API calls
4. **Monitoring**: Server-side metrics for business logic execution
5. **Testing**: Centralized testing of business rules

## Conclusion

The current web application has significant business logic implemented on the client-side that should be migrated to the API for better security, consistency, and reliability. The recommended changes will create a more robust, maintainable, and scalable system while reducing the complexity of the client-side code.

## Files Analyzed

### Composables
- `apps/web/src/composables/useAutoMode.ts` - Time-based business logic
- `apps/web/src/composables/useDailyReminders.ts` - Reminder management
- `apps/web/src/composables/useRoutePolling.ts` - Polling and scheduling
- `apps/web/src/composables/useRouteTime.ts` - Route time calculations
- `apps/web/src/composables/useWeather.ts` - Weather data processing
- `apps/web/src/composables/useDiscord.ts` - Discord integration
- `apps/web/src/composables/useAlertThreshold.ts` - Alert threshold logic
- `apps/web/src/composables/useRouteAlerts.ts` - Route alert management

### Utilities
- `apps/web/src/utils/autoModeScheduler.ts` - Auto-mode scheduling logic
- `apps/web/src/utils/midnightScheduler.ts` - Midnight scheduling utilities

### Components
- `apps/web/src/components/reminder/ReminderWidget.vue` - Reminder widget logic
- `apps/web/src/components/route/RouteWidget.vue` - Route widget logic

### API Routes (Current)
- `apps/api/src/routes/routeTime.ts` - Route time endpoint
- `apps/api/src/routes/reminder.ts` - Reminder endpoints
- `apps/api/src/routes/weather.ts` - Weather endpoint
- `apps/api/src/routes/discord.ts` - Discord endpoint

## Next Steps

1. **Review and approve** the recommended API endpoint changes
2. **Prioritize** the migration phases based on business needs
3. **Implement** Phase 1 endpoints (Alert Management, Auto-Mode Logic, Configuration)
4. **Test** the new server-authoritative logic
5. **Migrate** client-side code to use new API endpoints
6. **Monitor** performance and reliability improvements
7. **Continue** with Phase 2 and 3 implementations
