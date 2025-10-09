import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { useColorTheme } from '../useColorTheme';

const THEME_STORAGE_KEY = 'automata:theme';

const mockUseTheme = vi.fn();

vi.mock('vuetify', () => ({
  useTheme: () => mockUseTheme(),
}));

const createThemeStub = (initial: 'light' | 'dark' = 'light') => {
  const name = ref(initial);
  return {
    global: {
      name,
    },
  };
};

const createMatchMedia = (matches: boolean) => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  const addListener = vi.fn();
  const removeListener = vi.fn();

  return Object.assign(
    vi.fn(() => ({
      matches,
      addEventListener,
      removeEventListener,
      addListener,
      removeListener,
    })),
    {
      addEventListener,
      removeEventListener,
      addListener,
      removeListener,
    },
  );
};

describe('useColorTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseTheme.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mountComposable = () => {
    let composableResult: ReturnType<typeof useColorTheme>;

    const wrapper = mount(
      defineComponent({
        name: 'UseColorThemeHost',
        setup() {
          composableResult = useColorTheme();
          return () => h('div');
        },
      }),
    );

    return { wrapper, composableResult: composableResult! };
  };

  it('uses stored theme preference when available', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const matchMediaStub = createMatchMedia(false);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMediaStub,
    });

    const themeStub = createThemeStub();
    mockUseTheme.mockReturnValue(themeStub);

    const { wrapper, composableResult } = mountComposable();

    await nextTick();

    expect(themeStub.global.name.value).toBe('dark');
    expect(composableResult.isDark.value).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    wrapper.unmount();
  });

  it('falls back to system preference when no stored preference exists', async () => {
    const matchMediaStub = createMatchMedia(true);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMediaStub,
    });

    const themeStub = createThemeStub();
    mockUseTheme.mockReturnValue(themeStub);

    const { wrapper } = mountComposable();

    await nextTick();

    expect(themeStub.global.name.value).toBe('dark');

    wrapper.unmount();
  });

  it('toggles between light and dark themes and persists selection', async () => {
    const matchMediaStub = createMatchMedia(false);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMediaStub,
    });

    const themeStub = createThemeStub('light');
    mockUseTheme.mockReturnValue(themeStub);

    const { wrapper, composableResult } = mountComposable();

    await nextTick();

    expect(themeStub.global.name.value).toBe('light');

    composableResult.toggleTheme();
    await nextTick();

    expect(themeStub.global.name.value).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    composableResult.toggleTheme();
    await nextTick();

    expect(themeStub.global.name.value).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    wrapper.unmount();
  });
});
