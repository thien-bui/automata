import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import RouteSummary from '../RouteSummary.vue';
import type { RouteTimeResponse } from '@automata/types';

const createRouteData = (durationMinutes: number, distanceKm: number): RouteTimeResponse => ({
  durationMinutes,
  distanceKm,
  provider: 'google-directions',
  mode: 'driving',
  lastUpdatedIso: new Date().toISOString(),
  cache: {
    hit: false,
    ageSeconds: 0,
    staleWhileRevalidate: false,
  },
});

const createSlotStub = (tag: string) => ({
  name: `${tag}-slot-stub`,
  template: `<div><slot /></div>`,
});

describe('RouteSummary', () => {
  const mountComponent = (props: Partial<{
    routeData: RouteTimeResponse | null;
    isPolling: boolean;
    cacheDescription: string;
  }> = {}) => {
    const defaultProps = {
      routeData: null,
      isPolling: false,
      cacheDescription: '',
    };

    return mount(RouteSummary, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          'v-sheet': createSlotStub('div'),
        },
      },
    });
  };

  it('renders loading state when polling and no route data', () => {
    const wrapper = mountComponent({ isPolling: true });
    
    expect(wrapper.text()).toContain('Loading…');
    expect(wrapper.text()).toContain('—');
  });

  it('renders empty state when not polling and no route data', () => {
    const wrapper = mountComponent({ isPolling: false });
    
    expect(wrapper.text()).toContain('—');
    expect(wrapper.text()).not.toContain('Loading…');
  });

  it('renders route data correctly', () => {
    const routeData = createRouteData(25.5, 12.3);
    const wrapper = mountComponent({ routeData });
    
    expect(wrapper.text()).toContain('25.5 min');
    expect(wrapper.text()).toContain('Distance: 12.3 km');
  });

  it('renders cache description when provided', () => {
    const cacheDescription = 'Cache hit • age 30s';
    const wrapper = mountComponent({ cacheDescription });
    
    expect(wrapper.text()).toContain(cacheDescription);
  });

  it('does not render cache description when empty', () => {
    const wrapper = mountComponent({ cacheDescription: '' });
    
    expect(wrapper.text()).not.toContain('Cache hit');
  });

  it('formats duration with one decimal place', () => {
    const routeData = createRouteData(18.75, 10);
    const wrapper = mountComponent({ routeData });
    
    expect(wrapper.text()).toContain('18.8 min');
  });

  it('formats distance with one decimal place', () => {
    const routeData = createRouteData(20, 7.85);
    const wrapper = mountComponent({ routeData });
    
    expect(wrapper.text()).toContain('7.9 km');
  });

  it('has proper accessibility attributes', () => {
    const routeData = createRouteData(30, 15);
    const wrapper = mountComponent({ routeData });
    
    const durationElement = wrapper.find('[aria-live="polite"]');
    expect(durationElement.exists()).toBe(true);
  });
});
