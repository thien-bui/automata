<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" prominent>
      <v-app-bar-title class="font-weight-medium">
        {{ pageTitle }}
      </v-app-bar-title>
      <template #append>
        <AlertBell :unread-count="alertCount" @open-alerts="openAlertsPanel" />
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="py-8" fluid>
        <v-row>
          <v-col cols="12" md="6">
            <section id="route-widget" aria-labelledby="route-widget-heading">
              <h1 class="sr-only" id="route-widget-heading">
                {{ pageTitle }} widget
              </h1>
              <RouteWidget
                @alerts-acknowledged="onAlertsAcknowledged"
                @alerts-updated="onAlertsUpdated"
              />
            </section>
          </v-col>
          
          <v-col cols="12" md="6">
            <section id="weather-widget" aria-labelledby="weather-widget-heading">
              <h1 class="sr-only" id="weather-widget-heading">
                Weather widget
              </h1>
              <WeatherWidget />
            </section>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <ToastHost :messages="toastMessages" @dismiss="dismissToast" />
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import AlertBell from './components/AlertBell.vue';
import RouteWidget from './components/RouteWidget.vue';
import ToastHost from './components/ToastHost.vue';
import WeatherWidget from './components/WeatherWidget.vue';
import { provideToasts } from './composables/useToasts';

const pageTitle = 'Automata';
const alertCount = ref(0);

const { messages: toastMessages, dismiss: dismissToast, push: pushToast } = provideToasts([
  {
    text: 'Welcome back! Route monitoring is idle.',
    variant: 'info',
    timeout: 4000,
  },
]);

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
</style>
