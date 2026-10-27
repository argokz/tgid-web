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
  top: var(--hud-top);
  right: var(--controls-w);
  z-index: var(--z-hud);
  /* от правой колонки до строки режимов (центр видимой части + половина строки + зазор) */
  max-width: min(480px, calc((100% - var(--map-left-inset, 0px) + var(--map-right-inset, 0px)) / 2 - var(--controls-w) - 100px));
}
/* телефон: полоса под строкой режимов — вся ширина до колонки контролов */
@media (max-width: 959.98px) {
  .pts-highlight-bar {
    max-width: calc(100% - var(--controls-w) - var(--shell-inset));
  }
}
.pts-highlight-bar :deep(.v-chip) {
  max-width: 100%;
}
</style>
