<template>
  <div class="index-page">
    <MapViewer
      :initial-layers="layers"
      :layers-loading="pending"
      :layers-error="Boolean(error)"
      @retry-layers="refresh"
    />
    <!-- Экран загрузки: из серверного HTML до первого кадра карты (этап 8) -->
    <Transition name="index-splash">
      <AppSplash
        v-if="splashVisible"
        class="index-page__splash"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppSplash from '~/components/AppSplash.vue';
import { useMapStore } from '~/stores/mapStore';
import type { LayerConfig } from '~/types';
import { preloadJournalPrimitives } from '~/utils/journalPreload';
import { markPerf, measurePerf } from '~/utils/perf';

markPerf('page:index:asyncData:start');

const { data: layersData, pending, error, refresh } = await useAsyncData('geoServerLayers', () =>
  $fetch<LayerConfig[]>('/api/geoserver-layers'),
  { lazy: true }
);
const layers = computed<LayerConfig[]>(() => layersData.value ?? []);

/** Карта не дала кадра за это время (WebGL недоступен, стиль не грузится) — экран загрузки всё равно уходит:
 *  ошибку покажет сама карта, а экран не должен запирать приложение */
const SPLASH_MAX_MS = 20000;
const mapStore = useMapStore();
const splashTimedOut = ref(false);
// ошибка карты или слоёв — экран загрузки уходит сразу: под ним сообщение и «Повторить»
const splashVisible = computed(() => !mapStore.firstFrameShown && !mapStore.initFailed && !error.value && !splashTimedOut.value);
let splashTimer: ReturnType<typeof setTimeout> | null = null;
onMounted(() => {
  if (!mapStore.firstFrameShown) splashTimer = setTimeout(() => { splashTimedOut.value = true; }, SPLASH_MAX_MS);
});
onBeforeUnmount(() => {
  if (splashTimer) clearTimeout(splashTimer);
});

// после первого кадра карты — в простое подгрузить общие примитивы журналов (первое открытие журнала, S3b)
watch(() => mapStore.firstFrameShown, (shown) => {
  if (shown) void preloadJournalPrimitives();
}, { immediate: true });

watch(pending, (isPending: boolean) => {
  if (!isPending) {
    markPerf('page:index:asyncData:end');
    measurePerf('page:index:asyncData', 'page:index:asyncData:start', 'page:index:asyncData:end');
  }
}, { immediate: true });
</script>

<style scoped>
.index-page {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  min-height: calc(100svh - 56px);
  /* Явная высота — дочерний MapViewer (height: 100%) с первого кадра без «схлопывания» */
  height: calc(100svh - 56px);
}
.index-page__splash {
  position: absolute;
  inset: 0;
  z-index: var(--z-controls, 200);
  /* как у ожидания входа (layouts/default.vue, .login-required-backdrop) — переход без смены фона */
  background:
    radial-gradient(circle at 20% 20%, rgb(var(--v-theme-primary), 0.10), transparent 45%),
    radial-gradient(circle at 80% 85%, rgb(var(--v-theme-primary), 0.08), transparent 40%),
    rgb(var(--v-theme-surface));
}

.index-splash-leave-active {
  transition: opacity var(--duration-slow, 280ms) var(--ease-out, ease-out);
}

.index-splash-leave-to {
  opacity: 0;
}
</style>
