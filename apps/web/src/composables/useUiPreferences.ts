import { computed, readonly, ref, watch } from 'vue';
import type { UiPreferencesState, WidgetCompactMode } from '@automata/types';

const STORAGE_KEY = 'automata:ui-preferences';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const DEFAULT_STATE: UiPreferencesState = {
  compactMode: true, // Default to compact as specified in the plan
  widgetCompactModes: {},
};

const state = ref<UiPreferencesState>({ ...DEFAULT_STATE });
const hydratedFromStorage = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);

async function hydrateFromApi(): Promise<void> {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await fetch(`${API_BASE_URL}/config?forceRefresh=false`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
    }
    
    const config = await response.json();
    
    if (config.ui && typeof config.ui.compactMode === 'boolean') {
      state.value = {
        compactMode: config.ui.compactMode,
        widgetCompactModes: config.ui.widgetCompactModes || {},
      };
      hydratedFromStorage.value = true;
      
      // Sync with localStorage for offline support
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
        } catch {
          // Ignore storage failures
        }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to hydrate from API, falling back to localStorage:', err);
    
    // Fall back to localStorage on API failure
    hydrateFromStorage();
  } finally {
    isLoading.value = false;
  }
}

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

// Try API first, then fall back to localStorage
hydrateFromApi();

watch(
  state,
  async (nextState) => {
    if (typeof window === 'undefined') {
      return;
    }
    
    // Update localStorage
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Ignore storage failures silently
    }
    
    // Update API in background (don't block UI)
    try {
      const response = await fetch(`${API_BASE_URL}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ui: {
            compactMode: nextState.compactMode,
            widgetCompactModes: nextState.widgetCompactModes,
          },
        }),
      });
      
      if (!response.ok) {
        console.warn('Failed to update config on server:', response.status);
      }
    } catch (err) {
      console.warn('Failed to sync config to server:', err);
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
    isLoading: readonly(isLoading),
    error: readonly(error),
  };
}
