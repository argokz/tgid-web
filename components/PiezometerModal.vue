<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="1200">
    <v-card>
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title>Пьезометрический график</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card-text class="pa-0">
        <div v-if="loading" class="d-flex justify-center align-center py-10">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          <span class="ml-3">Построение пути и графика...</span>
        </div>
        <div v-else-if="error" class="d-flex justify-center align-center py-10 text-error">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          {{ error }}
        </div>
        <div v-else style="height: 600px; width: 100%;">
          <v-chart class="chart" :option="chartOptions" autoresize @click="onChartClick" />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent
} from 'echarts/components';
import VChart from 'vue-echarts';

// Регистрируем компоненты ECharts
use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent
]);

const props = defineProps<{
  modelValue: boolean;
  pathData: any[];
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  'node-hover': [number];
}>();

const chartOptions = computed(() => {
  if (!props.pathData || props.pathData.length === 0) return {};

  const distances = props.pathData.map(d => Math.round(d.distance));
  const zData = props.pathData.map(d => d.z);
  const hPodData = props.pathData.map(d => d.h_pod);
  const hObrData = props.pathData.map(d => d.h_obr);

  return {
    tooltip: {
      trigger: 'axis',
      formatter: function (params: any) {
        let res = `Расстояние: ${params[0].axisValue} м<br/>`;
        params.forEach((item: any) => {
          const value = typeof item.data === 'number' ? `${item.data.toFixed(2)} м` : 'нет данных';
          res += `${item.marker} ${item.seriesName}: <b>${value}</b><br/>`;
        });
        return res;
      }
    },
    legend: {
      data: ['Напор в подающем (H под)', 'Напор в обратном (H обр)', 'Рельеф (Z)']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: distances,
      name: 'L, м',
      nameLocation: 'middle',
      nameGap: 30
    },
    yAxis: {
      type: 'value',
      name: 'H, м',
      scale: true
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'filter'
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'filter'
      }
    ],
    series: [
      {
        name: 'Напор в подающем (H под)',
        type: 'line',
        data: hPodData,
        itemStyle: { color: '#E53935' }, // Red
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: 'Напор в обратном (H обр)',
        type: 'line',
        data: hObrData,
        itemStyle: { color: '#1E88E5' }, // Blue
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: 'Рельеф (Z)',
        type: 'line',
        data: zData,
        itemStyle: { color: '#8D6E63' }, // Brown
        lineStyle: { width: 2, type: 'solid' },
        areaStyle: {
          color: '#D7CCC8',
          opacity: 0.5
        },
        symbol: 'none'
      }
    ]
  };
});

const onChartClick = (params: any) => {
  if (params && params.dataIndex !== undefined) {
    const nodeData = props.pathData[params.dataIndex];
    if (nodeData) {
      emit('node-hover', nodeData.node_id);
    }
  }
};
</script>

<style scoped>
.chart {
  height: 100%;
  width: 100%;
}
</style>
