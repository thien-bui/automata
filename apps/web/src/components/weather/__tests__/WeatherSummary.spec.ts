import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import WeatherSummary from '../WeatherSummary.vue';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

// Mock WeatherMetrics component
vi.mock('../WeatherMetrics.vue', () => ({
  default: {
    name: 'WeatherMetrics',
    template: '<div class="weather-metrics-mock"><slot></slot></div>',
    props: ['humidity', 'windSpeed', 'precipitation', 'showHumidity', 'showWindSpeed', 'showPrecipitation', 'isCompact'],
  },
}));

describe('WeatherSummary', () => {
  const defaultProps = {
    temperature: '72°F',
    condition: 'Partly cloudy',
    humidity: 65,
    windSpeed: 15,
    precipitation: 20,
    isCompact: false,
    showMetrics: true,
    showHumidity: true,
    showWindSpeed: true,
    showPrecipitation: true,
  };

  const mountComponent = (props = {}) => {
    return mount(WeatherSummary, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          'v-sheet': createSlotStub('div'),
        },
      },
    });
  };

  it('renders temperature with correct styling', () => {
    const wrapper = mountComponent();
    
    const temperatureElement = wrapper.find('.text-h4');
    expect(temperatureElement.exists()).toBe(true);
    expect(temperatureElement.text()).toBe('72°F');
    expect(temperatureElement.classes()).toContain('font-weight-medium');
  });

  it('renders condition with correct styling', () => {
    const wrapper = mountComponent();
    
    const conditionElement = wrapper.find('.text-body-1');
    expect(conditionElement.exists()).toBe(true);
    expect(conditionElement.text()).toBe('Partly cloudy');
    expect(conditionElement.classes()).toContain('text-medium-emphasis');
  });

  it('renders current temperature overline', () => {
    const wrapper = mountComponent();
    
    const overlineElement = wrapper.find('.text-overline');
    expect(overlineElement.exists()).toBe(true);
    expect(overlineElement.text()).toBe('Current Temperature');
    expect(overlineElement.classes()).toContain('text-medium-emphasis');
  });

  it('has correct aria-live attribute on temperature', () => {
    const wrapper = mountComponent();
    
    const temperatureElement = wrapper.find('.text-h4');
    expect(temperatureElement.attributes('aria-live')).toBe('polite');
  });

  it('includes WeatherMetrics when not in compact mode', () => {
    const wrapper = mountComponent({ isCompact: false });
    
    const weatherMetrics = wrapper.findComponent({ name: 'WeatherMetrics' });
    expect(weatherMetrics.exists()).toBe(true);
    expect(weatherMetrics.props()).toEqual({
      humidity: 65,
      windSpeed: 15,
      precipitation: 20,
      showHumidity: true,
      showWindSpeed: true,
      showPrecipitation: true,
      isCompact: false,
    });
  });

  it('includes WeatherMetrics in compact mode when showMetrics is true', () => {
    const wrapper = mountComponent({ 
      isCompact: true, 
      showMetrics: true 
    });
    
    const weatherMetrics = wrapper.findComponent({ name: 'WeatherMetrics' });
    expect(weatherMetrics.exists()).toBe(true);
    expect(weatherMetrics.props('isCompact')).toBe(true);
  });

  it('does not include WeatherMetrics in compact mode when showMetrics is false', () => {
    const wrapper = mountComponent({ 
      isCompact: true, 
      showMetrics: false 
    });
    
    const weatherMetrics = wrapper.findComponent({ name: 'WeatherMetrics' });
    expect(weatherMetrics.exists()).toBe(false);
  });

  it('applies compact class when isCompact is true', () => {
    const wrapper = mountComponent({ isCompact: true });
    
    const summaryCard = wrapper.find('.weather-summary-card');
    expect(summaryCard.classes()).toContain('weather-summary-card--compact');
  });

  it('does not apply compact class when isCompact is false', () => {
    const wrapper = mountComponent({ isCompact: false });
    
    const summaryCard = wrapper.find('.weather-summary-card');
    expect(summaryCard.classes()).not.toContain('weather-summary-card--compact');
  });

  it('passes correct props to WeatherMetrics', () => {
    const customProps = {
      humidity: 80,
      windSpeed: 25,
      precipitation: 10,
      showHumidity: true,
      showWindSpeed: true,
      showPrecipitation: true,
      isCompact: true,
    };
    const wrapper = mountComponent(customProps);
    
    const weatherMetrics = wrapper.findComponent({ name: 'WeatherMetrics' });
    expect(weatherMetrics.props()).toEqual(customProps);
  });

  it('handles missing optional props', () => {
    const minimalProps = {
      temperature: '68°F',
      condition: 'Clear',
      isCompact: false,
      showMetrics: true,
      showHumidity: false,
      showWindSpeed: false,
      showPrecipitation: false,
    };
    const wrapper = mountComponent(minimalProps);
    
    const weatherMetrics = wrapper.findComponent({ name: 'WeatherMetrics' });
    expect(weatherMetrics.exists()).toBe(true);
    expect(weatherMetrics.props()).toEqual({
      humidity: undefined,
      windSpeed: undefined,
      precipitation: undefined,
      showHumidity: false,
      showWindSpeed: false,
      showPrecipitation: false,
      isCompact: false,
    });
  });

  it('renders correct structure for compact mode with metrics', () => {
    const wrapper = mountComponent({ 
      isCompact: true, 
      showMetrics: true 
    });
    
    const summaryCard = wrapper.find('.weather-summary-card');
    expect(summaryCard.classes()).toContain('weather-summary-card--compact');
    
    const weatherMetrics = wrapper.findComponent({ name: 'WeatherMetrics' });
    expect(weatherMetrics.exists()).toBe(true);
    expect(weatherMetrics.props('isCompact')).toBe(true);
  });

  it('renders correct structure for non-compact mode', () => {
    const wrapper = mountComponent({ isCompact: false });
    
    const summaryCard = wrapper.find('.weather-summary-card');
    expect(summaryCard.classes()).not.toContain('weather-summary-card--compact');
    
    const sections = wrapper.findAll('.widget-summary__section');
    expect(sections).toHaveLength(2); // Main section and end section
    
    const endSection = wrapper.find('.widget-summary__section--end');
    expect(endSection.exists()).toBe(true);
    
    const weatherMetrics = wrapper.findComponent({ name: 'WeatherMetrics' });
    expect(weatherMetrics.exists()).toBe(true);
    expect(weatherMetrics.props('isCompact')).toBe(false);
  });
});
