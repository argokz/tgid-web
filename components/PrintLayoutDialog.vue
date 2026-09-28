<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1150"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-printer</v-icon>
        Печать и экспорт карты
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" density="compact" aria-label="Закрыть" @click="visible = false" />
      </v-card-title>

      <v-card-text class="pt-0">
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3" closable @click:close="error = ''">
          {{ error }}
        </v-alert>
        <v-row dense>
          <v-col cols="12" md="4">
            <div class="text-subtitle-2 mb-1">Лист</div>
            <div class="d-flex ga-2">
              <v-select v-model="form.format" :items="formats" label="Формат" density="compact" hide-details />
              <v-select v-model="form.orientation" :items="orientations" label="Ориентация" density="compact" hide-details />
            </div>
            <v-select
              v-model="form.dpi"
              :items="dpiItems"
              label="Разрешение"
              density="compact"
              hide-details
              class="mt-2"
            />
            <div class="text-subtitle-2 mt-3 mb-1">Масштаб</div>
            <v-radio-group v-model="form.scaleMode" density="compact" hide-details>
              <v-radio label="Вписать текущий вид карты" value="view" />
              <v-radio label="Задать масштаб (центр — центр карты)" value="fixed" />
            </v-radio-group>
            <v-combobox
              v-if="form.scaleMode === 'fixed'"
              v-model="scaleInput"
              :items="scaleItems"
              label="Масштаб 1:"
              density="compact"
              hide-details
              class="mt-1"
            />
            <div class="text-subtitle-2 mt-3 mb-1">Оформление</div>
            <v-text-field v-model="form.title" label="Заголовок" density="compact" hide-details class="mb-2" />
            <v-checkbox v-model="form.showStamp" label="Штамп" density="compact" hide-details />
            <template v-if="form.showStamp">
              <v-text-field v-model="form.organization" label="Организация" density="compact" hide-details class="mb-2" />
              <div class="d-flex ga-2 mb-2">
                <v-text-field v-model="form.author" label="Исполнитель" density="compact" hide-details />
                <v-text-field v-model="form.sheet" label="Лист" density="compact" hide-details style="max-width: 80px" />
              </div>
              <v-text-field v-model="form.date" label="Дата" density="compact" hide-details />
            </template>
            <v-checkbox
              v-model="form.showLegend"
              :label="`Легенда видимых слоёв (${legend.length})`"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="8">
            <div class="print-preview d-flex align-center justify-center">
              <img v-if="previewUrl" :src="previewUrl" alt="Макет листа" class="print-preview__img" />
              <div v-else class="text-medium-emphasis text-body-2 pa-6 text-center">
                <v-progress-circular v-if="rendering" indeterminate class="mb-2" /><br />
                {{ rendering ? 'Отрисовка карты для листа…' : 'Нажмите «Сформировать лист»' }}
              </div>
            </div>
            <v-alert v-if="result?.incomplete" type="warning" variant="tonal" density="compact" class="mt-1">
              Часть тайлов карты не загрузилась за 45 с — на листе могут быть пропуски. Сформируйте лист ещё раз.
            </v-alert>
            <div v-if="result" class="text-caption text-medium-emphasis mt-1">
              {{ form.format }}, {{ form.orientation === 'landscape' ? 'альбомная' : 'книжная' }},
              1:{{ result.scale.toLocaleString('ru-RU') }}, {{ result.canvas.width }}×{{ result.canvas.height }} px
              ({{ form.dpi }} dpi). Масштаб верен при печати в 100 % без «подгонки по размеру».
            </div>
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions class="flex-wrap ga-1">
        <v-btn variant="text" prepend-icon="mdi-image-outline" :loading="snapshotting" @click="downloadSnapshot">
          Снимок экрана PNG
        </v-btn>
        <v-spacer />
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-refresh" :loading="rendering" @click="render">
          Сформировать лист
        </v-btn>
        <v-btn :disabled="!result" prepend-icon="mdi-download" @click="downloadPng">PNG</v-btn>
        <v-btn :disabled="!result" prepend-icon="mdi-file-pdf-box" @click="downloadPdf">PDF</v-btn>
        <v-btn :disabled="!result" color="primary" prepend-icon="mdi-printer" @click="print">Печать</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useLayerStore } from '~/stores/layerStore';
import { useMapStore } from '~/stores/mapStore';
import { useAuthStore } from '~/stores/authStore';
import { dataUrlToBytes, jpegToPdf } from '~/utils/pdfImage';
import {
  SCALE_PRESETS,
  formatPrintDate,
  legendColor,
  type LegendItem,
  type LegendKind,
  type PageOrientation,
  type PaperFormat,
} from '~/utils/printLayout';
import {
  canvasToBlob,
  captureCurrentView,
  downloadBlob,
  printImage,
  renderPrintPage,
  type PrintOptions,
  type PrintResult,
} from '~/utils/printRender';

const { mobile } = useDisplay();
const mapStore = useMapStore();
const layerStore = useLayerStore();
const authStore = useAuthStore();

const visible = ref(false);
const rendering = ref(false);
const snapshotting = ref(false);
const error = ref('');
const result = ref<PrintResult | null>(null);
const previewUrl = ref('');

