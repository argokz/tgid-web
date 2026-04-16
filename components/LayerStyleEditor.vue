<template>
  <v-alert
    type="info"
    variant="tonal"
    density="compact"
  >
    Редактор стилей временно недоступен. Используйте панель управления слоем.
  </v-alert>
</template>

<script setup lang="ts">
const props = defineProps<{
  layerType?: 'line' | 'circle' | 'fill' | 'symbol' | 'image';
}>();

void props;
</script>