import { computed, readonly, ref, watch } from 'vue';
import type { UiPreferencesState, WidgetCompactMode } from '@automata/types';

const STORAGE_KEY = 'automata:ui-preferences';
const DEFAULT_STATE: UiPreferencesState = {
  compactMode: true, // Default to compact as specified in the plan
  widgetCompactModes: {},
};

const state = ref<UiPreferencesState>({ ...DEFAULT_STATE });
const hydratedFromStorage = ref(false);

function hydrateFromStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    const parsed = JSON.parse(rawValue) as Partial<UiPreferencesState> | null;
    if (parsed && typeof parsed.compactMode === 'boolean') {
      state.value = {
        compactMode: parsed.compactMode,
        widgetCompactModes: parsed.widgetCompactModes || {},
      };
      hydratedFromStorage.value = true;
    }
  } catch {
    // Ignore malformed storage values and fall back to defaults.
  }
}

hydrateFromStorage();

watch(
  state,
  (nextState) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Ignore storage failures silently; preferences persist only in memory.
    }
  },
  { deep: true },
);

const isCompact = computed(() => state.value.compactMode);

function setCompactMode(value: boolean): void {
  if (state.value.compactMode === value) {
    return;
  }
  state.value = {
    ...state.value,
    compactMode: value,
  };
}

function toggleCompactMode(): void {
  setCompactMode(!state.value.compactMode);
}

function resetPreferences(): void {
  state.value = { ...DEFAULT_STATE };
}

function getWidgetCompactMode(widgetName: string): WidgetCompactMode {
  return state.value.widgetCompactModes[widgetName] || 'use-global';
}

function setWidgetCompactMode(widgetName: string, mode: WidgetCompactMode): void {
  const currentMode = state.value.widgetCompactModes[widgetName];
  if (currentMode === mode) {
    return;
  }
  
  state.value = {
    ...state.value,
    widgetCompactModes: {
      ...state.value.widgetCompactModes,
      [widgetName]: mode,
    },
  };
}

function isWidgetCompact(widgetName: string): boolean {
  const widgetMode = getWidgetCompactMode(widgetName);
  
  switch (widgetMode) {
    case 'force-compact':
      return true;
    case 'force-full':
      return false;
    case 'use-global':
    default:
      return state.value.compactMode;
  }
}

export function useUiPreferences() {
  return {
    state: readonly(state),
    isCompact,
    setCompactMode,
    toggleCompactMode,
    resetPreferences,
    getWidgetCompactMode,
    setWidgetCompactMode,
    isWidgetCompact,
    didHydrateFromStorage: computed(() => hydratedFromStorage.value),
  };
}
