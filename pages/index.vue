<template>
  <div class="index-page">
    <MapViewer
      :initial-layers="layers"
      :layers-loading="pending"
      :layers-error="Boolean(error)"
      @retry-layers="refresh"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import type { LayerConfig } from '~/types';
import { markPerf, measurePerf } from '~/utils/perf';

markPerf('page:index:asyncData:start');

const { data: layersData, pending, error, refresh } = await useAsyncData('geoServerLayers', () =>
  $fetch<LayerConfig[]>('/api/geoserver-layers'),
  { lazy: true }
);
const layers = computed<LayerConfig[]>(() => layersData.value ?? []);

watch(pending, (isPending: boolean) => {
  if (!isPending) {
    markPerf('page:index:asyncData:end');
    measurePerf('page:index:asyncData', 'page:index:asyncData:start', 'page:index:asyncData:end');
  }
}, { immediate: true });
</script>

<style scoped>
.index-page {
  width: 100%;
  box-sizing: border-box;
  min-height: calc(100svh - 56px);
  /* Явная высота — дочерний MapViewer (height: 100%) с первого кадра без «схлопывания» */
  height: calc(100svh - 56px);
}
</style>