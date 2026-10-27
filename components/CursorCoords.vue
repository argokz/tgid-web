<template>
  <div class="cursor-coords">
    <v-menu location="top start">
      <template #activator="{ props: menuProps }">
        <button
          v-bind="menuProps"
          type="button"
          class="cursor-coords__crs"
          :aria-label="`Система координат: ${crsItem.title}`"
        >
          {{ crsItem.short }}
          <v-icon size="14">
            mdi-menu-up
          </v-icon>
        </button>
      </template>
      <v-list density="compact">
        <v-list-item
          v-for="c in CRS_ITEMS"
          :key="c.value"
          :active="c.value === crs"
          :title="c.title"
          @click="crs = c.value"
        />
      </v-list>
    </v-menu>

    <button
      type="button"
      class="cursor-coords__value"
      :disabled="!point"
      @click="copy(copyFormatFor(crs))"
    >
      {{ label }}
      <!-- aria-label: закрытая подсказка остаётся в DOM пустым role=tooltip (Lighthouse aria-tooltip-name) -->
      <v-tooltip
        activator="parent"
        location="top"
        aria-label="Щелчок или клавиша C над картой — скопировать"
      >
        Щелчок или клавиша C над картой — скопировать
      </v-tooltip>
    </button>

    <v-menu location="top end">
      <template #activator="{ props: menuProps }">
        <HintTip
          text="Скопировать координаты"
          hint="Выбрать формат: широта и долгота, X и Y"
          location="top"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="mergeProps(menuProps, tip)"
              icon
              variant="text"
              size="x-small"
              :disabled="!point"
              aria-label="Скопировать координаты"
            >
              <v-icon size="16">
                mdi-content-copy
              </v-icon>
            </v-btn>
          </template>
        </HintTip>
      </template>
      <v-list density="compact">
        <v-list-subheader>Скопировать</v-list-subheader>
        <v-list-item
          v-for="f in COORD_COPY_ITEMS"
          :key="f.value"
          :title="f.title"
          :subtitle="point ? (coordCopyText(f.value, point) ?? 'пересчёт…') : ''"
          @click="copy(f.value)"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, ref, watch } from 'vue';
import type maplibregl from 'maplibre-gl';
import { useMapStore } from '~/stores/mapStore';
import HintTip from '~/components/HintTip.vue';
import { registerHotkeys } from '~/composables/useHotkeys';
import { useNotificationStore } from '~/stores/notificationStore';
import { fastApiService } from '~/services/fastApiService';
import { useCoordCrs } from '~/composables/useCoordCrs';
import {
  COORD_COPY_ITEMS,
  coordCopyText,
  copyFormatFor,
  formatCursorCoords,
  type CoordCopyFormat,
  type CursorPoint,
  type PointCrs,
} from '~/utils/pointCrs';

const CRS_ITEMS: readonly { value: PointCrs; title: string; short: string }[] = [
  { value: 'wgs84', title: 'WGS84 (широта, долгота)', short: 'WGS84' },
  { value: 'local', title: 'Местная система (9998), м', short: 'Местн.' },
  { value: 'desktop', title: 'Координаты десктопа (x/y узлов), см', short: 'Десктоп' },
];
// Система — общая (composables/useCoordCrs): в ней же копируются координаты объекта из меню редактора
const { crs } = useCoordCrs();
watch(crs, (v) => {
  if (point.value && !point.value.converted && v !== 'wgs84') scheduleConvert();
});
const crsItem = computed(() => CRS_ITEMS.find((c) => c.value === crs.value) ?? CRS_ITEMS[0]!);

const point = ref<CursorPoint | null>(null);
const convertFailed = ref(false);
const label = computed(() => {
  if (!point.value) return 'Наведите курсор на карту';
  const text = formatCursorCoords(crs.value, point.value);
  if (text) return text;
  return convertFailed.value ? 'Пересчёт недоступен' : 'Пересчёт…';
});

// Местная система и десктоп — пересчёт на сервере (PostGIS), когда курсор остановился
const CONVERT_DELAY_MS = 250;
let convertTimer: ReturnType<typeof setTimeout> | null = null;
let convertRequest = 0;
const scheduleConvert = () => {
  if (convertTimer) clearTimeout(convertTimer);
  convertTimer = setTimeout(convertNow, CONVERT_DELAY_MS);
};
const convertNow = async (): Promise<void> => {
  const p = point.value;
  if (!p || p.converted) return;
  const request = ++convertRequest;
  try {
    const converted = await fastApiService.convertPoint('wgs84', p.lng, p.lat);
    if (request !== convertRequest || point.value !== p) return;
    point.value = { ...p, converted };
    convertFailed.value = false;
  } catch {
    if (request === convertRequest) convertFailed.value = true;
  }
};

let overMap = false;
const onMove = (e: maplibregl.MapMouseEvent) => {
  overMap = true;
  point.value = { lng: e.lngLat.lng, lat: e.lngLat.lat, converted: null };
  if (crs.value !== 'wgs84') scheduleConvert();
};
const onOut = () => {
  overMap = false;
};

const copy = async (format: CoordCopyFormat) => {
  const notify = useNotificationStore();
  if (!point.value) return;
  if (format !== 'latlng' && format !== 'lnglat' && !point.value.converted) {
    if (convertTimer) clearTimeout(convertTimer);
    await convertNow();
  }
  const text = point.value ? coordCopyText(format, point.value) : null;
  if (!text) {
    notify.showWarning('Не удалось пересчитать координаты — скопируйте в WGS84.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    notify.showSuccess(`Скопировано: ${text}`);
  } catch {
    notify.showWarning(`Буфер обмена недоступен: ${text}`);
  }
};

/** C над картой — скопировать в текущей системе; область `map` реестра хоткеев (поля ввода отсекает диспетчер) */
const onKeyDown = (ev: KeyboardEvent): boolean => {
  if (!overMap || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return false;
  if (ev.code !== 'KeyC') return false;
  void copy(copyFormatFor(crs.value));
  return true;
};

const mapStore = useMapStore();
let attached: maplibregl.Map | null = null;
const detach = () => {
  attached?.off('mousemove', onMove);
  attached?.getCanvasContainer().removeEventListener('mouseleave', onOut);
  attached = null;
};
watch(() => mapStore.map as maplibregl.Map | null, (map) => {
  if (map === attached) return;
  detach();
  if (!map) return;
  map.on('mousemove', onMove);
  map.getCanvasContainer().addEventListener('mouseleave', onOut);
  attached = map;
}, { immediate: true });
const disposeHotkeys = registerHotkeys({ id: 'cursor-coords-copy', area: 'map', handle: onKeyDown });
onBeforeUnmount(() => {
  detach();
  if (convertTimer) clearTimeout(convertTimer);
  disposeHotkeys();
});
</script>

<style scoped>
.cursor-coords {
  position: absolute;
  left: calc(var(--map-left-inset, 0px) + (100% - var(--map-left-inset, 0px) - var(--map-right-inset, 0px)) / 2); /* центр видимой части карты */
  bottom: calc(4px + var(--safe-bottom, 0px));
  transform: translateX(-50%);
  z-index: var(--z-hud);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px 0 2px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 22px;
  background: rgba(var(--v-theme-surface), 0.9);
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
  max-width: calc(100% - 24px);
}
.cursor-coords__crs {
  display: inline-flex;
  align-items: center;
  padding: 0 4px 0 8px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.cursor-coords__value {
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: copy;
}
.cursor-coords__value:disabled {
  cursor: default;
  opacity: 0.7;
}
</style>
