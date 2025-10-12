# AutoMode Configuration

The AutoMode feature allows the RouteWidget to automatically switch between Compact and Navigation modes based on configurable time windows.

## Configuration File

The AutoMode configuration is stored in `automode-config.json` and contains the following structure:

```json
{
  "autoMode": {
    "enabled": true,
    "timeWindows": [
      {
        "name": "morning-commute",
        "mode": "Nav",
        "startTime": { "hour": 8, "minute": 30 },
        "endTime": { "hour": 9, "minute": 30 },
        "daysOfWeek": [1, 2, 3, 4, 5],
        "description": "Morning commute window"
      },
      {
        "name": "evening-commute",
        "mode": "Nav",
        "startTime": { "hour": 17, "minute": 0 },
        "endTime": { "hour": 20, "minute": 0 },
        "daysOfWeek": [1, 2, 3, 4, 5],
        "description": "Evening commute window"
      }
    ],
    "defaultMode": "Compact",
    "navModeRefreshSeconds": 300
  }
}
```

## Configuration Options

### enabled
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether AutoMode is enabled or disabled. When disabled, the widget will always use the `defaultMode`.

### timeWindows
- **Type**: `Array<AutoModeTimeWindow>`
- **Description**: An array of time windows that define when specific modes should be active.

#### TimeWindow Properties

- **name**: `string` - A descriptive name for the time window
- **mode**: `'Compact' | 'Nav'` - The mode to activate during this time window
- **startTime**: `{ hour: number, minute: number }` - Start time (24-hour format)
- **endTime**: `{ hour: number, minute: number }` - End time (24-hour format, exclusive)
- **daysOfWeek**: `number[]` - Days of the week when this window applies (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
- **description**: `string` (optional) - Human-readable description

### defaultMode
- **Type**: `'Compact' | 'Nav'`
- **Default**: `'Compact'`
- **Description**: The mode to use when no time windows are active or when AutoMode is disabled.

### navModeRefreshSeconds
- **Type**: `number`
- **Default**: `300`
- **Description**: The polling interval in seconds when in Navigation mode.

## Usage Examples

### Weekend Configuration
To enable Nav mode on weekends:

```json
{
  "timeWindows": [
    {
      "name": "weekend-morning",
      "mode": "Nav",
      "startTime": { "hour": 9, "minute": 0 },
      "endTime": { "hour": 12, "minute": 0 },
      "daysOfWeek": [0, 6],
      "description": "Weekend morning activities"
    }
  ]
}
```

### 24/7 Navigation Mode
To keep Nav mode active all the time:

```json
{
  "timeWindows": [
    {
      "name": "always-nav",
      "mode": "Nav",
      "startTime": { "hour": 0, "minute": 0 },
      "endTime": { "hour": 23, "minute": 59 },
      "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],
      "description": "Always in navigation mode"
    }
  ]
}
```

### Multiple Windows Per Day
To have multiple active periods:

```json
{
  "timeWindows": [
    {
      "name": "morning-commute",
      "mode": "Nav",
      "startTime": { "hour": 7, "minute": 30 },
      "endTime": { "hour": 9, "minute": 0 },
      "daysOfWeek": [1, 2, 3, 4, 5]
    },
    {
      "name": "lunch-break",
      "mode": "Nav",
      "startTime": { "hour": 12, "minute": 0 },
      "endTime": { "hour": 13, "minute": 0 },
      "daysOfWeek": [1, 2, 3, 4, 5]
    },
    {
      "name": "evening-commute",
      "mode": "Nav",
      "startTime": { "hour": 17, "minute": 0 },
      "endTime": { "hour": 18, "minute": 30 },
      "daysOfWeek": [1, 2, 3, 4, 5]
    }
  ]
}
```

## Implementation Details

The AutoMode logic is implemented in the `useAutoMode` composable, which provides:

- `resolveModeForDate(date)`: Determines the appropriate mode for a given date/time
- `getNextBoundary(date)`: Calculates the next time boundary when mode switching should occur
- `getNavModeRefreshSeconds()`: Returns the configured refresh interval for Nav mode
- `isEnabled`: A computed property indicating if AutoMode is enabled
- `updateConfig()`: Allows runtime configuration updates
- `resetConfig()`: Resets to default configuration

The RouteWidget uses this composable to automatically switch modes and schedule the next mode change.
