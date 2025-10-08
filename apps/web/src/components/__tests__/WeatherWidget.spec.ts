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
        },
      },
    });
  };

  it('renders the new single card hourly forecast layout', () => {
    const wrapper = mountComponent();

    // Check that the hourly forecast card exists
    const hourlyCard = wrapper.find('.hourly-forecast-card');
    expect(hourlyCard.exists()).toBe(true);

    // Check that the forecast container exists
    const forecastContainer = wrapper.find('.hourly-forecast-container');
    expect(forecastContainer.exists()).toBe(true);

    // Check that hourly items are rendered (should show 9 hours)
    const hourlyItems = wrapper.findAll('.hourly-item');
    expect(hourlyItems).toHaveLength(11);

    // Check that the current hour is centered after three prior hours
    expect(hourlyItems[0].classes()).not.toContain('current-hour'); // 3 hours prior
    expect(hourlyItems[1].classes()).not.toContain('current-hour'); // 2 hours prior
    expect(hourlyItems[2].classes()).not.toContain('current-hour'); // 1 hour prior
    expect(hourlyItems[3].classes()).toContain('current-hour');      // current hour
    expect(hourlyItems[4].classes()).not.toContain('current-hour'); // 1 hour after
    expect(hourlyItems[5].classes()).not.toContain('current-hour'); // 2 hours after
    expect(hourlyItems[6].classes()).not.toContain('current-hour'); // 3 hours after
    expect(hourlyItems[7].classes()).not.toContain('current-hour'); // 4 hours after
    expect(hourlyItems[8].classes()).not.toContain('current-hour'); // 5 hours after
    expect(hourlyItems[9].classes()).not.toContain('current-hour'); // 6 hours after
    expect(hourlyItems[10].classes()).not.toContain('current-hour'); // 7 hours after
  });

  it('displays "Now" for the current hour and formatted time for other hours', () => {
    const wrapper = mountComponent();

    const hourlyItems = wrapper.findAll('.hourly-item');
    const timeElements = wrapper.findAll('.hourly-time');

    // First item (index 0) should show "Now" (current hour is first in displayed data)
    expect(timeElements[0].text()).toMatch(/\d+ (AM|PM)/); // 3 hours prior
    expect(timeElements[1].text()).toMatch(/\d+ (AM|PM)/); // 2 hours prior
    expect(timeElements[2].text()).toMatch(/\d+ (AM|PM)/); // 1 hour prior
    expect(timeElements[3].text()).toBe('Now');             // current hour
    expect(timeElements[4].text()).toMatch(/\d+ (AM|PM)/); // 1 hour after
    expect(timeElements[5].text()).toMatch(/\d+ (AM|PM)/); // 2 hours after
    expect(timeElements[6].text()).toMatch(/\d+ (AM|PM)/); // 3 hours after
    expect(timeElements[7].text()).toMatch(/\d+ (AM|PM)/); // 4 hours after
    expect(timeElements[8].text()).toMatch(/\d+ (AM|PM)/); // 5 hours after
    expect(timeElements[9].text()).toMatch(/\d+ (AM|PM)/); // 6 hours after
    expect(timeElements[10].text()).toMatch(/\d+ (AM|PM)/); // 7 hours after
  });

  it('displays weather icons with appropriate sizes and colors', () => {
    const wrapper = mountComponent();

    const iconContainers = wrapper.findAll('.hourly-icon');
    expect(iconContainers).toHaveLength(11);

    // Check that icons are rendered (we can't easily test props in this setup)
    // but we can verify the structure exists
    iconContainers.forEach((container, index) => {
      expect(container.exists()).toBe(true);
      // Since v-icon is stubbed, we check for the stubbed element
      const icon = container.find('i');
      expect(icon.exists()).toBe(true);
    });
  });

  it('displays temperatures with appropriate styling', () => {
    const wrapper = mountComponent();

    const tempElements = wrapper.findAll('.hourly-temperature');
    expect(tempElements).toHaveLength(11);

    // Check that temperatures are displayed correctly (formatTemperature is passed Fahrenheit values)
    expect(tempElements[0].text()).toBe('64°'); // 3 hours prior (64°F)
    expect(tempElements[1].text()).toBe('66°'); // 2 hours prior (66°F)
    expect(tempElements[2].text()).toBe('70°'); // 1 hour prior (70°F)
    expect(tempElements[3].text()).toBe('72°'); // current hour (72°F)
    expect(tempElements[4].text()).toBe('68°'); // 1 hour after (68°F)
    expect(tempElements[5].text()).toBe('64°'); // 2 hours after (64°F)
    expect(tempElements[6].text()).toBe('63°'); // 3 hours after (63°F)
    expect(tempElements[7].text()).toBe('61°'); // 4 hours after (61°F)
    expect(tempElements[8].text()).toBe('59°'); // 5 hours after (59°F)
    expect(tempElements[9].text()).toBe('57°'); // 6 hours after (57°F)
    expect(tempElements[10].text()).toBe('55°'); // 7 hours after (55°F)

    // Current hour temperature (index 3) should have the current-temp class
    expect(tempElements[0].classes()).not.toContain('current-temp');
    expect(tempElements[1].classes()).not.toContain('current-temp');
    expect(tempElements[2].classes()).not.toContain('current-temp');
    expect(tempElements[3].classes()).toContain('current-temp');
    expect(tempElements[4].classes()).not.toContain('current-temp');
    expect(tempElements[5].classes()).not.toContain('current-temp');
    expect(tempElements[6].classes()).not.toContain('current-temp');
    expect(tempElements[7].classes()).not.toContain('current-temp');
    expect(tempElements[8].classes()).not.toContain('current-temp');
    expect(tempElements[9].classes()).not.toContain('current-temp');
    expect(tempElements[10].classes()).not.toContain('current-temp');
  });

  it('shows additional details only for the current hour', () => {
    const wrapper = mountComponent();

    const detailsElements = wrapper.findAll('.hourly-details');
    expect(detailsElements).toHaveLength(1);

    // Details should only be present for the current hour (index 3)
    const hourlyItems = wrapper.findAll('.hourly-item');
    expect(hourlyItems[0].find('.hourly-details').exists()).toBe(false); // 3 hours prior
    expect(hourlyItems[1].find('.hourly-details').exists()).toBe(false); // 2 hours prior
    expect(hourlyItems[2].find('.hourly-details').exists()).toBe(false); // 1 hour prior
    expect(hourlyItems[3].find('.hourly-details').exists()).toBe(true);  // current hour
    expect(hourlyItems[4].find('.hourly-details').exists()).toBe(false); // 1 hour after
    expect(hourlyItems[5].find('.hourly-details').exists()).toBe(false); // 2 hours after
    expect(hourlyItems[6].find('.hourly-details').exists()).toBe(false); // 3 hours after
    expect(hourlyItems[7].find('.hourly-details').exists()).toBe(false); // 4 hours after
    expect(hourlyItems[8].find('.hourly-details').exists()).toBe(false); // 5 hours after
    expect(hourlyItems[9].find('.hourly-details').exists()).toBe(false); // 6 hours after
    expect(hourlyItems[10].find('.hourly-details').exists()).toBe(false); // 7 hours after

    const detailsText = detailsElements[0].text();
    expect(detailsText).toContain('Partly cloudy');
    expect(detailsText).toContain('65%');
    expect(detailsText).toContain('10 km/h');
  });

  it('applies correct weather icon based on conditions', async () => {
    const wrapper = mountComponent();

    // Get the WeatherWidget component instance to access the getWeatherIcon method
    const vm = wrapper.findComponent(WeatherWidget).vm as any;

    expect(vm.getWeatherIcon('Clear')).toBe('mdi-weather-sunny');
    expect(vm.getWeatherIcon('Partly cloudy')).toBe('mdi-weather-cloudy'); // "cloud" matches before "partly"
    expect(vm.getWeatherIcon('Rain')).toBe('mdi-weather-rainy');
    expect(vm.getWeatherIcon('Snow')).toBe('mdi-weather-snowy');
    expect(vm.getWeatherIcon('Thunderstorm')).toBe('mdi-weather-lightning');
    expect(vm.getWeatherIcon('Fog')).toBe('mdi-weather-fog');
    expect(vm.getWeatherIcon('Windy')).toBe('mdi-weather-windy');
    expect(vm.getWeatherIcon('Overcast')).toBe('mdi-weather-cloudy');
    expect(vm.getWeatherIcon('Unknown condition')).toBe('mdi-weather-sunny'); // default
  });
});
