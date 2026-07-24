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
          </v-window>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  'node-hover': [number];
}>();

const tab = ref<'chart' | 'table'>('chart');

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
