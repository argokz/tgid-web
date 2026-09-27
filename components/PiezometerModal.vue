<template>
  <v-dialog :model-value="modelValue" max-width="1240" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title>Пьезометрический график</v-toolbar-title>
        <v-spacer />
        <span v-if="!loading && !error && totalLength" class="text-caption me-3">
          Длина маршрута: {{ formatLength(totalLength) }} · узлов: {{ pathData.length }}
        </span>
        <v-btn
          v-if="!loading && !error && pathData.length"
          icon
          size="small"
          aria-label="Выгрузить CSV"
          @click="exportCsv"
        >
          <v-icon>mdi-download</v-icon>
          <v-tooltip activator="parent" location="bottom">Выгрузить CSV</v-tooltip>
        </v-btn>
        <v-btn
          v-if="!loading && !error && pathData.length"
          icon
          size="small"
          aria-label="Выгрузить в Excel (p_excel)"
          :loading="exportingExcel"
          @click="exportExcel"
        >
          <v-icon>mdi-file-excel</v-icon>
          <v-tooltip activator="parent" location="bottom">Скачать официальный профиль (Excel)</v-tooltip>
        </v-btn>
        <v-btn icon size="small" aria-label="Закрыть" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text class="pa-0">
        <div v-if="loading" class="d-flex justify-center align-center py-10">
          <v-progress-circular indeterminate color="primary" />
          <span class="ml-3">Построение пути и графика…</span>
        </div>

        <div v-else-if="error" class="d-flex justify-center align-center py-10 text-error">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          {{ error }}
        </div>

        <template v-else>
          <v-alert
            v-if="!hasCalculation"
            type="info"
            variant="tonal"
            density="compact"
            class="ma-3"
          >
            Расчётные напоры для этого маршрута отсутствуют — показан профиль рельефа (Z).
            Напоры и температуры появятся после выполнения гидравлического расчёта сети.
          </v-alert>

          <v-tabs v-model="tab" density="compact" color="primary">
            <v-tab value="chart">График</v-tab>
            <v-tab value="table">Таблица узлов</v-tab>
            <v-tab value="time">Время прохождения</v-tab>
          </v-tabs>
          <v-divider />

          <v-window v-model="tab">
            <v-window-item value="chart">
              <div style="height: 560px; width: 100%;">
                <v-chart class="chart" :option="chartOptions" autoresize @click="onChartClick" />
              </div>
            </v-window-item>

            <v-window-item value="table">
              <div style="max-height: 560px; overflow-y: auto;">
                <v-table density="compact" class="piezo-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Узел</th>
                      <th class="text-right">L, м</th>
                      <th class="text-right">Z, м</th>
                      <th class="text-right">H под., м</th>
                      <th class="text-right">H обр., м</th>
                      <th class="text-right">t под., °C</th>
                      <th class="text-right">t обр., °C</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(node, idx) in pathData"
                      :key="node.node_id"
                      class="piezo-row"
                      @click="$emit('node-hover', node.node_id)"
                    >
                      <td>{{ idx + 1 }}</td>
                      <td>{{ node.label || node.node_id }}</td>
                      <td class="text-right">{{ fmt(node.distance) }}</td>
                      <td class="text-right">{{ fmt(node.z) }}</td>
                      <td class="text-right">{{ fmt(node.h_pod) }}</td>
                      <td class="text-right">{{ fmt(node.h_obr) }}</td>
                      <td class="text-right">{{ fmt(node.t_pod) }}</td>
                      <td class="text-right">{{ fmt(node.t_obr) }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </v-window-item>

            <v-window-item value="time">
              <div class="pa-3">
                <div v-if="travelLoading" class="d-flex align-center py-6 justify-center">
                  <v-progress-circular indeterminate color="primary" size="24" />
                  <span class="ml-3">Расчёт времени прохождения…</span>
                </div>
                <v-alert v-else-if="travelError" type="error" variant="tonal" density="compact">
                  {{ travelError }}
                </v-alert>
                <template v-else-if="travel">
                  <div class="d-flex flex-wrap ga-4 mb-2">
                    <div>
                      <div class="text-caption text-medium-emphasis">Подающий теплопровод</div>
                      <div class="text-subtitle-1" :class="{ 'text-error': travel.supply.no_flow }">
                        {{ travel.supply.text }}
                      </div>
                    </div>
                    <div>
                      <div class="text-caption text-medium-emphasis">Обратный теплопровод</div>
                      <div class="text-subtitle-1" :class="{ 'text-error': travel.return.no_flow }">
                        {{ travel.return.text }}
                      </div>
                    </div>
                  </div>
                  <p class="text-caption text-medium-emphasis mb-2">
                    Как в десктопе («Время прохождения»): время участков (ut_out a11) суммируется по маршруту
                    со знаком ориентации линии; расход против принятого направления — «нет движения».
                    <template v-if="travel.calculation_ids.length"> Расчёт: {{ travel.calculation_ids.join(', ') }}.</template>
                  </p>
                  <v-alert v-if="travel.note" type="warning" variant="tonal" density="compact" class="mb-2">
                    {{ travel.note }}. Простая сумма времени участков:
                    подача {{ fmt(travel.supply.sum_segments_min) }} мин, обратка {{ fmt(travel.return.sum_segments_min) }} мин.
                  </v-alert>
                  <div style="max-height: 440px; overflow-y: auto;">
                    <v-table density="compact" class="piezo-table">
                      <thead>
                        <tr>
                          <th rowspan="2">#</th>
                          <th rowspan="2">Участок</th>
                          <th rowspan="2" class="text-right">L, м</th>
                          <th colspan="3" class="text-center">Подача</th>
                          <th colspan="3" class="text-center">Обратка</th>
                        </tr>
                        <tr>
                          <th class="text-right">G, т/ч</th>
                          <th class="text-right">t, мин</th>
                          <th class="text-right">Σt, мин</th>
                          <th class="text-right">G, т/ч</th>
                          <th class="text-right">t, мин</th>
                          <th class="text-right">Σt, мин</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in travel.items"
                          :key="row.index"
                          class="piezo-row"
                          @click="$emit('node-hover', row.node2_id)"
                        >
                          <td>{{ row.index }}</td>
                          <td>{{ row.node1_label }} → {{ row.node2_label }}</td>
                          <td class="text-right">{{ fmt(row.supply?.length_m ?? row.return?.length_m) }}</td>
                          <td class="text-right">{{ fmt(row.supply?.q) }}</td>
                          <td class="text-right">{{ fmt(row.supply?.time_min) }}</td>
                          <td class="text-right">{{ cumText(row.supply) }}</td>
                          <td class="text-right">{{ fmt(row.return?.q) }}</td>
                          <td class="text-right">{{ fmt(row.return?.time_min) }}</td>
                          <td class="text-right">{{ cumText(row.return) }}</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </div>
                </template>
              </div>
            </v-window-item>
          </v-window>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notificationStore';
import { computed, ref, watch } from 'vue';
import { fastApiService, type TravelTimeResponse, type TravelTimeSide } from '~/services/fastApiService';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
]);

