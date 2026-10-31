<template>
  <v-dialog
    v-model="visible"
    max-width="760"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <span>Места повторных отказов</span>
        <v-spacer />
        <v-select
          v-model="years"
          :items="YEARS"
          density="compact"
          hide-details
          variant="outlined"
          class="fh-years"
          aria-label="За сколько лет"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-2">
          Скопления порывов, свищей и утечек: три и больше в радиусе 30 м, в разные дни. Это кандидаты на перекладку
          участка; ближайший участок теплосети — с Ду и годом прокладки. «Переложен» — участок проложен уже после
          последнего отказа.
        </p>
        <v-progress-linear
          v-if="loading"
          indeterminate
        />
        <v-alert
          v-else-if="errorMessage"
          type="error"
          density="compact"
          variant="tonal"
        >
          {{ errorMessage }}
        </v-alert>
        <p
          v-else-if="result && !result.items.length"
          class="text-body-2 text-medium-emphasis"
        >
          За {{ result.years }} лет повторных отказов в одном месте нет.
        </p>
        <div
          v-for="(h, i) in result?.items ?? []"
          :key="h.defects.join('-')"
          class="fh-item py-2"
        >
          <div class="d-flex align-center ga-2">
            <span class="text-subtitle-2">{{ i + 1 }}. {{ hotspotText(h) }}</span>
            <v-chip
              v-if="h.replaced_after"
              size="x-small"
              color="success"
              variant="tonal"
            >
              переложен
            </v-chip>
            <v-spacer />
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-crosshairs-gps"
              :aria-label="`Скопление ${i + 1} на карте`"
              @click="emit('locate', { longitude: h.lon, latitude: h.lat, id: h.defects[0] })"
            />
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ h.first ? new Date(h.first).toLocaleDateString('ru-RU') : '—' }} —
            {{ h.last ? new Date(h.last).toLocaleDateString('ru-RU') : '—' }} · {{ hotspotLineText(h) }}
            <template v-if="h.line">
              (в {{ h.line.distance_m.toLocaleString('ru-RU') }} м)
            </template>
            · с участком в журнале: {{ h.linked_in_journal }} из {{ h.count }}
          </div>
          <div class="d-flex flex-wrap ga-1 mt-1">
            <v-chip
              v-for="id in h.defects"
              :key="id"
              size="x-small"
              variant="outlined"
              @click="emit('open', id)"
            >
              № {{ id }}
            </v-chip>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { formatApiError } from '~/utils/apiError';
import { hotspotLineText, hotspotText, type HotspotResult } from '~/utils/defectSimilarity';

/** Места повторных отказов по журналу нарушений: скопления аварий за годы, участок рядом, переход и карта. */
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  open: [id: number];
  locate: [coordinates: { longitude: number; latitude: number; id: number }];
}>();

const YEARS = [
  { title: '2 года', value: 2 },
  { title: '5 лет', value: 5 },
  { title: '10 лет', value: 10 },
];
const years = ref(5);
const result = ref<HotspotResult | null>(null);
const loading = ref(false);
const errorMessage = ref('');

const load = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    result.value = await fastApiService.getFailureHotspots(years.value);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Места повторных отказов не загружены');
  } finally {
    loading.value = false;
  }
};

watch(visible, (v) => {
  if (v) void load();
});
watch(years, () => void load());
</script>

<style scoped>
.fh-years { max-width: 120px; }
.fh-item { border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
</style>
