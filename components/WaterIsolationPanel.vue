<template>
  <div class="wi">
    <div class="d-flex align-center flex-wrap ga-2 mb-1">
      <div class="text-subtitle-2">
        Отключение участка задвижками
      </div>
      <v-spacer />
      <v-switch
        v-model="onMap"
        label="Отключение на карте"
        :disabled="!result"
        density="compact"
        hide-details
        color="primary"
        class="flex-grow-0"
      />
    </div>
    <p class="text-caption text-medium-emphasis mb-2">
      Участок трубы — всё, до чего от неё можно дойти, не проходя через задвижку. Без воды остаются узлы участка и
      отрезанные от источников; расчёт с отбором по давлению показывает недоподачу в остальной сети.
    </p>

    <div class="d-flex align-center flex-wrap ga-2 mb-2 text-body-2">
      <span v-if="valves">Задвижек в модели: {{ valves.count }}<template v-if="valves.count">
        ({{ sourceText }})</template></span>
      <v-btn
        v-if="canEdit"
        size="small"
        variant="tonal"
        :loading="busy === 'valves'"
        :disabled="!!busy"
        @click="generate"
      >
        Расставить «N−1»
      </v-btn>
    </div>

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

    <div class="d-flex align-center flex-wrap ga-2 mb-2">
      <v-autocomplete
        v-model="linkId"
        :items="pipeIds"
        label="Труба"
        density="compact"
        hide-details
        variant="outlined"
        class="wi-link"
      />
      <v-btn
        size="small"
        variant="tonal"
        :loading="busy === 'find'"
        :disabled="!linkId || !!busy || !valves?.count"
        @click="find(false)"
      >
        Найти задвижки
      </v-btn>
      <v-btn
        v-if="canCalc"
        size="small"
        variant="tonal"
        :loading="busy === 'run'"
        :disabled="!linkId || !!busy || !valves?.count || !engineAvailable"
        @click="find(true)"
      >
        Рассчитать отключение
      </v-btn>
    </div>

    <div
      v-if="result"
      class="text-body-2"
    >
      <div class="mb-1">
        <strong>Закрыть задвижки ({{ result.close_valves.length }}):</strong>
        {{ valveText }}
      </div>
      <div
        v-if="result.close_devices.length"
        class="mb-1"
      >
        <strong>Закрыть насосы и арматуру:</strong> {{ result.close_devices.join(', ') }}
      </div>
      <div class="mb-1">
        Участок: {{ result.segment.links.length }} тр., {{ num(result.segment.length_m) }} м.
        Без воды {{ noWaterCount }} узл. (на участке {{ result.no_water.segment_nodes.length }},
        отрезаны {{ result.no_water.cut_off_nodes.length }}), отбор {{ num(result.no_water.demand_ls) }} л/с.
      </div>
      <v-alert
        v-if="result.sources_inside.length"
        type="warning"
        density="compact"
        variant="tonal"
        class="mb-1"
      >
        В отключаемый участок попадают ёмкости: {{ result.sources_inside.join(', ') }}.
      </v-alert>
      <v-alert
        v-if="result.simulation_error"
        type="warning"
        density="compact"
        variant="tonal"
        class="mb-1"
      >
        {{ result.simulation_error }}
      </v-alert>
      <div
        v-else-if="result.supply"
        class="mb-1"
      >
        Расчёт №{{ result.run_id }} (сутки, отбор по давлению): подано {{ num(result.supply.delivered_ls) }} из
        {{ num(result.supply.expected_ls) }} л/с.
        <template v-if="result.supply.pressure_short_nodes">
          Из-за падения давления недоподача у {{ result.supply.pressure_short_nodes }} узл.:
          {{ pressureText }}.
        </template>
        <template v-else>
          Остальная сеть давление держит — недоподачи из-за отключения нет.
        </template>
      </div>
      <div class="d-flex flex-wrap ga-3 text-caption mt-1">
        <span
          v-for="(meta, key) in ISOLATION_META"
          :key="key"
        ><span
          class="wi-dot"
          :style="{ background: meta.color }"
        />{{ meta.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { confirmAction } from '~/composables/useConfirm';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import { ISOLATION_META, type WaterIsolation, type WaterValves } from '~/utils/water';

/**
 * Отключение участка водопровода (itwin-api database/water_isolation.py): задвижки модели, расстановка «N−1»,
 * какие задвижки закрыть, кто без воды; расчёт EPANET с отбором по давлению — недоподача в остальной сети.
 */
const props = defineProps<{
  modelId: number;
  network: GeoJSON.FeatureCollection | null;
  canEdit: boolean;
  canCalc: boolean;
  engineAvailable: boolean;
}>();
const emit = defineEmits<{
  /** Отключение для карты (null — карта снова по давлению или зонам) */
  isolation: [data: { result: WaterIsolation; valves: WaterValves | null } | null];
  /** Выполнен расчёт отключения — новый расчёт модели */
  ran: [runId: number];
}>();

const LIST_LIMIT = 12;
const SOURCE_LABEL: Record<string, string> = { strategic: '«N−1»', user: 'вручную', gis: 'из ГИС' };
const valves = ref<WaterValves | null>(null);
const result = ref<WaterIsolation | null>(null);
const linkId = ref<string | null>(null);
const onMap = ref(false);
const busy = ref<'' | 'valves' | 'find' | 'run'>('');
const errorMessage = ref('');

const pipeIds = computed(() => (props.network?.features ?? [])
  .map((f) => f.properties ?? {})
  .filter((p) => p.kind === 'link' && p.type === 'Pipe')
  .map((p) => String(p.id))
  .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })));