const props = defineProps<{
  modelValue: boolean;
  pathData: any[];
  loading: boolean;
  error: string | null;
  hasCalculation?: boolean;
  totalLength?: number;
  /** Точки, выбранные пользователем: сервер строит по ним тот же маршрут */
  waypoints?: number[];
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  'node-hover': [number];
}>();

const tab = ref<'chart' | 'table' | 'time'>('chart');

// Время прохождения потока (десктоп OnTimePr) — считается по требованию при открытии вкладки
const travel = ref<TravelTimeResponse | null>(null);
const travelLoading = ref(false);
const travelError = ref<string | null>(null);

const routeWaypoints = (): number[] => {
  if (props.waypoints && props.waypoints.length >= 2) return props.waypoints;
  const ids = (props.pathData || []).map((d: any) => d.node_id);
  return ids.length >= 2 ? [ids[0], ids[ids.length - 1]] : [];
};

const loadTravelTime = async () => {
  const nodes = routeWaypoints();
  if (nodes.length < 2 || travelLoading.value) return;
  travelLoading.value = true;
  travelError.value = null;
  try {
    travel.value = await fastApiService.getTravelTime(nodes);
  } catch (err: any) {
    travelError.value = err?.message || 'Ошибка расчёта времени прохождения';
  } finally {
    travelLoading.value = false;
  }
};

watch(
  () => [props.waypoints, props.pathData],
  () => {
    travel.value = null;
    travelError.value = null;
    if (tab.value === 'time' && props.modelValue) loadTravelTime();
  }
);
watch(tab, (t) => {
  if (t === 'time' && !travel.value) loadTravelTime();
});

const cumText = (side: TravelTimeSide | null | undefined): string => {
  if (!side) return '—';
  return side.cumulative_min == null ? 'нет движения' : side.cumulative_min.toFixed(2);
};

const fmt = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(2);

