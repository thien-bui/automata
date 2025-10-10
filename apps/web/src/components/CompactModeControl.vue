<template>
  <div class="compact-mode-control">
    <v-list-subheader class="text-subtitle-1 font-weight-medium mb-3">
      Compact Mode
    </v-list-subheader>
    
    <v-btn-toggle
      :model-value="currentMode"
      mandatory
      density="compact"
      class="w-100"
      @update:model-value="handleModeChange"
    >
      <v-btn
        value="use-global"
        variant="tonal"
        class="flex-grow-1"
      >
        <v-icon class="mr-1">mdi-earth</v-icon>
        Use Global
      </v-btn>
      <v-btn
        value="force-compact"
        variant="tonal"
        class="flex-grow-1"
      >
        <v-icon class="mr-1">mdi-view-compact</v-icon>
        Compact
      </v-btn>
      <v-btn
        value="force-full"
        variant="tonal"
        class="flex-grow-1"
      >
        <v-icon class="mr-1">mdi-view-day</v-icon>
        Full
      </v-btn>
    </v-btn-toggle>
    
    <div class="text-caption text-medium-emphasis mt-2">
      <span v-if="currentMode === 'use-global'">
        Following global compact mode (currently {{ globalCompact ? 'compact' : 'full' }})
      </span>
      <span v-else-if="currentMode === 'force-compact'">
        Always show this widget in compact layout
      </span>
      <span v-else>
        Always show this widget in full layout
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WidgetCompactMode } from '@automata/types';
import { useUiPreferences } from '../composables/useUiPreferences';

interface Props {
  /** The unique identifier for this widget */
  widgetName: string;
}

const props = defineProps<Props>();

const { 
  isCompact: globalCompact, 
  getWidgetCompactMode, 
  setWidgetCompactMode 
} = useUiPreferences();

const currentMode = computed<WidgetCompactMode>(() => 
  getWidgetCompactMode(props.widgetName)
);

function handleModeChange(mode: WidgetCompactMode) {
  setWidgetCompactMode(props.widgetName, mode);
}
</script>

<style scoped>
.compact-mode-control {
  margin-bottom: 16px;
}

:deep(.v-btn-toggle .v-btn) {
  min-width: 80px;
  font-size: 0.875rem;
}

:deep(.v-btn-toggle .v-btn .v-icon) {
  font-size: 1rem;
}
</style>
