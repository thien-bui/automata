import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import DiscordWidgetSettings from '../discord/DiscordWidgetSettings.vue';

const VTextFieldStub = defineComponent({
  name: 'VTextFieldStub',
  props: {
    modelValue: {
      type: [String, Number],
      required: true,
    },
    label: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      default: 'text',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, attrs }) {
    return () =>
      h('label', { class: 'text-field-stub' }, [
        props.label ? h('span', { class: 'text-field-stub__label' }, props.label) : null,
        h('input', {
          value: props.modelValue,
          type: props.type,
          onInput: (event: Event) => {
            const target = event.target as HTMLInputElement;
            emit('update:modelValue', target.value);
          },
          onKeyup: (event: KeyboardEvent) => {
            const handler = attrs.onKeyup as ((event: KeyboardEvent) => void) | undefined;
            handler?.(event);
          },
        }),
      ]);
  },
});

const VCheckboxStub = defineComponent({
  name: 'VCheckboxStub',
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    label: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('label', { class: 'checkbox-stub' }, [
        h('input', {
          type: 'checkbox',
          checked: props.modelValue,
          onChange: (event: Event) => {
            const target = event.target as HTMLInputElement;
            emit('update:modelValue', target.checked);
          },
        }),
        props.label ? h('span', props.label) : null,
      ]);
  },
});

const VSelectStub = defineComponent({
  name: 'VSelectStub',
  props: {
    modelValue: {
      type: String,
      required: true,
    },
    items: {
      type: Array,
      default: () => [],
    },
    label: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('label', { class: 'select-stub' }, [
        props.label ? h('span', props.label) : null,
        h(
          'select',
          {
            value: props.modelValue,
            onChange: (event: Event) => {
              const target = event.target as HTMLSelectElement;
              emit('update:modelValue', target.value);
            },
          },
          (props.items as Array<{ value: string; title?: string }>).map(option =>
            h('option', { value: option.value }, option.title ?? option.value),
          ),
        ),
      ]);
  },
});

const mountWrapper = () => {
  const submitSpy = vi.fn();
  const wrapper = mount(
    defineComponent({
      name: 'DiscordWidgetSettingsTestWrapper',
      components: { DiscordWidgetSettings },
      setup() {
        const refreshInterval = ref(300);
        const showBots = ref(false);
        const showOfflineMembers = ref(true);
        const showAvatars = ref(true);
        const groupByStatus = ref(true);
        const sortBy = ref('status');
        const maxMembersToShow = ref(50);

        const sortOptions = [
          { title: 'Status', value: 'status' },
          { title: 'Username', value: 'username' },
          { title: 'Display Name', value: 'displayName' },
        ] as const;

        const handleSubmit = () => {
          submitSpy();
        };

        return {
          refreshInterval,
          showBots,
          showOfflineMembers,
          showAvatars,
          groupByStatus,
          sortBy,
          maxMembersToShow,
          sortOptions,
          handleSubmit,
        };
      },
      template: `
        <DiscordWidgetSettings
          v-model:refresh-interval="refreshInterval"
          v-model:show-bots="showBots"
          v-model:show-offline-members="showOfflineMembers"
          v-model:show-avatars="showAvatars"
          v-model:group-by-status="groupByStatus"
          v-model:sort-by="sortBy"
          v-model:max-members-to-show="maxMembersToShow"
          :min-refresh-seconds="60"
          :max-refresh-seconds="3600"
          :sort-options="sortOptions"
          @submit="handleSubmit"
        />
      `,
    }),
    {
      global: {
        stubs: {
          'v-text-field': VTextFieldStub,
          'v-checkbox': VCheckboxStub,
          'v-select': VSelectStub,
          'v-divider': defineComponent({ name: 'VDividerStub', setup() { return () => h('hr'); } }),
          CompactModeControl: defineComponent({ name: 'CompactModeControlStub', setup() { return () => h('div'); } }),
        },
      },
    },
  );

  return { wrapper, submitSpy };
};

describe('DiscordWidgetSettings', () => {
  it('binds checkbox controls through v-model', async () => {
    const { wrapper } = mountWrapper();
    const checkboxes = wrapper.findAll('.checkbox-stub input');

    expect(checkboxes).toHaveLength(4);

    await checkboxes[0].setValue(true);
    await checkboxes[1].setValue(false);

    const vm: any = wrapper.vm;
    expect(vm.showBots).toBe(true);
    expect(vm.showOfflineMembers).toBe(false);
  });

  it('updates numeric inputs and emits submit on enter', async () => {
    const { wrapper, submitSpy } = mountWrapper();
    const submitSpyOnHandler = vi.spyOn((wrapper.vm as any), 'handleSubmit');

    const numericInputs = wrapper.findAll('.text-field-stub input');
    expect(numericInputs).toHaveLength(2);

    await numericInputs[0].setValue('120');
    await numericInputs[0].trigger('keyup', { key: 'Enter' });

    await numericInputs[1].setValue('75');

    const vm: any = wrapper.vm;
    expect(vm.refreshInterval).toBe(120);
    expect(vm.maxMembersToShow).toBe(75);
    expect(submitSpy).toHaveBeenCalled();
    expect(submitSpyOnHandler).toHaveBeenCalled();
  });

  it('updates sort selection', async () => {
    const { wrapper } = mountWrapper();
    const select = wrapper.find('.select-stub select');

    await select.setValue('username');

    const vm: any = wrapper.vm;
    expect(vm.sortBy).toBe('username');
  });
});