const formatLength = (m: number): string =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} км` : `${m.toFixed(0)} м`;

/** Есть ли хоть у одного узла заданные температуры — тогда показываем оси/кривые t */
const hasTemperatures = computed(() =>
  props.pathData?.some((d) => d.t_pod != null || d.t_obr != null)
);

const chartOptions = computed(() => {
  if (!props.pathData || props.pathData.length === 0) return {};

  const distances = props.pathData.map((d) => Math.round(d.distance));
  const zData = props.pathData.map((d) => d.z);
  const hPodData = props.pathData.map((d) => d.h_pod);
  const hObrData = props.pathData.map((d) => d.h_obr);
  const tPodData = props.pathData.map((d) => d.t_pod);
  const tObrData = props.pathData.map((d) => d.t_obr);
  const labels = props.pathData.map((d) => d.label || String(d.node_id));

  const legendData = ['Напор в подающем (H под)', 'Напор в обратном (H обр)', 'Рельеф (Z)'];
  if (hasTemperatures.value) legendData.push('t подающий', 't обратный');

  const series: any[] = [
    {
      name: 'Напор в подающем (H под)',
      type: 'line',
      data: hPodData,
      connectNulls: true,
      itemStyle: { color: '#E53935' },
      lineStyle: { width: 2 },
      symbol: 'circle',
      symbolSize: 6,
    },
    {
      name: 'Напор в обратном (H обр)',
      type: 'line',
      data: hObrData,
      connectNulls: true,
      itemStyle: { color: '#1E88E5' },
      lineStyle: { width: 2 },
      symbol: 'circle',
      symbolSize: 6,
    },
    {
      name: 'Рельеф (Z)',
      type: 'line',
      data: zData,
      itemStyle: { color: '#8D6E63' },
      lineStyle: { width: 2 },
      areaStyle: { color: '#D7CCC8', opacity: 0.5 },
      symbol: 'none',
    },
  ];

  if (hasTemperatures.value) {
    series.push(
      {
        name: 't подающий',
        type: 'line',
        yAxisIndex: 1,
        data: tPodData,
        connectNulls: true,
        itemStyle: { color: '#FB8C00' },
        lineStyle: { width: 1.5, type: 'dashed' },
        symbol: 'none',
      },
      {
        name: 't обратный',
        type: 'line',
        yAxisIndex: 1,
        data: tObrData,
        connectNulls: true,
        itemStyle: { color: '#00ACC1' },
        lineStyle: { width: 1.5, type: 'dashed' },
        symbol: 'none',
      }
    );
  }

  const yAxis: any[] = [{ type: 'value', name: 'H, м', scale: true }];
  if (hasTemperatures.value) {
    yAxis.push({ type: 'value', name: 't, °C', scale: true, position: 'right' });
  }

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0].dataIndex;
        let res = `<b>${labels[idx]}</b><br/>Расстояние: ${params[0].axisValue} м<br/>`;
        params.forEach((item: any) => {
          const value = typeof item.data === 'number' ? item.data.toFixed(2) : '—';
          res += `${item.marker} ${item.seriesName}: <b>${value}</b><br/>`;
        });
        return res;
      },
    },
    legend: { data: legendData },
    grid: { left: '3%', right: hasTemperatures.value ? '6%' : '4%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: distances,
      name: 'L, м',
      nameLocation: 'middle',
      nameGap: 30,
    },
    yAxis,
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, filterMode: 'none' },
    ],
    series,
  };
});

const onChartClick = (params: any) => {
  if (params && params.dataIndex !== undefined) {
    const node = props.pathData[params.dataIndex];
    if (node) emit('node-hover', node.node_id);
  }
};

const exportCsv = () => {
  const header = ['#', 'node_id', 'label', 'L_m', 'Z_m', 'H_pod_m', 'H_obr_m', 't_pod_C', 't_obr_C'];
  const rows = props.pathData.map((d, i) => [
    i + 1, d.node_id, `"${(d.label || '').replace(/"/g, '""')}"`,
    d.distance ?? '', d.z ?? '', d.h_pod ?? '', d.h_obr ?? '', d.t_pod ?? '', d.t_obr ?? '',
  ]);
  const csv = '﻿' + [header, ...rows].map((r) => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `piezometer-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportingExcel = ref(false);

const exportExcel = async () => {
  if (!props.pathData.length) return;
  exportingExcel.value = true;
  try {
    // Все узлы пути как точки маршрута упираются в лимит сервера (200) на длинных трассах
    const waypoints = props.waypoints && props.waypoints.length >= 2
      ? props.waypoints
      : props.pathData.map((d: any) => d.node_id);
    const { blob, filename } = await fastApiService.downloadPiezometerExcel(waypoints);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `piezometer-${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    useNotificationStore().showError(`Экспорт Excel: ${err?.message || 'ошибка сервера'}`);
  } finally {
    exportingExcel.value = false;
  }
};
</script>

<style scoped>
.chart {
  height: 100%;
  width: 100%;
}
.piezo-row {
  cursor: pointer;
}
.piezo-row:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
</style>
