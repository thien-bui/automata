<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" prominent>
      <v-app-bar-title class="font-weight-medium">
        {{ pageTitle }}
      </v-app-bar-title>
      <template #append>
        <v-btn
          icon
          color="secondary"
          variant="text"
          :aria-label="compactButtonLabel"
          @click="toggleCompactMode"
        >
          <v-icon :icon="compactIcon" />
        </v-btn>
        <v-btn
          icon
          color="secondary"
          variant="text"
          :aria-label="themeButtonLabel"
          @click="toggleTheme"
        >
          <v-icon :icon="themeIcon" />
        </v-btn>
        <AlertBell :unread-count="alertCount" @open-alerts="openAlertsPanel" />
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="py-8" fluid>
        <div class="widget-stack">
          <section class="widget-stack__item" id="discord-widget" aria-labelledby="discord-widget-heading">
            <h1 class="sr-only" id="discord-widget-heading">
              Discord widget
            </h1>
            <DiscordWidget />
          </section>

          <section class="widget-stack__item" id="weather-widget" aria-labelledby="weather-widget-heading">
            <h1 class="sr-only" id="weather-widget-heading">
              Weather widget
            </h1>
            <WeatherWidget />
          </section>

          <section class="widget-stack__item" id="route-widget" aria-labelledby="route-widget-heading">
            <h1 class="sr-only" id="route-widget-heading">
              {{ pageTitle }} widget
            </h1>
            <RouteWidget
              @alerts-acknowledged="onAlertsAcknowledged"
              @alerts-updated="onAlertsUpdated"
            />
          </section>
        </div>
      </v-container>
    </v-main>

    <ToastHost :messages="toastMessages" @dismiss="dismissToast" />
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import AlertBell from './components/AlertBell.vue';
import DiscordWidget from './components/DiscordWidget.vue';
import RouteWidget from './components/RouteWidget.vue';
import ToastHost from './components/ToastHost.vue';
import WeatherWidget from './components/WeatherWidget.vue';
import { provideToasts } from './composables/useToasts';
import { useColorTheme } from './composables/useColorTheme';
import { useUiPreferences } from './composables/useUiPreferences';

const pageTitle = 'Automata';
const alertCount = ref(0);

const { messages: toastMessages, dismiss: dismissToast, push: pushToast } = provideToasts([
  {
    text: 'Welcome back! Route monitoring is idle.',
    variant: 'info',
    timeout: 4000,
  },
]);

const { isDark, toggleTheme } = useColorTheme();
const themeIcon = computed(() => (isDark.value ? 'mdi-weather-sunny' : 'mdi-weather-night'));
const themeButtonLabel = computed(() => (isDark.value ? 'Switch to light theme' : 'Switch to dark theme'));

const { isCompact, toggleCompactMode } = useUiPreferences();
const compactIcon = computed(() => (isCompact.value ? 'mdi-view-compact-outline' : 'mdi-view-day'));
const compactButtonLabel = computed(() => (isCompact.value ? 'Switch to expanded widget layout' : 'Switch to compact widget layout'));

const onAlertsAcknowledged = () => {
  alertCount.value = 0;
};

const openAlertsPanel = () => {
  pushToast({
    text:
      alertCount.value > 0
        ? `You have ${alertCount.value} pending alerts.`
        : 'No new alerts at this time.',
    variant: alertCount.value > 0 ? 'warning' : 'info',
  });
};

const onAlertsUpdated = (count: number) => {
  alertCount.value = count;
  if (count > 0) {
    pushToast({
      text: `Alert status changed. ${count} pending alert${count === 1 ? '' : 's'}.`,
      variant: 'warning',
    });
  }
};

</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.widget-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.widget-stack__item {
  flex: 1 1 100%;
  min-width: 0;
}

@media (min-width: 960px) {
  .widget-stack {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .widget-stack__item {
    flex: 1 1 420px;
  }
}
</style>
