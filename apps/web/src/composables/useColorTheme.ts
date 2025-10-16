import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import { useTheme } from 'vuetify';

const THEME_STORAGE_KEY = 'automata:theme';

type ColorThemeName = 'light' | 'dark';
type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

type MediaQueryWithLegacy = MediaQueryList & {
  addListener?: (listener: MediaQueryChangeListener) => void;
  removeListener?: (listener: MediaQueryChangeListener) => void;
};

interface UseColorThemeResult {
  currentTheme: ComputedRef<ColorThemeName>;
  isDark: ComputedRef<boolean>;
  setTheme: (theme: ColorThemeName) => void;
  toggleTheme: () => void;
}

function isColorThemeName(value: unknown): value is ColorThemeName {
  return value === 'light' || value === 'dark';
}

function addMediaQueryListener(target: MediaQueryList, listener: MediaQueryChangeListener): () => void {
  if (typeof target.addEventListener === 'function') {
    target.addEventListener('change', listener);
    return () => target.removeEventListener('change', listener);
  }

  const legacyTarget = target as MediaQueryWithLegacy;

  if (typeof legacyTarget.addListener === 'function') {
    legacyTarget.addListener(listener);
    return () => {
      legacyTarget.removeListener?.(listener);
    };
  }

  return () => {};
}

export function useColorTheme(): UseColorThemeResult {
  const theme = useTheme();
  const manualOverride = ref(false);
  let mediaQuery: MediaQueryList | null = null;
  let mediaQueryCleanup: (() => void) | null = null;

  const currentTheme = computed<ColorThemeName>(() => {
    const name = theme.global.name.value;
    return isColorThemeName(name) ? name : 'light';
  });

  const isDark = computed(() => currentTheme.value === 'dark');

  const applyTheme = (nextTheme: ColorThemeName, persist: boolean) => {
    theme.change(nextTheme);

    if (persist && typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
  };

  const setTheme = (nextTheme: ColorThemeName): void => {
    manualOverride.value = true;
    applyTheme(nextTheme, true);
  };

  const toggleTheme = (): void => {
    setTheme(isDark.value ? 'light' : 'dark');
  };

  onMounted(() => {
    if (typeof window === 'undefined') {
      applyTheme('light', false);
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (isColorThemeName(storedTheme)) {
      applyTheme(storedTheme, false);
      manualOverride.value = true;
      return;
    }

    mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    const preferredTheme: ColorThemeName = mediaQuery?.matches ? 'dark' : 'light';
    applyTheme(preferredTheme, false);

    if (mediaQuery) {
      const listener: MediaQueryChangeListener = (event) => {
        if (manualOverride.value) {
          return;
        }

        applyTheme(event.matches ? 'dark' : 'light', false);
      };

      mediaQueryCleanup = addMediaQueryListener(mediaQuery, listener);
    }
  });

  onBeforeUnmount(() => {
    mediaQueryCleanup?.();
    mediaQueryCleanup = null;
    mediaQuery = null;
  });

  return {
    currentTheme,
    isDark,
    setTheme,
    toggleTheme,
  };
}
