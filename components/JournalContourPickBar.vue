<template>
  <div
    v-if="bridge.state.pick.active || bridge.state.overlay"
    class="journal-contour-bar"
  >
    <v-card
      elevation="6"
      rounded="lg"
      class="pa-2 d-flex align-center flex-wrap ga-2"
    >
      <template v-if="bridge.state.pick.active">
        <v-icon color="orange-darken-3">mdi-cursor-default-click-outline</v-icon>
        <div class="bar-text">
          <div class="text-body-2 font-weight-medium text-truncate">
            {{ bridge.state.pick.kind === 'node' ? 'Выбор' : 'Контур' }}: {{ bridge.state.pick.label }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Клик по {{ bridge.state.pick.kind === 'node' ? 'узлу' : 'участку' }} добавляет или убирает его
            · выбрано {{ bridge.state.pick.lineIds.length }}
          </div>
        </div>
        <v-btn
          size="small"
          variant="text"
          :disabled="!bridge.state.pick.lineIds.length"
          @click="clearAll"
        >Очистить</v-btn>
        <v-btn
          size="small"
          variant="text"
          @click="bridge.finishPick(false)"
        >Отмена</v-btn>
        <v-btn
          size="small"
          color="orange-darken-3"
          variant="flat"
          @click="bridge.finishPick(true)"
        >Готово</v-btn>
      </template>
      <template v-else-if="bridge.state.overlay">
        <v-icon color="purple-darken-2">mdi-vector-polyline</v-icon>
        <div class="bar-text">
          <div class="text-body-2 font-weight-medium text-truncate">{{ bridge.state.overlay.label }}</div>
          <div class="text-caption text-medium-emphasis">участков на карте: {{ bridge.state.overlay.geojson.features.length }}</div>
        </div>
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-close"
          @click="bridge.clearContour()"
        >Скрыть</v-btn>
      </template>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';

const bridge = useJournalMapBridge();

const clearAll = () => {
  for (const id of [...bridge.state.pick.lineIds]) bridge.togglePicked(id);
};
</script>

<style scoped>
.journal-contour-bar {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 6;
  max-width: calc(100% - 32px);
}
.bar-text {
  min-width: 0;
  max-width: 360px;
}
</style>
