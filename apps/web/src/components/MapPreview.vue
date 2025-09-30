<template>
  <v-card class="map-preview" elevation="2" aria-label="Route preview map placeholder">
    <v-responsive aspect-ratio="16/9">
      <div class="placeholder text-body-2 text-medium-emphasis d-flex align-center justify-center">
        Map preview coming soon
      </div>
    </v-responsive>
  </v-card>
</template>

<script setup lang="ts">
// Placeholder component for Google Maps integration added in later plan steps.
</script>

<style scoped>
.map-preview {
  overflow: hidden;
}

.placeholder {
  background: repeating-linear-gradient(
    45deg,
    rgba(30, 136, 229, 0.08),
    rgba(30, 136, 229, 0.08) 10px,
    rgba(30, 136, 229, 0.16) 10px,
    rgba(30, 136, 229, 0.16) 20px
  );
  height: 100%;
}
</style>
