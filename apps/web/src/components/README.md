# Shared Widget Components

This directory contains shared components and composables that encapsulate common functionality between widgets in the application.

## Components

### BaseWidget.vue

A flexible base component that provides the common UI structure and behavior for data widgets.

#### Props

- `overlineText: string` - The overline text displayed in the header
- `title: string` - The main title displayed in the header
- `subtitle: string` - The subtitle displayed in the header
- `errorTitle?: string` - Title for error alerts (default: "Error")
- `settingsTitle?: string` - Title for settings dialog (default: "Settings")
- `error: string | null` - Current error message to display
- `isPolling: boolean` - Whether the widget is currently refreshing data
- `lastUpdatedIso: string | null` - ISO timestamp of last update
- `isStale: boolean` - Whether the current data is stale
- `pollingSeconds: number` - Current polling interval in seconds
- `cacheDescription?: string` - Description of cache status

#### Slots

- `title-actions` - Additional actions in the header (before settings button)
- `main-content` - Main content area for displaying widget-specific data
- `status-extra` - Additional status information below the polling interval
- `settings-content` - Settings form content

#### Events

- `@manual-refresh` - Emitted when user clicks "Refresh now"
- `@hard-refresh` - Emitted when user clicks "Hard refresh"
- `@save-settings` - Emitted when user saves settings

#### Usage Example

```vue
<template>
  <BaseWidget
    overline-text="Weather"
    title="Current Conditions"
    :subtitle="locationLabel"
    :error="weatherError"
    :is-polling="isPolling"
    :last-updated-iso="lastUpdatedIso"
    :is-stale="isStale"
    :polling-seconds="pollingSeconds"
    :cache-description="cacheDescription"
    @manual-refresh="handleManualRefresh"
    @hard-refresh="handleHardRefresh"
    @save-settings="handleSaveSettings"
  >
    <template #main-content>
      <v-sheet class="pa-4" elevation="1" rounded>
        <!-- Your widget-specific content here -->
      </v-sheet>
    </template>

    <template #settings-content>
      <v-text-field
        v-model="locationInput"
        label="Location"
        variant="outlined"
      />
    </template>
  </BaseWidget>
</template>
```

## Composables

### useWidgetBase.ts

A composable that provides common widget functionality including polling, error handling, and user notifications.

#### Options

```typescript
interface UseWidgetBaseOptions {
  freshnessSeconds?: number;           // Default polling interval
  errorTitle?: string;                 // Error title for notifications
  successMessage?: string;             // Success message for manual refresh
  hardRefreshSuccessMessage?: string;  // Success message for hard refresh
  staleWarningMessage?: string;        // Warning message for stale data
}
```

#### Return Values

```typescript
interface UseWidgetBaseResult {
  isPolling: ComputedRef<boolean>;           // Whether currently polling
  pollingSeconds: Ref<number>;               // Current polling interval
  statusText: ComputedRef<string>;           // Status text for display
  progressValue: ComputedRef<number | undefined>; // Progress indicator value
  lastErrorMessage: Ref<string | null>;      // Last error message
  staleNotified: Ref<boolean>;               // Whether stale data was notified
  
  // Methods
  triggerPolling: (reason: BaseFetchReason, options?: { forceRefresh?: boolean }) => Promise<void>;
  setupPolling: (refreshFn: RefreshFunction, pollingSecondsRef: Ref<number>) => void;
  cleanupPolling: () => void;
  watchForErrors: (errorRef: Ref<string | null>) => void;
  watchForStaleData: (isStaleRef: ComputedRef<boolean>, hasDataRef: ComputedRef<boolean>) => void;
}
```

#### Usage Example

```typescript
import { useWidgetBase, type BaseFetchReason } from '../composables/useWidgetBase';

const {
  isPolling,
  pollingSeconds,
  setupPolling,
  watchForErrors,
  watchForStaleData,
  triggerPolling,
} = useWidgetBase({
  successMessage: 'Weather data refreshed.',
  hardRefreshSuccessMessage: 'Weather data refreshed from provider.',
  staleWarningMessage: 'Showing cached weather data while waiting for a fresh provider response.',
});

// Set up polling with your refresh function
setupPolling(weatherRefreshFunction, pollingSeconds);

// Watch for errors and stale data
watchForErrors(weatherError);
watchForStaleData(isStale, computed(() => weatherData.value !== null));

// Trigger manual refresh
function handleManualRefresh() {
  void triggerPolling('manual');
}

// Trigger hard refresh
function handleHardRefresh() {
  void triggerPolling('hard-manual', { forceRefresh: true });
}
```

## Example Implementation

See `ExampleWidget.vue` for a complete example of how to use the shared components together. This example demonstrates:

- Using BaseWidget with custom content
- Integrating useWidgetBase for polling and error handling
- Implementing settings with form inputs
- Handling refresh events
- Displaying mock data with loading states

## Benefits

1. **Consistency**: All widgets share the same UI patterns and behavior
2. **Maintainability**: Common functionality is centralized and easier to update
3. **Flexibility**: Slots and props allow for customization while maintaining structure
4. **Reduced Duplication**: Eliminates code duplication between similar widgets
5. **Type Safety**: Full TypeScript support with proper interfaces

## Migration Guide

To migrate existing widgets to use the shared components:

1. Replace the common UI structure with BaseWidget
2. Move widget-specific content into the appropriate slots
3. Replace manual polling logic with useWidgetBase
4. Update event handlers to use the composable's methods
5. Configure the composable with widget-specific messages

The migration maintains all existing functionality while reducing code duplication and improving consistency.
