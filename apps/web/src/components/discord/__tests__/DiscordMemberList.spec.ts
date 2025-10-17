import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import DiscordMemberList from '../discord/DiscordMemberList.vue';
import type { DiscordMemberStatus } from '@automata/types';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

const baseMembers: DiscordMemberStatus[] = [
  {
    id: '1',
    username: 'user1',
    displayName: 'User One',
    status: 'online',
    avatarUrl: null,
    bot: false,
  },
  {
    id: '2',
    username: 'user2',
    displayName: 'User Two',
    status: 'idle',
    avatarUrl: null,
    bot: false,
  },
  {
    id: '3',
    username: 'bot3',
    displayName: 'Bot Three',
    status: 'dnd',
    avatarUrl: null,
    bot: true,
  },
];

const mountList = (props: Record<string, unknown> = {}) =>
  mount(DiscordMemberList, {
    props: {
      members: baseMembers,
      maxMembersToShow: 2,
      showAvatars: true,
      isCompact: false,
      ...props,
    },
    global: {
      stubs: {
        'v-card': createSlotStub('div'),
        'v-avatar': createSlotStub('div'),
        'v-icon': defineComponent({
          name: 'VIconStub',
          setup(_, { attrs }) {
            return () => h('i', { ...attrs });
          },
        }),
        'v-chip': createSlotStub('span'),
        'v-btn': defineComponent({
          name: 'VBtnStub',
          emits: ['click'],
          setup(_, { emit, slots }) {
            return () =>
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => emit('click'),
                },
                slots.default ? slots.default() : undefined,
              );
          },
        }),
      },
    },
  });

describe('DiscordMemberList', () => {
  it('limits the number of rendered members', () => {
    const wrapper = mountList();
    expect(wrapper.findAll('.discord-member-list__item')).toHaveLength(2);
  });

  it('reveals all members when "Show More" is clicked', async () => {
    const wrapper = mountList();

    const button = wrapper.find('button');
    expect(button.exists()).toBe(true);
    expect(button.text()).toContain('Show 1 More');

    await button.trigger('click');

    expect(wrapper.findAll('.discord-member-list__item')).toHaveLength(3);
    expect(button.text()).toContain('Show Less');
  });

  it('hides the toggle button in compact mode', () => {
    const wrapper = mountList({ isCompact: true });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('decorates bot members with a label', () => {
    const wrapper = mountList({ members: baseMembers, maxMembersToShow: 3 });
    const botRow = wrapper.findAll('.discord-member-list__item').find(item => item.text().includes('Bot Three'));
    expect(botRow?.text()).toContain('BOT');
  });
});
