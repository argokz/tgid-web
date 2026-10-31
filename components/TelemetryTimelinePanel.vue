<template>
  <div class="tl">
    <div class="d-flex align-center flex-wrap ga-2">
      <div class="text-subtitle-2">
        Шкала времени на карте
      </div>
      <v-select
        v-model="hours"
        :items="PERIODS"
        density="compact"
        hide-details
        variant="outlined"
        class="tl-period"
        aria-label="Период шкалы"
      />
      <v-btn
        size="small"
        variant="tonal"
        :loading="loading"
        @click="load"
      >
        {{ data ? 'Обновить' : 'Загрузить' }}
      </v-btn>
      <v-spacer />
      <v-btn
        v-if="data"
        size="small"
        variant="text"
        :icon="playing ? 'mdi-pause' : 'mdi-play'"
        :aria-label="playing ? 'Пауза' : 'Проиграть'"
        @click="toggle"
      />
      <span
        v-if="data"
        class="text-body-2 text-no-wrap"
      >{{ frameTime }}</span>
    </div>
    <v-slider
      v-if="data && data.buckets.length"
      v-model="frame"
      :min="0"
      :max="data.buckets.length - 1"
      :step="1"
      hide-details
      density="compact"
      class="mt-1"
      aria-label="Момент времени"
    />
    <div
      v-if="data"
      class="d-flex flex-wrap ga-3 text-caption"
    >
      <span
        v-for="(n, st) in counts"
        :key="st"
      >
        <span
          class="tl-dot"
          :style="{ background: STATUS_META[st].color }"
        />{{ STATUS_META[st].label }}: {{ n }}
      </span>
      <span class="text-medium-emphasis">
        шаг {{ data.step_min }} мин · модель — последний расчёт фрагмента
      </span>
    </div>
    <p
      v-if="data && !data.sensors.length"
      class="text-body-2 text-medium-emphasis"
    >
      Нет действующих датчиков с местом на карте.
    </p>
    <v-alert
      v-if="errorMessage"
      type="error"
      density="compact"
      variant="tonal"
      class="mt-1"
    >
      {{ errorMessage }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import { STATUS_META, timelineCounts, timelineFrame, type TimelineResult } from '~/utils/telemetry';

/**
 * Шкала времени телеметрии: показания всех датчиков на карте за период, кадр за кадром — цвет точки по оценке
 * относительно модели, подпись со значением; проигрывание и ручной выбор момента.
 */
const emit = defineEmits<{ 'show-on-map': [data: GeoJSON.FeatureCollection] }>();

const PERIODS = [
  { title: 'Сутки', value: 24 },
  { title: '3 суток', value: 72 },
  { title: 'Неделя', value: 168 },
];
const FRAME_MS = 600;
const hours = ref(24);
const data = ref<TimelineResult | null>(null);
const frame = ref(0);
const playing = ref(false);
const loading = ref(false);
const errorMessage = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

const frameTime = computed(() => {
  const iso = data.value?.buckets[frame.value];
  return iso ? new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '';
});
const counts = computed(() => (data.value ? timelineCounts(data.value, frame.value) : {}));

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
  playing.value = false;
};

const load = async () => {
  stop();
  loading.value = true;
  errorMessage.value = '';
  try {
    const to = new Date();
    const from = new Date(to.getTime() - hours.value * 3600_000);
    data.value = await fastApiService.getTelemetryTimeline(from.toISOString(), to.toISOString());
    frame.value = Math.max(0, data.value.buckets.length - 1); // начать с последнего момента
    emit('show-on-map', timelineFrame(data.value, frame.value));
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Шкала времени не загрузилась');
  } finally {
    loading.value = false;
  }
};

const toggle = () => {
  if (playing.value) {
    stop();
    return;
  }
  const last = (data.value?.buckets.length ?? 1) - 1;
  if (frame.value >= last) frame.value = 0;
  playing.value = true;
  timer = setInterval(() => {
    if (frame.value >= last) {
      stop();
      return;
    }
    frame.value += 1;
  }, FRAME_MS);
};

watch(frame, (i) => {
  if (data.value) emit('show-on-map', timelineFrame(data.value, i));
});
watch(hours, () => {
  if (data.value) void load();
});
onBeforeUnmount(stop);
</script>

<style scoped>
.tl-period { max-width: 130px; }
.tl-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }
</style>
