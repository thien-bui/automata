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
        <section id="route-widget" aria-labelledby="route-widget-heading">
          <h1 class="sr-only" id="route-widget-heading">
            {{ pageTitle }} widget
          </h1>
          <RouteWidget
            @alerts-acknowledged="onAlertsAcknowledged"
            @alerts-updated="onAlertsUpdated"
          />
        </section>
      </v-container>
    </v-main>

    <ToastHost :messages="toastMessages" @dismiss="removeToast" />
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import AlertBell from './components/AlertBell.vue';
import RouteWidget from './components/RouteWidget.vue';
import ToastHost from './components/ToastHost.vue';

const pageTitle = 'Automata Commute Console';
const alertCount = ref(0);
const toastMessages = ref<Array<{ id: number; text: string }>>([
  { id: 1, text: 'Welcome back! Route monitoring is idle.' },
]);

const removeToast = (id: number) => {
  toastMessages.value = toastMessages.value.filter((toast) => toast.id !== id);
};

const onAlertsAcknowledged = () => {
  alertCount.value = 0;
};

const openAlertsPanel = () => {
  toastMessages.value = [
    ...toastMessages.value,
    {
      id: Date.now(),
      text: alertCount.value > 0
        ? `You have ${alertCount.value} pending alerts.`
        : 'No new alerts at this time.',
    },
  ];
};

const onAlertsUpdated = (count: number) => {
  alertCount.value = count;
  if (count > 0) {
    toastMessages.value = [
      ...toastMessages.value,
      {
        id: Date.now() + 1,
        text: `Alert status changed. ${count} pending alert${count === 1 ? '' : 's'}.`,
      },
    ];
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
