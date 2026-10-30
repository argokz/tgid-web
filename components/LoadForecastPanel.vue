<template>
  <div class="lf">
    <div class="d-flex align-center flex-wrap ga-2 mb-2">
      <div class="text-body-2 text-medium-emphasis">
        {{ overview ? weatherText(overview.weather) : 'Погода…' }}
      </div>
      <v-spacer />
      <v-btn
        v-if="canImport"
        size="small"
        variant="text"
        prepend-icon="mdi-refresh"
        :loading="refreshing"
        @click="refreshWeather"
      >
        Обновить погоду
      </v-btn>
      <v-btn
        v-if="canImport"
        size="small"
        variant="text"
        prepend-icon="mdi-file-upload-outline"
        :loading="importing"
        @click="fileInput?.click()"
      >
        Прогноз файлом
      </v-btn>
      <input
        ref="fileInput"
        type="file"
        accept=".csv,.txt,.xlsx"
        class="d-none"
        @change="onFile"
      >
    </div>
    <p class="text-body-2 mb-2">
      Нагрузка потребителей источника по последнему расчёту, пересчитанная на температуру воздуха по температурному
      графику: отопление и вентиляция — по относительной нагрузке графика, ГВС — среднечасовая. Тепловые потери сети не
      входят. Факт — по расходомерам и термометрам на выходе источника.
    </p>
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
      v-if="loading && !overview"
      indeterminate
    />
    <p
      v-else-if="overview && !overview.sources.length"
      class="text-body-2 text-medium-emphasis"
    >
      Нет источников с расчётом нагрузок: выполните плановый расчёт фрагмента с источником.
    </p>
    <v-table
      v-else-if="overview"
      density="compact"
      class="lf-table mb-3"
    >
      <thead>
        <tr>
          <th>Источник</th>
          <th class="text-right">
            Расчётная
          </th>
          <th class="text-right">
            Воздух, °C
          </th>
          <th class="text-right">
            Пик / среднее
          </th>
          <th class="text-right">
            За сутки
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="s in overview.sources"
          :key="s.id"
          :class="{ 'lf-row--active': s.id === selectedId }"
          class="lf-row"
          tabindex="0"
          @click="select(s.id)"
          @keydown.enter="select(s.id)"
        >
          <td>
            {{ s.name || `Источник ${s.id}` }}
            <div class="text-caption text-medium-emphasis">
              {{ s.fragment || `фрагмент ${s.fileid}` }} · потребителей {{ s.consumers }}
            </div>
          </td>
          <td class="text-right text-no-wrap">
            {{ num(s.base.total) }}
            <div class="text-caption text-medium-emphasis">
              Гкал/ч при {{ s.base.tn }} °C
            </div>
          </td>
          <td class="text-right text-no-wrap">
            <template v-if="s.next.hours">
              {{ num(s.next.t_min) }}…{{ num(s.next.t_max) }}
            </template>
            <template v-else>
              —
            </template>
          </td>
          <td class="text-right text-no-wrap">
            <template v-if="s.next.hours">
              {{ num(s.next.q_max) }} / {{ num(s.next.q_avg) }}
              <div class="text-caption text-medium-emphasis">
                Гкал/ч
              </div>
            </template>
            <template v-else>
              —
            </template>
          </td>
          <td class="text-right text-no-wrap">
            {{ s.next.hours ? `${num(s.next.q_sum, 0)} Гкал` : '—' }}
          </td>
        </tr>
      </tbody>
    </v-table>

    <div v-if="detail">
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <div class="text-subtitle-2">
          {{ detail.name || `Источник ${detail.id}` }}
        </div>
        <div class="text-caption text-medium-emphasis">
          основа — расчёт №{{ detail.calculation.id }} при {{ detail.calculation.tn }} °C
        </div>
        <v-spacer />
        <v-btn
          v-if="authStore.canCalculate && detail.next.tn_calc != null"
          size="small"
          variant="tonal"
          :loading="calcRunning"
          @click="runCalc"
        >
          Расчёт на {{ detail.next.tn_calc }} °C (минимум суток)
        </v-btn>
      </div>
      <v-progress-linear
        v-if="detailLoading"
        indeterminate
      />
      <ChartFrame
        :option="tempOption"
        :label="`${detail.name}: температура воздуха`"
        :summary="tempSummary"
        :height="170"
      />
      <ChartFrame
        :option="loadChart"
        :label="`${detail.name}: нагрузка`"
        :summary="loadSummary(detail)"
        :height="260"
      />
      <div class="text-caption text-medium-emphasis mt-1">
        <template v-if="detail.accuracy">
          По модулю расхождение {{ num(detail.accuracy.mean_abs_pct) }} %.
        </template>
        <template v-else-if="!Object.keys(detail.sensors).length">
          На выходе источника нет датчиков расхода и температуры — факт не сравнивается.
        </template>
        Расход и температуры: {{ sensorText }}.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LineChart } from 'echarts/charts';
