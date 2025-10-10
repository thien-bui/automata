import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WeatherMetrics from '../WeatherMetrics.vue';

describe('WeatherMetrics', () => {
  it('displays humidity when showHumidity is true and humidity is provided', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65,
        showHumidity: true,
        showWindSpeed: false,
        showPrecipitation: false,
      },
    });

    expect(wrapper.text()).toContain('Humidity: 65%');
  });

  it('displays wind speed when showWindSpeed is true and windSpeed is provided', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        windSpeed: 15,
        showHumidity: false,
        showWindSpeed: true,
        showPrecipitation: false,
      },
    });

    expect(wrapper.text()).toContain('Wind: 15 km/h');
  });

  it('displays precipitation when showPrecipitation is true and precipitation is provided', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        precipitation: 20,
        showHumidity: false,
        showWindSpeed: false,
        showPrecipitation: true,
      },
    });

    expect(wrapper.text()).toContain('Precip: 20%');
  });

  it('displays all metrics when all show flags are true and values are provided', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65,
        windSpeed: 15,
        precipitation: 20,
        showHumidity: true,
        showWindSpeed: true,
        showPrecipitation: true,
      },
    });

    expect(wrapper.text()).toContain('Humidity: 65%');
    expect(wrapper.text()).toContain('Wind: 15 km/h');
    expect(wrapper.text()).toContain('Precip: 20%');
  });

  it('does not display humidity when showHumidity is false', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65,
        windSpeed: 15,
        precipitation: 20,
        showHumidity: false,
        showWindSpeed: true,
        showPrecipitation: true,
      },
    });

    expect(wrapper.text()).not.toContain('Humidity: 65%');
    expect(wrapper.text()).toContain('Wind: 15 km/h');
    expect(wrapper.text()).toContain('Precip: 20%');
  });

  it('does not display wind speed when showWindSpeed is false', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65,
        windSpeed: 15,
        precipitation: 20,
        showHumidity: true,
        showWindSpeed: false,
        showPrecipitation: true,
      },
    });

    expect(wrapper.text()).toContain('Humidity: 65%');
    expect(wrapper.text()).not.toContain('Wind: 15 km/h');
    expect(wrapper.text()).toContain('Precip: 20%');
  });

  it('does not display precipitation when showPrecipitation is false', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65,
        windSpeed: 15,
        precipitation: 20,
        showHumidity: true,
        showWindSpeed: true,
        showPrecipitation: false,
      },
    });

    expect(wrapper.text()).toContain('Humidity: 65%');
    expect(wrapper.text()).toContain('Wind: 15 km/h');
    expect(wrapper.text()).not.toContain('Precip: 20%');
  });

  it('does not display metrics when values are undefined', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: undefined,
        windSpeed: undefined,
        precipitation: undefined,
        showHumidity: true,
        showWindSpeed: true,
        showPrecipitation: true,
      },
    });

    expect(wrapper.text()).toBe('');
  });

  it('applies compact class when isCompact is true', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65,
        showHumidity: true,
        showWindSpeed: false,
        showPrecipitation: false,
        isCompact: true,
      },
    });

    expect(wrapper.find('.weather-metrics').classes()).toContain('weather-metrics--compact');
  });

  it('does not apply compact class when isCompact is false', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65,
        showHumidity: true,
        showWindSpeed: false,
        showPrecipitation: false,
        isCompact: false,
      },
    });

    expect(wrapper.find('.weather-metrics').classes()).not.toContain('weather-metrics--compact');
  });

  it('handles zero values correctly', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 0,
        windSpeed: 0,
        precipitation: 0,
        showHumidity: true,
        showWindSpeed: true,
        showPrecipitation: true,
      },
    });

    expect(wrapper.text()).toContain('Humidity: 0%');
    expect(wrapper.text()).toContain('Wind: 0 km/h');
    expect(wrapper.text()).toContain('Precip: 0%');
  });

  it('handles decimal values correctly', () => {
    const wrapper = mount(WeatherMetrics, {
      props: {
        humidity: 65.5,
        windSpeed: 15.3,
        precipitation: 20.7,
        showHumidity: true,
        showWindSpeed: true,
        showPrecipitation: true,
      },
    });

    expect(wrapper.text()).toContain('Humidity: 65.5%');
    expect(wrapper.text()).toContain('Wind: 15.3 km/h');
    expect(wrapper.text()).toContain('Precip: 20.7%');
  });
});
