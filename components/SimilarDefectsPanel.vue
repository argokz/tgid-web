<template>
  <div class="sd">
    <div class="d-flex align-center ga-2">
      <div class="text-subtitle-2">
        Похожие аварии рядом
      </div>
      <v-spacer />
      <v-select
        v-model="radius"
        :items="RADII"
        density="compact"
        hide-details
        variant="outlined"
        class="sd-radius"
        aria-label="Радиус поиска"
      />
      <v-btn
        size="small"
        variant="tonal"
        :loading="loading && !aiMode"
        :disabled="loading"
        @click="load(false)"
      >
        {{ result ? 'Обновить' : 'Найти' }}
      </v-btn>
      <v-btn
        v-if="authStore.canUseAi"
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-robot-outline"
        :loading="loading && aiMode"
        :disabled="loading"
        @click="load(true)"
      >
        Уточнить с ИИ
      </v-btn>
    </div>
    <div
      v-if="result?.ranking === 'ai'"
      class="text-caption mt-1"
    >
      Порядок — по оценке ИИ: модель прочитала тексты (ФИО и номера скрыты) и объяснила сходство.
    </div>
    <v-alert
      v-else-if="result?.ai_error"
      type="info"
      density="compact"
      variant="tonal"
      class="mt-2"
    >
      ИИ не ответил ({{ result.ai_error }}) — порядок по признакам.
    </v-alert>
    <div
      v-if="result"
      class="text-caption text-medium-emphasis mt-1"
    >
      В тексте: {{ featuresText(result.reference) }}. Сходство — вид повреждения (порыв, свищ и утечка — одно
      семейство), труба, Ду, расстояние, общие слова; просмотрено {{ result.candidates }}.
    </div>
    <v-alert
      v-if="errorMessage"
      type="error"
      density="compact"
      variant="tonal"
      class="mt-2"
    >
      {{ errorMessage }}
    </v-alert>
    <p
      v-else-if="result && !result.items.length"
      class="text-body-2 text-medium-emphasis mt-2"
    >
      Похожих нарушений в радиусе {{ radiusText }} нет.
    </p>
    <div
      v-for="item in result?.items ?? []"
      :key="item.id"
      class="sd-item mt-2"
    >
      <div class="d-flex align-center ga-2">
        <v-progress-linear
          :model-value="item.ai_relevance ?? scorePct(item.score)"
          height="6"
          rounded
          class="sd-bar"
          :aria-label="`Сходство ${item.ai_relevance ?? scorePct(item.score)} %`"
        />
        <span class="text-caption text-no-wrap">{{ item.ai_relevance ?? scorePct(item.score) }} %</span>
        <span class="text-caption text-medium-emphasis text-no-wrap">
          {{ item.detected_at ? new Date(item.detected_at).toLocaleDateString('ru-RU') : 'без даты' }}
        </span>
        <v-spacer />
        <v-btn
          size="x-small"
          variant="text"
          @click="emit('open', item.id)"
        >
          Открыть
        </v-btn>
        <v-btn
          v-if="item.lon != null && item.lat != null"
          size="x-small"
          variant="text"
          icon="mdi-crosshairs-gps"
          :aria-label="`Нарушение ${item.id} на карте`"
          @click="emit('locate', { longitude: item.lon!, latitude: item.lat!, id: item.id })"
        />
      </div>
      <div class="text-body-2 sd-text">
        {{ item.text }}
      </div>
      <div
        v-if="item.ai_reason"
        class="text-caption"
      >
        ИИ: {{ item.ai_reason }}
      </div>
      <div class="text-caption text-medium-emphasis">
        {{ item.reasons.join(' · ') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { formatApiError } from '~/utils/apiError';
import { featuresText, scorePct, type SimilarResult } from '~/utils/defectSimilarity';

/** Похожие на выбранное нарушение аварии рядом (журнал нарушений): загрузка по кнопке, переход и показ на карте. */
const props = defineProps<{ defectId: number }>();
const emit = defineEmits<{
  open: [id: number];
  locate: [coordinates: { longitude: number; latitude: number; id: number }];
}>();

const RADII = [
  { title: '300 м', value: 300 },
  { title: '1 км', value: 1000 },
  { title: '3 км', value: 3000 },
  { title: '10 км', value: 10000 },
];
const authStore = useAuthStore();
const radius = ref(1000);
const aiMode = ref(false);
const result = ref<SimilarResult | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const radiusText = computed(() => RADII.find((r) => r.value === radius.value)?.title ?? `${radius.value} м`);

const load = async (ai = aiMode.value) => {
  aiMode.value = ai;
  loading.value = true;
  errorMessage.value = '';
  try {
    result.value = ai
      ? await fastApiService.getSimilarDefectsAi(props.defectId, radius.value)
      : await fastApiService.getSimilarDefects(props.defectId, radius.value);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Похожие аварии не найдены');
  } finally {
    loading.value = false;
  }
};

// другое нарушение — прежний список уже не про него
watch(() => props.defectId, () => {
  result.value = null;
  aiMode.value = false;
  errorMessage.value = '';
});
watch(radius, () => {
  if (result.value) void load();
});
</script>

<style scoped>
.sd-radius { max-width: 110px; }
.sd-bar { max-width: 90px; }
.sd-item { border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); padding-top: 6px; }
.sd-text { overflow-wrap: anywhere; }
</style>
