<template>
  <GlassSurface
    v-if="open"
    level="solid"
    rounded="lg"
    class="draw-panel"
    role="region"
    aria-label="Панель измерений"
  >
    <div class="draw-panel__header px-3 py-2">
      <v-icon
        size="18"
        color="primary"
        class="me-2"
      >mdi-ruler</v-icon>
      <span class="text-subtitle-2 font-weight-bold">Измерения</span>
      <v-spacer />
      <HintTip
        text="Закрыть панель измерений"
        hotkey="Esc"
        location="bottom"
      >
        <template #default="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon
            size="x-small"
            variant="text"
            aria-label="Закрыть панель измерений"
            @click="close"
          >
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </template>
      </HintTip>
    </div>

    <v-divider />

    <div class="pa-2">
      <div class="draw-panel__grid">
        <HintTip
          v-for="tool in measureTools"
          :key="tool.mode"
          :text="tool.label"
          :hint="tool.hint"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <button
              v-bind="tip"
              type="button"
              class="draw-tile"
              :class="{ 'draw-tile--active': draw.mode.value === tool.mode }"
              :aria-label="tool.label"
              :aria-pressed="draw.mode.value === tool.mode"
              @click="toggleMode(tool.mode)"
            >
              <v-icon
                size="20"
                :color="draw.mode.value === tool.mode ? 'primary' : undefined"
              >
                {{ tool.icon }}
              </v-icon>
              <span class="draw-tile__label">{{ tool.label }}</span>
            </button>
          </template>
        </HintTip>
      </div>
      <v-switch
        v-model="draw.snapEnabled.value"
        density="compact"
        hide-details
        color="primary"
        class="mt-1 px-1"
        label="Привязка к узлам сети"
      />
    </div>

    <!-- Текущее измерение -->
    <template v-if="draw.isMeasuring.value">
      <v-divider />
      <div class="px-3 py-2 draw-panel__live">
        <template v-if="draw.draftPoints.value.length">
          <div class="d-flex align-center justify-space-between">
            <span class="text-caption text-medium-emphasis">Точек: {{ draw.draftPoints.value.length }}</span>
            <span class="text-body-2 font-weight-medium">{{ liveMeasure }}</span>
          </div>
          <div
            v-if="draw.currentSegment.value"
            class="text-caption text-medium-emphasis"
          >
            Отрезок {{ formatLength(draw.currentSegment.value.length) }}, азимут {{ formatBearing(draw.currentSegment.value.bearing) }}
            <template v-if="draw.currentSegment.value.turn != null">
              , {{ formatTurn(draw.currentSegment.value.turn) }}
            </template>
          </div>
        </template>
        <div class="text-caption text-medium-emphasis mt-1 draw-panel__keys">
          <span><kbd>Клик</kbd> точка</span>
          <span><kbd>Двойной клик</kbd> / <kbd>Enter</kbd> / <kbd>ПКМ</kbd> завершить</span>
          <span><kbd>Backspace</kbd> убрать точку</span>
          <span><kbd>Esc</kbd> отменить</span>
        </div>
      </div>
    </template>

    <!-- Готовые измерения -->
    <template v-if="draw.measurements.value.length">
      <v-divider />
      <div class="draw-panel__list">
        <div
          v-for="(m, i) in draw.measurements.value"
          :key="m.id"
          class="measure-item"
        >
          <div class="d-flex align-center">
            <v-icon
              size="16"
              color="primary"
              class="me-2"
            >
              {{ m.kind === 'area' ? 'mdi-vector-square' : 'mdi-ruler' }}
            </v-icon>
            <button
              type="button"
              class="measure-item__value"
              title="Показать на карте"
              @click="draw.zoomTo(m.id)"
            >
              {{ i + 1 }}. {{ measurementLabel(m) }}
            </button>
            <v-spacer />
            <v-btn
              icon
              size="x-small"
              variant="text"
              aria-label="Копировать результат"
              title="Копировать результат"
              @click="copy(m)"
            >
              <v-icon size="16">mdi-content-copy</v-icon>
            </v-btn>
            <v-btn
              icon
              size="x-small"
              variant="text"
              aria-label="Удалить измерение"
              title="Удалить"
              @click="draw.removeMeasurement(m.id)"
            >
              <v-icon size="16">mdi-delete-outline</v-icon>
            </v-btn>
          </div>

          <!-- Профиль высот вдоль линейки -->
          <div
            v-if="m.kind === 'distance' && m.profile"
            class="measure-profile"
          >
            <div
              v-if="m.profile.status === 'loading'"
              class="text-caption text-medium-emphasis"
            >
              Профиль высот…
            </div>
            <div
              v-else-if="m.profile.status === 'error' || !profileView(m)"
              class="text-caption text-medium-emphasis"
            >
              Профиль высот недоступен
            </div>
            <template v-else>
              <svg
                class="measure-profile__chart"
                :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                preserveAspectRatio="none"
                role="img"
                :aria-label="`Профиль высот: от ${fmt0(profileView(m)!.stats.min)} до ${fmt0(profileView(m)!.stats.max)} м`"
              >
                <path
                  :d="profileView(m)!.area"
                  class="measure-profile__area"
                />
                <path
                  :d="profileView(m)!.line"
                  class="measure-profile__line"
                />
              </svg>
              <div class="measure-profile__axis text-caption text-medium-emphasis">
                <span>{{ fmt0(profileView(m)!.stats.max) }} м</span>
                <span>{{ fmt0(profileView(m)!.stats.min) }} м</span>
              </div>
              <div class="text-caption">
                Начало {{ fmt1(profileView(m)!.stats.start) }} м → конец {{ fmt1(profileView(m)!.stats.end) }} м
                (Δ {{ signed(profileView(m)!.stats.end - profileView(m)!.stats.start) }} м,
                уклон {{ signed(profileView(m)!.stats.slopePermille) }} ‰)
              </div>
              <div class="text-caption text-medium-emphasis">
                Подъём {{ fmt0(profileView(m)!.stats.gain) }} м, спуск {{ fmt0(profileView(m)!.stats.loss) }} м ·
                рельеф MapTiler, точность ±5 м
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="text-caption text-medium-emphasis px-3 pb-1">
        Вершины готовых измерений можно перетаскивать
      </div>
    </template>

    <v-divider />

    <div
      class="pa-2 d-flex flex-wrap"
      style="gap: 6px;"
    >
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        :disabled="draw.draftPoints.value.length < (draw.isArea.value ? 3 : 2)"
        @click="draw.finishShape()"
      >
        Готово
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        :disabled="!draw.draftPoints.value.length && !draw.measurements.value.length"
        @click="draw.undoPoint()"
      >
        Отменить
      </v-btn>
      <v-spacer />
      <v-btn
        v-if="draw.measurements.value.length"
        size="small"
        variant="text"
        prepend-icon="mdi-download"
        @click="exportGeoJson"
      >
        GeoJSON
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        color="error"
        :disabled="!draw.measurements.value.length && !draw.draftPoints.value.length"
        @click="draw.clearAll()"
      >
        Очистить
      </v-btn>
    </div>
  </GlassSurface>
