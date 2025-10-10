import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TemperatureDisplay from '../TemperatureDisplay.vue';

describe('TemperatureDisplay', () => {
  it('displays both Celsius and Fahrenheit by default', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: 20,
        fahrenheit: 68,
      },
    });

    expect(wrapper.text()).toBe('20°C / 68°F');
  });

  it('displays only Celsius when unit is celsius', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: 20,
        fahrenheit: 68,
        unit: 'celsius',
      },
    });

    expect(wrapper.text()).toBe('20°C');
  });

  it('displays only Fahrenheit when unit is fahrenheit', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: 20,
        fahrenheit: 68,
        unit: 'fahrenheit',
      },
    });

    expect(wrapper.text()).toBe('68°F');
  });

  it('rounds temperature values', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: 20.7,
        fahrenheit: 68.3,
      },
    });

    expect(wrapper.text()).toBe('21°C / 68°F');
  });

  it('displays dash when Celsius is NaN', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: NaN,
        fahrenheit: 68,
      },
    });

    expect(wrapper.text()).toBe('—');
  });

  it('displays dash when Fahrenheit is NaN', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: 20,
        fahrenheit: NaN,
      },
    });

    expect(wrapper.text()).toBe('—');
  });

  it('displays dash when both values are NaN', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: NaN,
        fahrenheit: NaN,
      },
    });

    expect(wrapper.text()).toBe('—');
  });

  it('handles negative temperatures', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: -10,
        fahrenheit: 14,
      },
    });

    expect(wrapper.text()).toBe('-10°C / 14°F');
  });

  it('has correct aria-live attribute', () => {
    const wrapper = mount(TemperatureDisplay, {
      props: {
        celsius: 20,
        fahrenheit: 68,
      },
    });

    expect(wrapper.find('.temperature-display').attributes('aria-live')).toBe('polite');
  });
});
