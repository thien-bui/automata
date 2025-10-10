import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { ref, computed } from 'vue';
import WeatherWidget from '../WeatherWidget.vue';
import { provideToasts } from '../../composables/useToasts';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

// Mock the useWeather composable
vi.mock('../../composables/useWeather', () => ({
  useWeather: vi.fn(() => ({
    data: ref({
      hourlyData: [
        {
          timestamp: '2025-10-06T17:00:00Z', // 3 hours prior
          temperatureCelsius: 18,
          temperatureFahrenheit: 64,
          condition: 'Clear',
          humidityPercent: 55,
          windSpeedKph: 5,
          precipitationProbability: 0
        },
        {
          timestamp: '2025-10-06T18:00:00Z', // 2 hours prior
          temperatureCelsius: 19,
          temperatureFahrenheit: 66,
          condition: 'Partly cloudy',
          humidityPercent: 58,
          windSpeedKph: 7,
          precipitationProbability: 10
        },
        {
          timestamp: '2025-10-06T19:00:00Z', // 1 hour prior
          temperatureCelsius: 21,
          temperatureFahrenheit: 70,
          condition: 'Partly cloudy',
          humidityPercent: 62,
          windSpeedKph: 8,
          precipitationProbability: 15
        },
        {
          timestamp: '2025-10-06T20:00:00Z', // Current hour
          temperatureCelsius: 22,
          temperatureFahrenheit: 72,
          condition: 'Partly cloudy',
          humidityPercent: 65,
          windSpeedKph: 10,
          precipitationProbability: 20
        },
        {
          timestamp: '2025-10-06T21:00:00Z', // 1 hour after
          temperatureCelsius: 20,
          temperatureFahrenheit: 68,
          condition: 'Clear',
          humidityPercent: 60,
          windSpeedKph: 8,
          precipitationProbability: 0
        },
        {
          timestamp: '2025-10-06T22:00:00Z', // 2 hours after
          temperatureCelsius: 18,
          temperatureFahrenheit: 64,
          condition: 'Clear',
          humidityPercent: 55,
          windSpeedKph: 5,
          precipitationProbability: 0
        },
        {
          timestamp: '2025-10-06T23:00:00Z', // 3 hours after
          temperatureCelsius: 17,
          temperatureFahrenheit: 63,
          condition: 'Clear',
          humidityPercent: 52,
          windSpeedKph: 4,
          precipitationProbability: 0
        },
        {
          timestamp: '2025-10-07T00:00:00Z', // 4 hours after
          temperatureCelsius: 16,
          temperatureFahrenheit: 61,
          condition: 'Clear',
          humidityPercent: 50,
          windSpeedKph: 3,
          precipitationProbability: 0
        },
        {
          timestamp: '2025-10-07T01:00:00Z', // 5 hours after
          temperatureCelsius: 15,
          temperatureFahrenheit: 59,
          condition: 'Clear',
          humidityPercent: 48,
          windSpeedKph: 3,
          precipitationProbability: 0
        },
        {
          timestamp: '2025-10-07T02:00:00Z', // 6 hours after
          temperatureCelsius: 14,
          temperatureFahrenheit: 57,
          condition: 'Clear',
          humidityPercent: 46,
          windSpeedKph: 2,
          precipitationProbability: 0
        },
        {
          timestamp: '2025-10-07T03:00:00Z', // 7 hours after
          temperatureCelsius: 13,
          temperatureFahrenheit: 55,
          condition: 'Clear',
          humidityPercent: 45,
          windSpeedKph: 2,
          precipitationProbability: 0
        }
      ],
      provider: 'google-weather',
      lastUpdatedIso: '2025-10-06T20:00:00Z',
      cache: { hit: false, ageSeconds: 0, staleWhileRevalidate: false }
    }),
    error: ref(null),
    isLoading: ref(false),
    isRefreshing: ref(false),
    isStale: computed(() => false),
    lastUpdatedIso: computed(() => '2025-10-06T20:00:00Z'),
    cacheAgeSeconds: computed(() => 0),
    cacheHit: computed(() => false),
    freshnessSeconds: ref(300),
    location: ref('Kent, WA'),
    refresh: vi.fn(),
    setLocation: vi.fn(),
    setFreshnessSeconds: vi.fn()
  })),
  WeatherFetchReason: {} as any
}));

// Mock the useToasts composable
vi.mock('../../composables/useToasts', () => ({
  useToasts: () => ({
    push: vi.fn()
  }),
  provideToasts: vi.fn()
}));

// Mock the useUiPreferences composable
vi.mock('../../composables/useUiPreferences', () => ({
  useUiPreferences: () => ({
    isWidgetCompact: vi.fn(() => false) // Default to non-compact for tests
  })
}));

// Mock the useWeatherConfig composable
vi.mock('../../composables/useWeatherConfig', () => ({
  useWeatherConfig: () => ({
    defaultLocation: ref('Kent, WA'),
    defaultRefreshSeconds: ref(300),
    minRefreshSeconds: ref(15),
    maxRefreshSeconds: ref(3600),
    displaySettings: ref({
      showHourlyForecast: true,
      hourlyForecastHours: 8,
      hourlyForecastPastHours: 3,
      hourlyForecastFutureHours: 7,
      currentHourHighlight: true,
      showHumidity: true,
      showWindSpeed: true,
      showPrecipitation: false,
      temperatureUnit: 'celsius'
    }),
    uiSettings: ref({
      compactMode: false,
      showCacheInfo: false,
      autoRefresh: true
    }),
    isValidRefreshInterval: vi.fn(() => true),
    clampRefreshInterval: vi.fn((val) => val),
    updateUISettings: vi.fn()
  })
}));