</template>

<script setup lang="ts">
import HintTip from '~/components/HintTip.vue';
import GlassSurface from '~/components/GlassSurface.vue';
import { formatApiErrorWith } from '~/utils/apiError';
import { computed, onBeforeUnmount, watch } from 'vue';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  formatArea,
  formatBearing,
  formatLength,
  measurementLabel,
  profileStats,
  useMapDraw,
  type DrawMode,
  type Measurement,
} from '~/composables/useMapDraw';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatTurn } from '~/utils/cadGeometry';

const props = defineProps<{ map: MapLibreMap | null }>();
const open = defineModel<boolean>({ default: false });

const draw = useMapDraw();
const notificationStore = useNotificationStore();

const measureTools: Array<{ mode: DrawMode; label: string; icon: string; hint: string }> = [
  { mode: 'measure-distance', label: 'Расстояние', icon: 'mdi-ruler', hint: 'Кликайте точки линии, двойной клик — завершить' },
  { mode: 'measure-area', label: 'Площадь', icon: 'mdi-vector-square', hint: 'Обведите контур, двойной клик — замкнуть' },
];

const liveMeasure = computed(() => {
  if (draw.isArea.value) {
    const area = draw.draftArea.value;
    return area > 0 ? `${formatArea(area)} · ${formatLength(draw.draftLength.value)}`
                    : formatLength(draw.draftLength.value);
  }
  return formatLength(draw.draftLength.value);
});

