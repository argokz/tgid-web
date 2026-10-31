<template>
  <v-dialog
    v-model="visible"
    :max-width="820"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-water-pump
        </v-icon>
        <span class="text-h6 flex-grow-1">Водопровод: расчёт сети</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <p class="text-body-2 mb-2">
          Модели водопровода EPANET и гидравлический расчёт отдельным движком (WNTR, EPANET 2.2): давление в узлах,
          расход и скорость в трубах по часам. Учебные сети в условных координатах размещаются схемой у центра города.
        </p>
        <v-alert
          v-if="status && !status.available"
          type="warning"
          density="compact"
          variant="tonal"
          class="mb-2"
        >
          Расчётный движок водопровода недоступен ({{ status.url }}) — модели видны, расчёт не запускается.
        </v-alert>
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

        <div
          v-if="canImport && library.length"
          class="d-flex align-center flex-wrap ga-2 mb-3"
        >
          <v-select
            v-model="libraryName"
            :items="library.map((l) => l.name)"
            label="Учебная сеть EPANET"
            density="compact"
            hide-details
            variant="outlined"
            class="wd-lib"
          />
          <v-btn
            size="small"
            variant="tonal"
            :loading="busy === 'import'"
            :disabled="!libraryName || !!busy"
            @click="importLibrary"
          >
            Загрузить
          </v-btn>
        </div>

        <v-progress-linear
          v-if="loading && !models.length"
          indeterminate
        />
        <p
          v-else-if="!models.length"
          class="text-body-2 text-medium-emphasis"
        >
          Моделей водопровода пока нет.
        </p>
        <v-table
          v-else
          density="compact"
          class="wd-table mb-3"
        >
          <thead>
            <tr>
              <th>Модель</th>
              <th class="text-right">
                Узлы / участки
              </th>
              <th>Размещение</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in models"
              :key="m.id"
              :class="{ 'wd-row--active': m.id === selectedId }"
              class="wd-row"
              tabindex="0"
              @click="select(m)"
              @keydown.enter="select(m)"
            >
              <td>
                {{ m.name }}
                <div class="text-caption text-medium-emphasis">
                  {{ m.source }} · расчётов {{ m.runs }}
                </div>
              </td>
              <td class="text-right">
                {{ m.summary.Nodes }} / {{ m.summary.Links }}
              </td>
              <td class="text-caption">
                {{ m.placement.mode === 'srid' ? `СК ${m.placement.srid}` : `схема ~${((m.placement.extent_m ?? 0) / 1000).toLocaleString('ru-RU')} км` }}
              </td>
              <td class="text-right text-no-wrap">
                <v-btn
                  v-if="canImport"
                  size="x-small"
                  variant="text"
                  icon="mdi-delete-outline"
                  :aria-label="`Удалить модель ${m.name}`"
                  @click.stop="remove(m)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>

        <template v-if="selected">
          <div class="d-flex align-center flex-wrap ga-2 mb-2">
            <div class="text-subtitle-2">
              {{ selected.name }}
            </div>
            <v-spacer />
            <v-btn
              v-if="authStore.canCalculate"
              size="small"
              color="primary"
              variant="flat"
              :loading="busy === 'run'"
              :disabled="!!busy || !status?.available"
              @click="runModel"
            >
              Рассчитать сутки
            </v-btn>
          </div>
          <template v-if="run">
            <div class="d-flex flex-wrap ga-4 text-body-2 mb-1">
              <span>Давление: {{ num(run.summary.min_pressure_m) }}…{{ num(run.summary.max_pressure_m) }} м</span>
              <span>Скорость до {{ num(run.summary.max_velocity_ms) }} м/с</span>
              <span :style="{ color: PRESSURE_META.low.color }">ниже 10 м: {{ run.summary.low_pressure_nodes.length }} узл.</span>
              <span
                v-if="run.summary.negative_pressure_nodes.length"
                :style="{ color: PRESSURE_META.negative.color }"
              >отрицательное: {{ run.summary.negative_pressure_nodes.length }}</span>
              <span>скорость &gt; 2 м/с: {{ run.summary.high_velocity_pipes.length }} тр.</span>
            </div>
            <div class="d-flex align-center ga-2">
              <v-btn
                size="small"
                variant="text"
                :icon="playing ? 'mdi-pause' : 'mdi-play'"
                :aria-label="playing ? 'Пауза' : 'Проиграть'"
                @click="toggle"
              />
              <v-slider
                v-model="step"
                :min="0"
                :max="Math.max(0, run.steps - 1)"
                :step="1"
                hide-details
                density="compact"
                aria-label="Шаг расчёта"
              />
              <span class="text-body-2 text-no-wrap">{{ stepLabel }}</span>
            </div>
            <div class="d-flex flex-wrap ga-3 text-caption mt-1">
              <span
                v-for="(meta, key) in legendPressure"
                :key="key"
              ><span
                class="wd-dot"
                :style="{ background: meta.color }"
              />{{ meta.label }}</span>
              <span
                v-for="c in VELOCITY_CLASSES"
                :key="c.label"
              ><span
                class="wd-line"
                :style="{ background: c.color }"
              />{{ c.label }}</span>
            </div>
          </template>
          <p
            v-else
            class="text-body-2 text-medium-emphasis"
          >
            Расчётов модели ещё нет — сеть на карте без значений.
          </p>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { confirmAction } from '~/composables/useConfirm';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { formatApiError } from '~/utils/apiError';