// Mock PollingWidget component
vi.mock('../PollingWidget.vue', () => ({
  default: {
    name: 'PollingWidget',
    template: '<div><slot name="main-content"></slot><slot name="settings-content"></slot></div>',
    props: ['overlineText', 'title', 'subtitle', 'errorTitle', 'settingsTitle', 'error', 'isPolling', 'lastUpdatedIso', 'isStale', 'pollingSeconds', 'cacheDescription'],
    emits: ['manual-refresh', 'hard-refresh', 'save-settings']
  }
}));

describe('WeatherWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-06T20:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mountComponent = () => {
    const Wrapper = defineComponent({
      name: 'WeatherWidgetTestWrapper',
      setup() {
        provideToasts();
        return () => h(WeatherWidget);
      },
    });

    return mount(Wrapper, {
      global: {
        stubs: {
          'v-sheet': createSlotStub('div'),
          'v-card': createSlotStub('div'),
          'v-icon': defineComponent({
            name: 'VIconStub',
            setup() {
              return () => h('i');
            },
          }),
          'v-text-field': createSlotStub('input'),
          'v-divider': createSlotStub('hr'),
          'v-switch': createSlotStub('input'),
          'CompactModeControl': createSlotStub('div'),
        },
      },
    });
  };

  it('renders the widget with proper structure', () => {
    const wrapper = mountComponent();

    // Check that PollingWidget is rendered
    const pollingWidget = wrapper.findComponent({ name: 'PollingWidget' });
    expect(pollingWidget.exists()).toBe(true);

    // Check that main content slot is used
    expect(pollingWidget.find('div').exists()).toBe(true);
  });

  it('passes correct props to PollingWidget', () => {
    const wrapper = mountComponent();
    const pollingWidget = wrapper.findComponent({ name: 'PollingWidget' });

    expect(pollingWidget.props('overlineText')).toBe('Weather');
    expect(pollingWidget.props('title')).toBe('Current Conditions');
    expect(pollingWidget.props('subtitle')).toBe('Kent, WA');
    expect(pollingWidget.props('errorTitle')).toBe('Weather Error');
    expect(pollingWidget.props('settingsTitle')).toBe('Weather Settings');
    expect(pollingWidget.props('error')).toBe(null);
    expect(pollingWidget.props('isPolling')).toBe(false);
    expect(pollingWidget.props('lastUpdatedIso')).toBe('2025-10-06T20:00:00Z');
    expect(pollingWidget.props('isStale')).toBe(false);
    expect(pollingWidget.props('pollingSeconds')).toBe(300);
  });

  it('renders weather components in main content', () => {
    const wrapper = mountComponent();

    // Check that WeatherSummary is rendered
    const weatherSummary = wrapper.findComponent({ name: 'WeatherSummary' });
    expect(weatherSummary.exists()).toBe(true);

    // Check that HourlyForecast is rendered
    const hourlyForecast = wrapper.findComponent({ name: 'HourlyForecast' });
    expect(hourlyForecast.exists()).toBe(true);
  });

  it('passes correct props to WeatherSummary', () => {
    const wrapper = mountComponent();
    const weatherSummary = wrapper.findComponent({ name: 'WeatherSummary' });

    expect(weatherSummary.props('temperature')).toBe('22°C / 72°F');
    expect(weatherSummary.props('condition')).toBe('Partly cloudy');
    expect(weatherSummary.props('humidity')).toBe(65);
    expect(weatherSummary.props('windSpeed')).toBe(10);
    expect(weatherSummary.props('isCompact')).toBe(false);
    expect(weatherSummary.props('showMetrics')).toBe(true);
    expect(weatherSummary.props('showHumidity')).toBe(true);
    expect(weatherSummary.props('showWindSpeed')).toBe(true);
    expect(weatherSummary.props('showPrecipitation')).toBe(false); // Based on actual config
  });

  it('passes correct props to HourlyForecast', () => {
    const wrapper = mountComponent();
    const hourlyForecast = wrapper.findComponent({ name: 'HourlyForecast' });

    expect(hourlyForecast.props('data')).toHaveLength(11); // Actual filtered data length
    expect(hourlyForecast.props('isCompact')).toBe(false);
    expect(hourlyForecast.props('showHourlyForecast')).toBe(true);
    expect(hourlyForecast.props('currentHourHighlight')).toBe(true);
    expect(hourlyForecast.props('showHumidity')).toBe(true);
    expect(hourlyForecast.props('showWindSpeed')).toBe(true);
  });

  it('renders settings content with form elements', () => {
    const wrapper = mountComponent();
    
    // Check that settings content contains form elements
    const locationInput = wrapper.find('input[label="Location"]');
    expect(locationInput.exists()).toBe(true);
    
    const refreshInput = wrapper.find('input[label="Refresh Interval (seconds)"]');
    expect(refreshInput.exists()).toBe(true);
    
    // Check that CompactModeControl is rendered (it's stubbed as a div with widget-name attribute)
    expect(wrapper.html()).toContain('widget-name="weather-widget"');
  });

  it('has correct structure and styling', () => {
    const wrapper = mountComponent();
    
    // Check that the widget renders without errors
    expect(wrapper.exists()).toBe(true);
    
    // Check that PollingWidget is the root component
    const pollingWidget = wrapper.findComponent({ name: 'PollingWidget' });
    expect(pollingWidget.exists()).toBe(true);
  });
});
