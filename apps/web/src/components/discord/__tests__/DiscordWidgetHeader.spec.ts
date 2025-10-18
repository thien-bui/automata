import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import DiscordWidgetHeader from '../DiscordWidgetHeader.vue';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

const mountHeader = (props: Record<string, unknown> = {}) =>
  mount(DiscordWidgetHeader, {
    props: {
      totalCount: 100,
      onlineCount: 25,
      cacheDescription: 'Live provider data',
      showCacheInfo: true,
      statusCounts: {
        online: 10,
        idle: 5,
        dnd: 4,
        offline: 6,
      },
      showOfflineMembers: true,
      isCompact: false,
      ...props,
    },
    global: {
      stubs: {
        'v-sheet': createSlotStub('div'),
        'v-chip-group': createSlotStub('div'),
        'v-chip': createSlotStub('div'),
      },
    },
  });

describe('DiscordWidgetHeader', () => {
  it('renders guild overview and status chips', () => {
    const wrapper = mountHeader();

    expect(wrapper.text()).toContain('Guild Overview');
    expect(wrapper.text()).toContain('25 / 100');
    expect(wrapper.text()).toContain('Members Online');
    expect(wrapper.text()).toContain('Online: 10');
    expect(wrapper.text()).toContain('Idle: 5');
    expect(wrapper.text()).toContain('DND: 4');
    expect(wrapper.text()).toContain('Offline: 6');
  });

  it('hides cache information when disabled', () => {
    const wrapper = mountHeader({ showCacheInfo: false });

    expect(wrapper.text()).not.toContain('Live provider data');
  });

  it('omits offline chip when offline members are hidden', () => {
    const wrapper = mountHeader({
      showOfflineMembers: false,
    });

    expect(wrapper.text()).not.toContain('Offline:');
  });

  it('suppresses overview in compact mode', () => {
    const wrapper = mountHeader({
      isCompact: true,
    });

    expect(wrapper.text()).not.toContain('Guild Overview');
    expect(wrapper.text()).not.toContain('Online: 10');
  });
});
