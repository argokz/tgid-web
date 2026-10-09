<template>
  <div
    v-if="layerStore.ptsHighlight"
    class="pts-highlight-bar"
  >
    <v-chip
      color="amber-darken-3"
      variant="elevated"
      prepend-icon="mdi-marker"
      closable
      close-label="Снять подсветку"
      @click:close="layerStore.setPtsHighlight(null)"
    >
      <span class="text-truncate">Подсвечено: {{ layerStore.ptsHighlight.title }}</span>
    </v-chip>
  </div>
</template>

<script setup lang="ts">
// Подсветка участков ПТС (components/PtsHighlightPanel.vue) — видна и снимается при закрытой панели
import { useLayerStore } from '~/stores/layerStore';

const layerStore = useLayerStore();
</script>

<style scoped>
.pts-highlight-bar {
  position: absolute;
  /* справа, у кнопок карты: слева её закрывает боковая панель */
  top: 12px;
  right: 68px;
  z-index: 6;
  max-width: min(480px, calc(100% - 140px));
}
.pts-highlight-bar :deep(.v-chip) {
  max-width: 100%;
}
</style>