import { LegendComponent, MarkLineComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { computed, onMounted, ref } from 'vue';
import ChartFrame from '~/components/ChartFrame.vue';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import {
  loadOption,
  loadSummary,
  temperatureOption,
  weatherText,
  type ForecastDetail,
  type ForecastOverview,
} from '~/utils/loadForecast';

use([LineChart, MarkLineComponent, LegendComponent]);

/**
 * Прогноз нагрузки источников по погоде (фаза 3): сводка на сутки по источникам, по выбранному — температура
 * воздуха и нагрузка по часам (прошлые часы — по фактической погоде, против датчиков), расчёт на Tн прогноза.
 */
const authStore = useAuthStore();
const notify = useNotificationStore();

const overview = ref<ForecastOverview | null>(null);
const detail = ref<ForecastDetail | null>(null);
const selectedId = ref<number | null>(null);
const loading = ref(false);
const detailLoading = ref(false);
const refreshing = ref(false);
const importing = ref(false);
const calcRunning = ref(false);
const errorMessage = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const general = computed(() => authStore.permissions.general as string[]);
const canImport = computed(() => authStore.canEditData && general.value.includes('journals'));
const tempOption = computed(() => (detail.value ? temperatureOption(detail.value.points, detail.value.now) : {}));
const loadChart = computed(() => (detail.value ? loadOption(detail.value.points, detail.value.now) : {}));
const tempSummary = computed(() => {
  const n = detail.value?.next;
  return n?.hours ? `Ближайшие сутки: от ${num(n.t_min)} до ${num(n.t_max)} °C` : 'Прогноза погоды нет';
});
const SENSOR_LABELS: Record<string, string> = { g1: 'расход подачи', g2: 'расход обратки', t1: 't подачи', t2: 't обратки' };
const sensorText = computed(() => {
  const s = detail.value?.sensors ?? {};
  const parts = Object.entries(SENSOR_LABELS).map(([k, label]) => `${label} — ${s[k]?.join(', ') || 'нет'}`);
  return parts.join('; ');
});

const num = (v: number | null | undefined, digits = 1) =>
  v == null ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: digits });

const loadDetail = async (id: number) => {
  detailLoading.value = true;
  try {
    detail.value = await fastApiService.getSourceForecast(id);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Прогноз источника не загружен');
  } finally {
    detailLoading.value = false;
  }
};

const load = async () => {
  loading.value = true;
  try {
    overview.value = await fastApiService.getLoadForecast();
    const first = overview.value.sources[0];
    if (selectedId.value == null && first) selectedId.value = first.id;
    if (selectedId.value != null) await loadDetail(selectedId.value);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Прогноз нагрузки не загружен');
  } finally {
    loading.value = false;
  }
};

const select = (id: number) => {
  selectedId.value = id;
  void loadDetail(id);
};

const refreshWeather = async () => {
  refreshing.value = true;
  try {
    const state = await fastApiService.refreshWeather();
    if (state.error) errorMessage.value = state.error;
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Погода не обновилась');
  } finally {
    refreshing.value = false;
  }
};

const onFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  importing.value = true;
  try {
    const res = await fastApiService.importWeather(file, 'forecast');
    notify.showSuccess(`Прогноз погоды: записано часов ${res.stored}`);
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Файл прогноза не загружен');
  } finally {
    importing.value = false;
  }
};

const runCalc = async () => {
  const d = detail.value;
  if (!d || d.next.tn_calc == null) return;
  calcRunning.value = true;
  try {
    await fastApiService.runSetyMode({
      mode: 'plan', fragment_ids: [d.fileid], tn: d.next.tn_calc,
      name: `Прогноз ${new Date().toLocaleDateString('ru-RU')} на ${d.next.tn_calc} °C`,
    });
    notify.showSuccess(`Расчёт фрагмента на ${d.next.tn_calc} °C поставлен в очередь`);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Расчёт не запущен');
  } finally {
    calcRunning.value = false;
  }
};

onMounted(() => void load());
</script>

<style scoped>
.lf-table { font-size: var(--text-sm, 0.8125rem); }
.lf-row { cursor: pointer; }
.lf-row--active { background: rgba(var(--v-theme-primary), 0.08); }
</style>