import {
  PRESSURE_META,
  stepTime,
  VELOCITY_CLASSES,
  waterFrame,
  type WaterModel,
  type WaterRun,
  type WaterStatus,
  type WaterStep,
} from '~/utils/water';

/**
 * Водопровод (фаза 4): модели EPANET, загрузка учебных сетей, гидравлический расчёт отдельным движком,
 * сеть на карте — узлы по давлению, трубы по скорости, перемотка по часам расчёта.
 */
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
}>();
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { isMobile } = useMobile();
const authStore = useAuthStore();

const FRAME_MS = 700;
const status = ref<WaterStatus | null>(null);
const library = ref<{ name: string; file: string }[]>([]);
const libraryName = ref<string | null>('Net3');
const models = ref<WaterModel[]>([]);
const selectedId = ref<number | null>(null);
const run = ref<WaterRun | null>(null);
const network = ref<GeoJSON.FeatureCollection | null>(null);
const stepData = ref<WaterStep | null>(null);
const step = ref(0);
const playing = ref(false);
const loading = ref(false);
const busy = ref<'' | 'import' | 'run'>('');
const errorMessage = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

const canImport = computed(() => authStore.canEditData && (authStore.permissions.general as string[]).includes('refs'));
const selected = computed(() => models.value.find((m) => m.id === selectedId.value) ?? null);
const stepLabel = computed(() => (stepData.value ? stepTime(stepData.value.time_s) : ''));
const legendPressure = computed(() => {
  const { negative, low, ok, source } = PRESSURE_META;
  return { negative, low, ok, source };
});
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: 1 }));

const showFrame = () => {
  if (!network.value) return;
  emit('show-on-map', waterFrame(network.value, stepData.value));
  overlay.markShown();
};

const loadStep = async () => {
  if (!selected.value || !run.value) return;
  try {
    stepData.value = await fastApiService.getWaterStep(selected.value.id, run.value.id, step.value);
    showFrame();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Шаг расчёта не загрузился');
  }
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
  playing.value = false;
};

const select = async (m: WaterModel) => {
  stop();
  errorMessage.value = '';
  selectedId.value = m.id;
  run.value = null;
  stepData.value = null;
  step.value = 0;
  try {
    const [net, runs] = await Promise.all([fastApiService.getWaterNetwork(m.id), fastApiService.getWaterRuns(m.id)]);
    network.value = net;
    run.value = runs[0] ?? null;
    if (run.value) await loadStep();
    else showFrame();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Модель не загрузилась');
  }
};

const load = async () => {
  loading.value = true;
  try {
    const [st, list] = await Promise.all([fastApiService.getWaterStatus(), fastApiService.getWaterModels()]);
    status.value = st;
    models.value = list;
    if (st.available && !library.value.length) library.value = await fastApiService.getWaterLibrary();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Модели водопровода не загрузились');
  } finally {
    loading.value = false;
  }
};

const importLibrary = async () => {
  if (!libraryName.value) return;
  busy.value = 'import';
  try {
    const res = await fastApiService.importWaterLibrary(libraryName.value);
    await load();
    const m = models.value.find((x) => x.id === res.id);
    if (m) await select(m);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Модель не загружена');
  } finally {
    busy.value = '';
  }
};

const runModel = async () => {
  if (!selected.value) return;
  busy.value = 'run';
  try {
    await fastApiService.runWaterModel(selected.value.id);
    const m = selected.value;
    await load();
    await select(models.value.find((x) => x.id === m.id) ?? m);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Расчёт не выполнен');
  } finally {
    busy.value = '';
  }
};

const remove = async (m: WaterModel) => {
  if (!(await confirmAction({ text: `Удалить модель «${m.name}» с сетью и расчётами?`, action: 'Удалить', color: 'error' }))) return;
  try {
    await fastApiService.deleteWaterModel(m.id);
    if (selectedId.value === m.id) {
      selectedId.value = null;
      network.value = null;
      emit('clear-highlight');
    }
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Модель не удалена');
  }
};

const toggle = () => {
  if (playing.value) {
    stop();
    return;
  }
  const last = (run.value?.steps ?? 1) - 1;
  if (step.value >= last) step.value = 0;
  playing.value = true;
  timer = setInterval(() => {
    if (step.value >= last) stop();
    else step.value += 1;
  }, FRAME_MS);
};

watch(step, () => void loadStep());
watch(visible, (v) => {
  if (v) void load();
  else stop();
}, { immediate: true });
onBeforeUnmount(stop);

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.wd-lib { max-width: 220px; }
.wd-table { font-size: var(--text-sm, 0.8125rem); }
.wd-row { cursor: pointer; }
.wd-row--active { background: rgba(var(--v-theme-primary), 0.08); }
.wd-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }
.wd-line { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
</style>