const CHART_W = 300;
const CHART_H = 70;

/** Профиль высот: путь графика (SVG) и сводка */
const profileView = (m: Measurement) => {
  const pts = (m.profile?.points || []).filter((p): p is { d: number; h: number } => p.h != null);
  const stats = profileStats(m.profile?.points || []);
  if (!stats || pts.length < 2) return null;
  const maxD = pts[pts.length - 1].d || 1;
  const range = Math.max(stats.max - stats.min, 1);
  const xy = pts.map((p) => [
    (p.d / maxD) * CHART_W,
    CHART_H - 4 - ((p.h - stats.min) / range) * (CHART_H - 8),
  ]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return { stats, line, area: `${line} L${CHART_W},${CHART_H} L0,${CHART_H} Z` };
};

const fmt0 = (v: number) => v.toFixed(0);
const fmt1 = (v: number) => v.toFixed(1).replace('.', ',');
const signed = (v: number) => `${v > 0 ? '+' : ''}${fmt1(v)}`;

const toggleMode = (mode: DrawMode) => {
  draw.setMode(draw.mode.value === mode ? 'none' : mode);
};

const close = () => {
  draw.setMode('none');
  open.value = false;
};

const copy = async (m: Measurement) => {
  const view = m.kind === 'distance' ? profileView(m) : null;
  const text = view
    ? `${measurementLabel(m)}; высота ${fmt1(view.stats.start)} → ${fmt1(view.stats.end)} м`
    : measurementLabel(m);
  try {
    await navigator.clipboard.writeText(text);
    notificationStore.showSuccess(`Скопировано: ${text}`);
  } catch {
    notificationStore.showError('Не удалось скопировать');
  }
};

const exportGeoJson = () => {
  try {
    const blob = new Blob([draw.exportGeoJson()], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `measure-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.geojson`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notificationStore.showSuccess('Измерения выгружены в GeoJSON');
  } catch (e: any) {
    notificationStore.showError(formatApiErrorWith('Не удалось выгрузить GeoJSON', e, ''));
  }
};

// Панель подключается к карте только когда открыта: слои измерений
// не висят на карте в фоне. Сразу включается линейка.
watch(
  () => [open.value, props.map] as const,
  ([isOpen, map], prev) => {
    if (isOpen && map) {
      draw.attach(map);
      if (!prev?.[0]) draw.setMode('measure-distance');
    } else if (!isOpen) {
      draw.detach();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => draw.detach());
</script>

<style scoped>
.draw-panel {
  /* Слева, у кнопки слоёв: центр карты (место измерения) остаётся открытым */
  position: absolute;
  top: 16px;
  left: 72px;
  z-index: var(--z-controls);
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

.draw-panel__header {
  display: flex;
  align-items: center;
}

.draw-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.draw-panel__keys {
  display: flex;
  flex-wrap: wrap;
  column-gap: 10px;
  row-gap: 2px;
}

.draw-panel__keys kbd {
  font-family: inherit;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.draw-panel__list {
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
  padding: 4px 8px;
}

.measure-item {
  padding: 4px 4px 6px;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.measure-item:last-child {
  border-bottom: none;
}

.measure-item__value {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  color: rgb(var(--v-theme-on-surface));
}

.measure-item__value:hover {
  color: rgb(var(--v-theme-primary));
}

.measure-profile {
  position: relative;
  margin: 4px 0 0 24px;
}

.measure-profile__chart {
  width: 100%;
  height: 70px;
  display: block;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.measure-profile__area {
  fill: rgba(139, 115, 85, 0.25);
}

.measure-profile__line {
  fill: none;
  stroke: #8b7355;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.measure-profile__axis {
  position: absolute;
  top: 0;
  right: 4px;
  height: 70px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
  font-size: 10px;
}

@media (max-width: 600px) {
  .draw-panel {
    top: 8px;
    left: 8px;
    width: calc(100vw - 16px);
  }
}
</style>
