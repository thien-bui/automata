import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import HourlyForecast from '../HourlyForecast.vue';
import type { HourlyWeatherData } from '@automata/types';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

const IconStub = defineComponent({
  name: 'v-icon-stub',
  props: {
    icon: {
      type: String,
      default: undefined,
    },
    size: {
      type: [Number, String],
      default: undefined,
    },
    color: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    return () =>
      h('i', {
        'data-icon': props.icon,
        'data-size': props.size?.toString(),
        'data-color': props.color,
      });
  },
});

describe('HourlyForecast', () => {
  const mockHourlyData: HourlyWeatherData[] = [
    {
      timestamp: '2025-10-06T17:00:00Z',
      temperatureCelsius: 18,
      temperatureFahrenheit: 64,
      condition: 'Clear',
      humidityPercent: 55,
      windSpeedKph: 5,
      precipitationProbability: 0,
    },
    {
      timestamp: '2025-10-06T18:00:00Z',
      temperatureCelsius: 19,
      temperatureFahrenheit: 66,
      condition: 'Partly cloudy',
      humidityPercent: 58,
      windSpeedKph: 7,
      precipitationProbability: 10,
    },
    {
      timestamp: '2025-10-06T20:00:00Z', // Current hour
      temperatureCelsius: 22,
      temperatureFahrenheit: 72,
      condition: 'Partly cloudy',
      humidityPercent: 65,
      windSpeedKph: 10,
      precipitationProbability: 20,
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-06T20:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    data: mockHourlyData,
    isCompact: false,
    showHourlyForecast: true,
    currentHourHighlight: true,
    showHumidity: true,
    showWindSpeed: true,
  };

  const mountComponent = (props = {}) => {
    return mount(HourlyForecast, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          'v-card': createSlotStub('div'),
          'v-icon': IconStub,
        },
      },
    });
  };

  it('does not render when isCompact is true', () => {
    const wrapper = mountComponent({ isCompact: true });
    
    expect(wrapper.find('.hourly-forecast-card').exists()).toBe(false);
  });

  it('does not render when showHourlyForecast is false', () => {
    const wrapper = mountComponent({ showHourlyForecast: false });
    
    expect(wrapper.find('.hourly-forecast-card').exists()).toBe(false);
  });

  it('renders hourly forecast card when conditions are met', () => {
    const wrapper = mountComponent();
    
    expect(wrapper.find('.hourly-forecast-card').exists()).toBe(true);
    expect(wrapper.find('.hourly-forecast-container').exists()).toBe(true);
  });

  it('renders correct number of hourly items', () => {
    const wrapper = mountComponent();
    
    const hourlyItems = wrapper.findAll('.hourly-item');
    expect(hourlyItems).toHaveLength(mockHourlyData.length);
  });

  it('displays "Now" for current hour when currentHourHighlight is true', () => {
    const wrapper = mountComponent();
    
    const timeElements = wrapper.findAll('.hourly-time');
    expect(timeElements[2].text()).toBe('Now'); // Current hour
    expect(timeElements[0].text()).toMatch(/\d+ (AM|PM)/); // Not current hour
    expect(timeElements[1].text()).toMatch(/\d+ (AM|PM)/); // Not current hour
  });

  it('displays formatted time for all hours when currentHourHighlight is false', () => {
    const wrapper = mountComponent({ currentHourHighlight: false });
    
    const timeElements = wrapper.findAll('.hourly-time');
    timeElements.forEach((timeElement) => {
      expect(timeElement.text()).toMatch(/\d+ (AM|PM)/);
    });
  });

  it('applies current-hour class when currentHourHighlight is true', () => {
    const wrapper = mountComponent();
    
    const hourlyItems = wrapper.findAll('.hourly-item');
    expect(hourlyItems[2].classes()).toContain('current-hour'); // Current hour
    expect(hourlyItems[0].classes()).not.toContain('current-hour'); // Not current hour
    expect(hourlyItems[1].classes()).not.toContain('current-hour'); // Not current hour
  });

  it('does not apply current-hour class when currentHourHighlight is false', () => {
    const wrapper = mountComponent({ currentHourHighlight: false });
    
    const hourlyItems = wrapper.findAll('.hourly-item');
    hourlyItems.forEach((item) => {
      expect(item.classes()).not.toContain('current-hour');
    });
  });

  it('displays temperatures correctly', () => {
    const wrapper = mountComponent();
    
    const tempElements = wrapper.findAll('.hourly-temperature');
    expect(tempElements[0].text()).toBe('64°'); // 64°F
    expect(tempElements[1].text()).toBe('66°'); // 66°F
    expect(tempElements[2].text()).toBe('72°'); // 72°F
  });

  it('applies current-temp class to current hour temperature', () => {
    const wrapper = mountComponent();
    
    const tempElements = wrapper.findAll('.hourly-temperature');
    expect(tempElements[2].classes()).toContain('current-temp'); // Current hour
    expect(tempElements[0].classes()).not.toContain('current-temp'); // Not current hour
    expect(tempElements[1].classes()).not.toContain('current-temp'); // Not current hour
  });

  it('renders weather icons with correct props', () => {
    const wrapper = mountComponent();
    
    const icons = wrapper.findAll('i[data-icon]');
    expect(icons).toHaveLength(mockHourlyData.length);
    
    // Check first icon (Clear condition)
    expect(icons[0].attributes('data-icon')).toBe('mdi-weather-sunny');
    expect(icons[0].attributes('data-size')).toBe('24');
    expect(icons[0].attributes('data-color')).toBe('grey-darken-1');
  });

  it('renders larger icon for current hour when currentHourHighlight is true', () => {
    const wrapper = mountComponent();
    
    const icons = wrapper.findAll('i[data-icon]');
    expect(icons[2].attributes('data-size')).toBe('32'); // Current hour
    expect(icons[2].attributes('data-color')).toBe('primary'); // Current hour
    expect(icons[0].attributes('data-size')).toBe('24'); // Not current hour
    expect(icons[0].attributes('data-color')).toBe('grey-darken-1'); // Not current hour
  });

  it('shows details only for current hour when currentHourHighlight is true', () => {
    const wrapper = mountComponent();
    
    const hourlyItems = wrapper.findAll('.hourly-item');
    expect(hourlyItems[2].find('.hourly-details').exists()).toBe(true); // Current hour
    expect(hourlyItems[0].find('.hourly-details').exists()).toBe(false); // Not current hour
    expect(hourlyItems[1].find('.hourly-details').exists()).toBe(false); // Not current hour
  });

  it('does not show details when currentHourHighlight is false', () => {
    const wrapper = mountComponent({ currentHourHighlight: false });
    
    const hourlyItems = wrapper.findAll('.hourly-item');
    hourlyItems.forEach((item) => {
      expect(item.find('.hourly-details').exists()).toBe(false);
    });
  });

  it('displays correct details content for current hour', () => {
    const wrapper = mountComponent();
    
    const details = wrapper.find('.hourly-details');
    expect(details.text()).toContain('Partly cloudy');
    expect(details.text()).toContain('65%'); // Humidity
    expect(details.text()).toContain('10 km/h'); // Wind speed
  });

  it('handles humidity and wind visibility flags correctly', () => {
    const wrapper = mountComponent({ showHumidity: false, showWindSpeed: false });
    
    const details = wrapper.find('.hourly-details');
    expect(details.text()).toContain('Partly cloudy');
    expect(details.text()).not.toContain('65%'); // Humidity hidden
    expect(details.text()).not.toContain('10 km/h'); // Wind hidden
  });

  it('handles only humidity visible', () => {
    const wrapper = mountComponent({ showHumidity: true, showWindSpeed: false });
    
    const details = wrapper.find('.hourly-details');
    expect(details.text()).toContain('Partly cloudy');
    expect(details.text()).toContain('65%'); // Humidity visible
    expect(details.text()).not.toContain('10 km/h'); // Wind hidden
  });

  it('handles only wind speed visible', () => {
    const wrapper = mountComponent({ showHumidity: false, showWindSpeed: true });
    
    const details = wrapper.find('.hourly-details');
    expect(details.text()).toContain('Partly cloudy');
    expect(details.text()).not.toContain('65%'); // Humidity hidden
    expect(details.text()).toContain('10 km/h'); // Wind visible
  });

  it('handles invalid timestamp gracefully', () => {
    const dataWithInvalidTimestamp = [
      ...mockHourlyData,
      {
        timestamp: 'invalid-date',
        temperatureCelsius: 15,
        temperatureFahrenheit: 59,
        condition: 'Clear',
        humidityPercent: 45,
        windSpeedKph: 3,
        precipitationProbability: 0,
      },
    ];
    const wrapper = mountComponent({ data: dataWithInvalidTimestamp });
    
    const timeElements = wrapper.findAll('.hourly-time');
    expect(timeElements[3].text()).toBe('—'); // Invalid timestamp
  });

  it('returns correct weather icons for different conditions', () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;

    expect(vm.getWeatherIcon('Clear')).toBe('mdi-weather-sunny');
    expect(vm.getWeatherIcon('Sunny')).toBe('mdi-weather-sunny');
    expect(vm.getWeatherIcon('Partly cloudy')).toBe('mdi-weather-partly-cloudy');
    expect(vm.getWeatherIcon('Cloudy')).toBe('mdi-weather-cloudy');
    expect(vm.getWeatherIcon('Rain')).toBe('mdi-weather-rainy');
    expect(vm.getWeatherIcon('Snow')).toBe('mdi-weather-snowy');
    expect(vm.getWeatherIcon('Thunderstorm')).toBe('mdi-weather-lightning');
    expect(vm.getWeatherIcon('Fog')).toBe('mdi-weather-fog');
    expect(vm.getWeatherIcon('Windy')).toBe('mdi-weather-windy');
    expect(vm.getWeatherIcon('Overcast')).toBe('mdi-weather-cloudy');
    expect(vm.getWeatherIcon('Unknown condition')).toBe('mdi-weather-sunny'); // default
  });

  it('correctly identifies current hour', () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;

    // Current hour is 2025-10-06T20:00:00Z
    expect(vm.isCurrentHour('2025-10-06T20:00:00Z')).toBe(true);
    expect(vm.isCurrentHour('2025-10-06T19:00:00Z')).toBe(false);
    expect(vm.isCurrentHour('2025-10-06T21:00:00Z')).toBe(false);
    expect(vm.isCurrentHour('invalid-date')).toBe(false);
  });

  it('formats temperature correctly', () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;

    expect(vm.formatTemperature(72.5)).toBe('73°');
    expect(vm.formatTemperature(72.4)).toBe('72°');
    expect(vm.formatTemperature(0)).toBe('0°');
    expect(vm.formatTemperature(-10)).toBe('-10°');
  });

  it('formats hour correctly', () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;

    expect(vm.formatHour('2025-10-06T20:00:00Z')).toMatch(/8 PM/);
    expect(vm.formatHour('2025-10-06T09:00:00Z')).toMatch(/9 AM/);
    expect(vm.formatHour('invalid-date')).toBe('—');
  });
});