const formats: PaperFormat[] = ['A4', 'A3'];
const orientations = [
  { title: 'Альбомная', value: 'landscape' as PageOrientation },
  { title: 'Книжная', value: 'portrait' as PageOrientation },
];
const dpiItems = [
  { title: '150 dpi (быстро)', value: 150 },
  { title: '200 dpi', value: 200 },
  { title: '300 dpi (качество)', value: 300 },
];
const scaleItems = SCALE_PRESETS.map((s) => String(s));
const scaleInput = ref('2000');

const form = reactive<PrintOptions>({
  format: 'A4',
  orientation: 'landscape',
  dpi: 150,
  scaleMode: 'view',
  scale: 2000,
  title: 'Схема тепловой сети',
  organization: '',
  author: '',
  sheet: '1',
  date: formatPrintDate(new Date()),
  showLegend: true,
  showStamp: true,
});

/** Цвет из фактического стиля слоя на карте (SLD → MapLibre), а не из исходного конфига */
const livePaint = (layerId: string | undefined, kind: LegendKind): Record<string, unknown> | undefined => {
  const map = mapStore.map;
  if (!map || !layerId || !map.getLayer(layerId)) return undefined;
  const key = kind === 'line' ? 'line-color' : kind === 'circle' ? 'circle-color' : kind === 'fill' ? 'fill-color' : null;
  if (!key) return undefined;
  try {
    return { [key]: map.getPaintProperty(layerId, key) };
  } catch {
    return undefined;
  }
};

/** Легенда: видимые слои GeoServer (имя и цвет из стиля) и WMS-слои */
const legend = computed<LegendItem[]>(() => {
  const items: LegendItem[] = [];
  const seen = new Set<string>();
  // списки видимости восстанавливаются из localStorage — не доверяем форме
  const asList = (v: unknown): string[] => (Array.isArray(v) ? v : []);
  for (const id of asList(layerStore.visibleGeoServerLayers)) {
    const layer = layerStore.geoServerLayers.find((l) => l.id === id);
    if (!layer) continue;
    const label = layer.displayName || layer.label || layer.id;
    if (seen.has(label)) continue;
    seen.add(label);
    const kind = (layer.type || 'line') as LegendKind;
    items.push({ label, kind, color: legendColor(kind, livePaint(layer.layerId, kind)) ?? legendColor(kind, layer.paint) });
  }
  for (const id of asList(layerStore.visibleWmsLayers)) {
    const layer = layerStore.wmsLayers.find((l) => l.id === id);
    if (!layer || seen.has(layer.name)) continue;
    seen.add(layer.name);
    items.push({ label: layer.name, kind: 'fill', color: null });
  }
  return items;
});

watch(
  () => ({ ...form, scaleInput: scaleInput.value }),
  () => {
    // параметры изменились — старый лист не соответствует форме
    result.value = null;
    previewUrl.value = '';
  },
  { deep: true },
);

const requireMap = () => {
  const map = mapStore.map;
  if (!map) throw new Error('Карта ещё не загружена');
  return map;
};

const fileBase = () => {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `karta_${form.format}_${stamp}`;
};

const render = async () => {
  error.value = '';
  const scale = Number(String(scaleInput.value).replace(/\s/g, ''));
  if (form.scaleMode === 'fixed' && !(scale >= 100 && scale <= 1000000)) {
    error.value = 'Масштаб — число от 100 до 1 000 000';
    return;
  }
  rendering.value = true;
  try {
    const res = await renderPrintPage(requireMap(), { ...form, scale }, legend.value);
    // превью — уменьшенная копия (полный лист в 300 dpi — десятки МБ в dataURL)
    const k = Math.min(1, 1400 / res.canvas.width);
    const small = document.createElement('canvas');
    small.width = Math.round(res.canvas.width * k);
    small.height = Math.round(res.canvas.height * k);
    small.getContext('2d')!.drawImage(res.canvas, 0, 0, small.width, small.height);
    result.value = res;
    previewUrl.value = small.toDataURL('image/png');
  } catch (e: any) {
    error.value = `Не удалось сформировать лист: ${e?.message || e}`;
  } finally {
    rendering.value = false;
  }
};

const downloadPng = async () => {
  if (!result.value) return;
  downloadBlob(await canvasToBlob(result.value.canvas), `${fileBase()}.png`);
};

const downloadPdf = () => {
  if (!result.value) return;
  const { canvas, pageMm } = result.value;
  const jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92));
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height, pageMm.width, pageMm.height);
  downloadBlob(new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' }), `${fileBase()}.pdf`);
};

const print = () => {
  if (!result.value) return;
  printImage(result.value.canvas.toDataURL('image/png'), result.value.pageMm);
};

const downloadSnapshot = async () => {
  snapshotting.value = true;
  error.value = '';
  try {
    const canvas = await captureCurrentView(requireMap());
    downloadBlob(await canvasToBlob(canvas), `karta_ekran_${Date.now()}.png`);
  } catch (e: any) {
    error.value = `Снимок не получен: ${e?.message || e}`;
  } finally {
    snapshotting.value = false;
  }
};

const openDialog = () => {
  if (!form.author && authStore.username) form.author = authStore.username;
  form.date = formatPrintDate(new Date());
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.print-preview {
  min-height: 360px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 8px;
  padding: 8px;
}
.print-preview__img {
  max-width: 100%;
  max-height: 62vh;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  background: #fff;
}
</style>
