# WeatherWidget Decomposition Strategy

## Current Problem Analysis

The WeatherWidget component currently handles:
- **Data fetching and state management** (weather data, errors, loading states)
- **Configuration management** (location, refresh intervals, display settings)
- **UI rendering** (current conditions, hourly forecast, settings panel)
- **Polling logic** (interval management, manual refresh)
- **Toast notifications** (success, error, warning messages)
- **Compact mode adaptation** (responsive layout changes)
- **Multiple display modes** (full vs compact layout)

## Proposed Component Hierarchy

```
WeatherWidget (Container)
├── WeatherSummary (Current Conditions)
│   ├── TemperatureDisplay
│   ├── ConditionDisplay
│   └── WeatherMetrics (Humidity, Wind, etc.)
├── HourlyForecast (When expanded)
│   ├── HourlyItem
│   └── CurrentHourIndicator
├── WeatherSettings (Drawer)
│   ├── LocationInput
│   ├── RefreshIntervalInput
│   └── CompactModeToggle
└── PollingWidget (Base wrapper)
```

## Component Breakdown Strategy

### 1. WeatherSummary Component
**Purpose**: Display current weather conditions in a compact, focused manner.

**Extracted from**: The main template's weather summary card section.

**Props**:
```typescript
interface WeatherSummaryProps {
  temperature: string;
  condition: string;
  humidity?: string;
  wind?: string;
  isCompact: boolean;
  showMetrics: boolean;
}
```

**Features**:
- Temperature display with proper formatting
- Weather condition description
- Optional metrics (humidity, wind speed)
- Responsive layout for compact mode

### 2. HourlyForecast Component
**Purpose**: Display hourly weather forecast in a horizontal scrollable layout.

**Props**:
```typescript
interface HourlyForecastProps {
  data: HourlyWeatherData[];
  isCompact: boolean;
  displaySettings: WeatherDisplaySettings;
}
```

**Features**:
- Horizontal scrollable layout
- Current hour highlighting
- Weather icons and temperatures
- Optional detailed metrics

### 3. WeatherSettings Component
**Purpose**: Handle all weather-related settings in a dedicated component.

**Props**:
```typescript
interface WeatherSettingsProps {
  location: string;
  refreshInterval: number;
  compactMode: boolean;
  globalCompactEnabled: boolean;
  onSave: (settings: WeatherSettingsData) => void;
}
```

**Features**:
- Location input with validation
- Refresh interval configuration
- Compact mode toggle
- Settings persistence

### 4. TemperatureDisplay Component
**Purpose**: Reusable component for displaying temperatures with proper formatting.

**Props**:
```typescript
interface TemperatureDisplayProps {
  celsius: number;
  fahrenheit: number;
  unit: 'celsius' | 'fahrenheit' | 'both';
}
```

### 5. WeatherMetrics Component
**Purpose**: Display weather metrics like humidity, wind speed, etc.

**Props**:
```typescript
interface WeatherMetricsProps {
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  showHumidity: boolean;
  showWindSpeed: boolean;
  showPrecipitation: boolean;
}
```

## Implementation Plan

### Phase 1: Extract Core Display Components
1. Create `WeatherSummary.vue` - Extract the current conditions display
2. Create `HourlyForecast.vue` - Extract the hourly forecast section
3. Create `WeatherSettings.vue` - Extract the settings drawer content

### Phase 2: Create Reusable Utility Components
1. Create `TemperatureDisplay.vue` - Reusable temperature formatting
2. Create `WeatherMetrics.vue` - Reusable metrics display
3. Create `HourlyItem.vue` - Individual hourly forecast item

### Phase 3: Refactor Main Component
1. Update `WeatherWidget.vue` to use new components
2. Extract complex computed properties into composables
3. Simplify the main component's template and script

### Phase 4: Enhance Type Safety
1. Create proper TypeScript interfaces for all component props
2. Add validation for all user inputs
3. Improve error handling patterns

## Benefits of This Approach

### 1. Improved Maintainability
- Each component has a single, clear responsibility
- Easier to test individual components
- Clearer separation of concerns

### 2. Better Reusability
- `TemperatureDisplay` can be used in other widgets
- `WeatherMetrics` can be shared across weather-related components
- Consistent UI patterns across the application

### 3. Enhanced Testability
```typescript
// Example test structure
describe('WeatherSummary', () => {
  it('displays temperature correctly', () => { /* ... */ });
  it('adapts to compact mode', () => { /* ... */ });
```

### 4. Better Performance
- Smaller, more focused components
- More granular reactivity
- Better code splitting opportunities

### 5. Improved Developer Experience
- Clear component boundaries
- Intuitive prop interfaces
- Consistent patterns across the codebase

## Specific Extraction Opportunities

### From Computed Properties:
- `currentTemperatureDisplay` → Move to `TemperatureDisplay`
- `currentConditionDisplay` → Move to `ConditionDisplay`
- `humidityDisplay`, `windDisplay` → Move to `WeatherMetrics`

### From Methods:
- `formatTemperature` → Move to `TemperatureDisplay`
- `formatHour` → Move to `HourlyForecast`
- `getWeatherIcon` → Extract to utility function or composable

## Recommended Next Steps

1. **Start with WeatherSummary** - This is the most self-contained and can be extracted with minimal dependencies.

2. **Create shared composables** for weather data formatting and icon mapping.

3. **Update tests** to reflect the new component structure.

4. **Document component APIs** with proper TypeScript documentation.

## Risk Mitigation

- **Backward Compatibility**: Keep existing props and behavior intact during extraction
- **Testing**: Write tests for new components before refactoring
- **Incremental Approach**: Extract one component at a time and verify functionality

This decomposition strategy will transform the monolithic WeatherWidget into a collection of focused, reusable components that are easier to maintain, test, and extend.
