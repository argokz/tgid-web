<template>
  <div class="wg">
    <p class="text-caption text-medium-emphasis mb-2">
      Слой труб (линии) с диаметром и материалом и, если есть, слой задвижек (точки): shapefile в zip, GeoPackage,
      GeoJSON, FlatGeobuf, база ArcGIS в zip. Концы труб сшиваются, Т-примыкания разрезаются; отметок в ГИС нет —
      давление считается над общей отметкой сети, отбор разносится по длине труб.
    </p>
    <v-file-input
      v-model="files"
      label="Файл ГИС"
      accept=".zip,.gpkg,.geojson,.json,.fgb,.kml,.gml,.sxf,.rsc,.mif,.mid,.tab"
      multiple
      density="compact"
      variant="outlined"
      hide-details
      prepend-icon=""
      prepend-inner-icon="mdi-file-upload-outline"
      class="mb-2"
      @update:model-value="inspect()"
    />
    <v-alert
      v-if="errorMessage"
      type="error"
      density="compact"
      variant="tonal"
      closable
      class="mb-2"
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>
    <v-progress-linear
      v-if="busy === 'inspect'"
      indeterminate
      class="mb-2"
    />

    <template v-if="info">
      <div class="text-caption text-medium-emphasis mb-2">
        {{ info.format }} · {{ info.count.toLocaleString('ru-RU') }} объектов · {{ info.geometry_type }}
        <template v-if="info.crs">
          · {{ info.crs }}
        </template>
      </div>
      <v-alert
        v-for="w in info.warnings"
        :key="w"
        type="info"
        density="compact"
        variant="tonal"
        class="mb-2"
      >
        {{ w }}
      </v-alert>
      <div class="wg-grid mb-2">
        <v-select
          v-if="lineLayers.length > 1"
          :model-value="info.layer"
          :items="lineLayers"
          label="Слой труб"
          density="compact"
          variant="outlined"
          hide-details
          @update:model-value="(v: string) => inspect(v)"
        />
        <v-select
          v-model="params.valves_layer"
          :items="pointLayers"
          label="Слой задвижек"
          clearable
          :disabled="!pointLayers.length"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-select
          v-for="f in FIELDS"
          :key="f.key"
          v-model="params[f.key]"
          :items="info.columns"
          :label="f.label"
          clearable
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-text-field
          v-model.number="params.total_demand_ls"
          type="number"
          label="Отбор сети, л/с"
          :min="0"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-text-field
          v-model.number="params.source_head_m"
          type="number"
          label="Напор источника, м"
          :min="1"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-text-field
          v-model.number="params.elevation_m"
          type="number"
          label="Отметка сети, м"
          density="compact"
          variant="outlined"
          hide-details
        />
        <v-text-field
          v-model.number="params.snap_m"
          type="number"
          label="Допуск сшивки, м"
          :min="0"
          :max="20"
          :step="0.1"
          density="compact"
          variant="outlined"
          hide-details
        />
      </div>
      <v-radio-group
        v-model="params.components"
        density="compact"
        hide-details
        class="mb-2"
      >
        <v-radio
          value="largest"
          label="Несвязные части — отбросить (в модели — самая протяжённая с источником)"
        />
        <v-radio
          value="each"
          label="Каждой части — свой источник (насосные в ГИС — точками, зоны давления не связаны трубами)"
        />
      </v-radio-group>
      <div class="d-flex flex-wrap ga-2 mb-2">
        <v-btn
          size="small"
          variant="tonal"
          :loading="busy === 'check'"
          :disabled="!!busy || !engineAvailable"
          @click="run(true)"
        >
          Проверить
        </v-btn>
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          :loading="busy === 'apply'"
          :disabled="!!busy || !report || !engineAvailable"
          @click="run(false)"
        >
          Загрузить модель
        </v-btn>
      </div>
      <div
        v-if="report"
        class="text-body-2"
      >
        <div
          v-for="line in gisReportLines(report)"
          :key="line"
        >
          {{ line }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import {
  gisLayers,
  gisReportLines,
  type WaterGisInspect,
  type WaterGisParams,
  type WaterGisReport,
} from '~/utils/water';

/**
 * Сеть водоканала из ГИС → модель EPANET (itwin-api database/water_gis.py): разбор файла, сопоставление полей,
 * проверка сборки (отчёт и проверка движком), загрузка моделью со своей системой координат и задвижками.
 */
defineProps<{ engineAvailable: boolean }>();
const emit = defineEmits<{ imported: [modelId: number] }>();

type FieldKey = 'diameter_field' | 'material_field' | 'id_field' | 'status_field';
const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'diameter_field', label: 'Поле диаметра' },
  { key: 'material_field', label: 'Поле материала' },
  { key: 'id_field', label: 'Поле номера трубы' },
  { key: 'status_field', label: 'Поле «закрыта»' },
];
const DEFAULTS: WaterGisParams = {
  total_demand_ls: 50, source_head_m: 60, elevation_m: 0, snap_m: 0.5, components: 'largest',
};

const files = ref<File[]>([]);
const info = ref<WaterGisInspect | null>(null);
const report = ref<WaterGisReport | null>(null);
const params = reactive<WaterGisParams>({ ...DEFAULTS });
const busy = ref<'' | 'inspect' | 'check' | 'apply'>('');
const errorMessage = ref('');

const lineLayers = computed(() => gisLayers(info.value, 'line'));
const pointLayers = computed(() => gisLayers(info.value, 'point'));

const inspect = async (layer?: string) => {
  info.value = null;
  report.value = null;
  errorMessage.value = '';
  if (!files.value.length) return;
  busy.value = 'inspect';
  try {
    const res = await fastApiService.inspectWaterGis(files.value, layer);
    info.value = res;
    Object.assign(params, { ...DEFAULTS, ...res.suggested, layer: res.layer });
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Файл не разобран');
  } finally {
    busy.value = '';
  }
};

const run = async (dryRun: boolean) => {
  busy.value = dryRun ? 'check' : 'apply';
  errorMessage.value = '';
  try {
    const name = files.value[0]?.name.replace(/\.[^.]+$/, '') ?? 'Сеть из ГИС';
    const res = await fastApiService.importWaterGis(files.value, { ...params }, name, dryRun);
    report.value = res.report;
    if (!dryRun && res.model) emit('imported', res.model.id);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, dryRun ? 'Сеть не собрана' : 'Модель не загружена');
  } finally {
    busy.value = '';
  }
};

// изменили сопоставление — прежний отчёт устарел, загрузка — после новой проверки
watch(params, () => {
  if (busy.value !== 'inspect') report.value = null;
}, { deep: true });
</script>

<style scoped>
.wg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
</style>
