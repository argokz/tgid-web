<template>
  <v-card
    v-if="open"
    class="draw-panel"
    elevation="8"
    rounded="lg"
    role="region"
    aria-label="Панель рисования и измерений"
  >
    <div class="draw-panel__header px-3 py-2">
      <v-icon size="18" color="primary" class="me-2">mdi-draw</v-icon>
      <span class="text-subtitle-2 font-weight-bold">Рисование и измерения</span>
      <v-spacer />
      <v-btn
        icon
        size="x-small"
        variant="text"
        aria-label="Закрыть панель рисования"
        @click="close"
      >
        <v-icon size="18">mdi-close</v-icon>
      </v-btn>
    </div>

    <v-divider />

    <div class="pa-2">
      <div class="text-caption text-medium-emphasis mb-1 px-1">Рисование</div>
      <div class="draw-panel__grid">
        <button
          v-for="tool in drawTools"
          :key="tool.mode"
          type="button"
          class="draw-tile"
          :class="{ 'draw-tile--active': draw.mode.value === tool.mode }"
          :aria-label="tool.label"
          :aria-pressed="draw.mode.value === tool.mode"
          @click="toggleMode(tool.mode)"
        >
          <v-icon size="20" :color="draw.mode.value === tool.mode ? 'primary' : undefined">
            {{ tool.icon }}
          </v-icon>
          <span class="draw-tile__label">{{ tool.label }}</span>
        </button>
      </div>

      <div class="text-caption text-medium-emphasis mt-3 mb-1 px-1">Измерения</div>
      <div class="draw-panel__grid">
        <button
          v-for="tool in measureTools"
          :key="tool.mode"
          type="button"
          class="draw-tile"
          :class="{ 'draw-tile--active': draw.mode.value === tool.mode }"
          :aria-label="tool.label"
          :aria-pressed="draw.mode.value === tool.mode"
          @click="toggleMode(tool.mode)"
        >
          <v-icon size="20" :color="draw.mode.value === tool.mode ? 'primary' : undefined">
            {{ tool.icon }}
          </v-icon>
          <span class="draw-tile__label">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <v-divider />

    <!-- Текущее измерение -->
    <div v-if="draw.draftPoints.value.length > 0" class="px-3 py-2 draw-panel__live">
      <div class="d-flex align-center justify-space-between">
        <span class="text-caption text-medium-emphasis">Точек: {{ draw.draftPoints.value.length }}</span>
        <span class="text-body-2 font-weight-medium">{{ liveMeasure }}</span>
      </div>
      <div class="text-caption text-medium-emphasis mt-1">
        Двойной клик или «Готово» — завершить фигуру
      </div>
    </div>

    <v-divider v-if="draw.draftPoints.value.length > 0" />

    <div class="pa-2 d-flex flex-wrap" style="gap: 6px;">
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        :disabled="draw.draftPoints.value.length < 2"
        @click="draw.finishShape()"
      >
        Готово
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        :disabled="!draw.draftPoints.value.length && !draw.features.value.length"
        @click="draw.undoPoint()"
      >
        Отменить
      </v-btn>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        color="error"
        :disabled="!draw.features.value.length && !draw.draftPoints.value.length"
        @click="draw.clearAll()"
      >
        Очистить
      </v-btn>
    </div>

    <template v-if="draw.features.value.length">
      <v-divider />
      <div class="px-3 py-2 d-flex align-center">
        <span class="text-caption text-medium-emphasis">
          Объектов: {{ draw.features.value.length }}
        </span>
        <v-spacer />
        <v-btn
          size="x-small"
          variant="text"
          prepend-icon="mdi-download"
          @click="exportGeoJson"
        >
          GeoJSON
        </v-btn>
      </div>
    </template>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { formatArea, formatLength, useMapDraw, type DrawMode } from '~/composables/useMapDraw';
import { useNotificationStore } from '~/stores/notificationStore';

const props = defineProps<{ map: MapLibreMap | null }>();
const open = defineModel<boolean>({ default: false });

const draw = useMapDraw();
const notificationStore = useNotificationStore();

const drawTools: Array<{ mode: DrawMode; label: string; icon: string }> = [
  { mode: 'point', label: 'Точка', icon: 'mdi-map-marker-plus-outline' },
  { mode: 'line', label: 'Линия', icon: 'mdi-vector-polyline' },
  { mode: 'polygon', label: 'Полигон', icon: 'mdi-vector-polygon' },
];

const measureTools: Array<{ mode: DrawMode; label: string; icon: string }> = [
  { mode: 'measure-distance', label: 'Расстояние', icon: 'mdi-ruler' },
  { mode: 'measure-area', label: 'Площадь', icon: 'mdi-vector-square' },
];

const liveMeasure = computed(() => {
  if (draw.mode.value === 'measure-area' || draw.mode.value === 'polygon') {
    const area = draw.draftArea.value;
    return area > 0 ? `${formatArea(area)} · ${formatLength(draw.draftLength.value)}`
                    : formatLength(draw.draftLength.value);
  }
  return formatLength(draw.draftLength.value);
});

const toggleMode = (mode: DrawMode) => {
  draw.setMode(draw.mode.value === mode ? 'none' : mode);
};

const close = () => {
  draw.setMode('none');
  open.value = false;
};

const exportGeoJson = () => {
  try {
    const blob = new Blob([draw.exportGeoJson()], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `draw-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.geojson`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notificationStore.showSuccess('Геометрия выгружена в GeoJSON');
  } catch (e: any) {
    notificationStore.showError('Не удалось выгрузить GeoJSON: ' + (e?.message || ''));
  }
};

// Панель подключается к карте только когда открыта: слои рисования
// не висят на карте в фоне
watch(
  () => [open.value, props.map] as const,
  ([isOpen, map]) => {
    if (isOpen && map) draw.attach(map);
    else if (!isOpen) draw.detach();
  },
  { immediate: true }
);

onBeforeUnmount(() => draw.detach());
</script>

<style scoped>
.draw-panel {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  width: min(340px, calc(100vw - 32px));
  background: rgb(var(--v-theme-surface));
}

.draw-panel__header {
  display: flex;
  align-items: center;
}

.draw-panel__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.draw-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), 0.2);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.draw-tile:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

.draw-tile--active {
  background: rgba(var(--v-theme-primary), 0.12);
  border-color: rgba(var(--v-theme-primary), 0.5);
}

.draw-tile__label {
  font-size: 11px;
  line-height: 1.1;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
}

.draw-panel__live {
  background: rgba(var(--v-theme-primary), 0.04);
}

@media (max-width: 600px) {
  .draw-panel {
    top: 8px;
    width: calc(100vw - 16px);
  }
}
</style>