const sourceText = computed(() => Object.entries(valves.value?.by_source ?? {})
  .map(([k, n]) => `${SOURCE_LABEL[k] ?? k}: ${n}`).join(', '));
const num = (v: number | null | undefined) => (v == null ? '—' : (Math.round(v * 10) / 10 || 0).toLocaleString('ru-RU'));
const more = (n: number) => (n > LIST_LIMIT ? ` и ещё ${n - LIST_LIMIT}` : '');
const valveText = computed(() => {
  const list = result.value?.close_valves ?? [];
  if (!list.length) return 'нет — участок ограничен насосами, арматурой или закрытыми трубами';
  return list.slice(0, LIST_LIMIT).map((v) => `на трубе ${v.link} у узла ${v.node}`).join('; ') + more(list.length);
});
const noWaterCount = computed(() => (result.value
  ? result.value.no_water.segment_nodes.length + result.value.no_water.cut_off_nodes.length : 0));
const pressureText = computed(() => {
  const list = result.value?.supply?.pressure_short ?? [];
  return list.slice(0, LIST_LIMIT)
    .map((s) => `${s.node} — ${num(s.delivered_ls)} из ${num(s.expected_ls)} л/с`).join('; ') + more(list.length);
});

const publish = () => emit('isolation', onMap.value && result.value ? { result: result.value, valves: valves.value } : null);

const loadValves = async () => {
  try {
    valves.value = await fastApiService.getWaterValves(props.modelId);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Задвижки не загрузились');
  }
};

const generate = async () => {
  if (valves.value?.count && !(await confirmAction({
    text: 'Заменить задвижки, расставленные по «N−1»? Поставленные вручную останутся.', action: 'Расставить',
  }))) return;
  busy.value = 'valves';
  try {
    valves.value = await fastApiService.generateWaterValves(props.modelId);
    result.value = null;
    publish();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Задвижки не расставлены');
  } finally {
    busy.value = '';
  }
};

const find = async (run: boolean) => {
  if (!linkId.value) return;
  busy.value = run ? 'run' : 'find';
  errorMessage.value = '';
  try {
    result.value = await fastApiService.waterIsolation(props.modelId, linkId.value, run);
    onMap.value = true;
    publish();
    if (result.value.run_id) emit('ran', result.value.run_id);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, run ? 'Отключение не рассчитано' : 'Задвижки не найдены');
  } finally {
    busy.value = '';
  }
};

watch(() => props.modelId, () => {
  result.value = null;
  linkId.value = null;
  errorMessage.value = '';
  publish();
  void loadValves();
}, { immediate: true });
watch(onMap, publish);
</script>

<style scoped>
.wi-link { max-width: 200px; }
.wi-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }
</style>
