import { ref, watch } from 'vue';

const STORAGE_KEY = 'automata.alertThresholdMinutes';
const MIN_THRESHOLD_MINUTES = 5;

export const defaultAlertThresholdMinutes = Number(
  import.meta.env.VITE_DEFAULT_ALERT_THRESHOLD ?? '45',
);

function clampThreshold(value: number) {
  if (Number.isNaN(value)) {
    return defaultAlertThresholdMinutes;
  }

  return Math.max(MIN_THRESHOLD_MINUTES, Math.round(value));
}

export function useAlertThreshold() {
  const thresholdMinutes = ref(defaultAlertThresholdMinutes);

  if (typeof window !== 'undefined') {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (storedValue) {
      const parsed = Number(storedValue);
      thresholdMinutes.value = clampThreshold(parsed);
    }
  }

  watch(
    thresholdMinutes,
    (value) => {
      if (typeof window === 'undefined') {
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, String(value));
    },
    { flush: 'post' },
  );

  const setThreshold = (value: number) => {
    thresholdMinutes.value = clampThreshold(value);
  };

  const resetThreshold = () => {
    thresholdMinutes.value = defaultAlertThresholdMinutes;
  };

  return {
    thresholdMinutes,
    setThreshold,
    resetThreshold,
  };
}

