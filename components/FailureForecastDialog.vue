<template>
  <v-dialog
    v-model="visible"
    :max-width="900"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-alert-decagram-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Прогноз аварийности</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-tabs
        v-model="tab"
        density="compact"
        class="px-2"
      >
        <v-tab value="forecast">
          Прогноз
        </v-tab>
        <v-tab
          value="plan"
          :disabled="!run"
        >
          План перекладок
        </v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text
        v-show="tab === 'plan'"
        class="pa-4"
      >
        <RelayPlanPanel
          :run="run"
          :can-edit="canEditPrices"
          :can-export="canExport"
          :can-refresh="authStore.canCalculate && authStore.canEditData"
          @show="showFrame"
        />
      </v-card-text>
      <v-card-text
        v-show="tab === 'forecast'"
        class="pa-4"
      >
        <p class="text-body-2 mb-2">
          Вероятность повреждения участка в ближайшие {{ run?.horizon_years ?? 2 }} года — по журналу повреждений,
          возрасту, длине, диаметру, прокладке, глубине и повреждениям рядом. Модель проверяется на годах, которых не
          видела при обучении.
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
        <div class="d-flex align-center flex-wrap ga-2 mb-3">
          <v-btn
            v-if="authStore.canCalculate"
            size="small"
            color="primary"
            variant="flat"
            :loading="busy === 'run'"
            :disabled="!!busy"
            @click="calculate"
          >
            {{ run ? 'Пересчитать' : 'Рассчитать' }}
          </v-btn>
          <span
            v-if="busy === 'run'"
            class="text-caption text-medium-emphasis"
          >Обучение и проверка — до минуты.</span>
          <span
            v-else-if="run"
            class="text-caption text-medium-emphasis"
          >Расчёт №{{ run.id }} от {{ new Date(run.created_at).toLocaleString('ru-RU') }}, данные журнала по
            {{ run.cutoffs.now }}</span>
        </div>
        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-2"
        />

        <template v-if="run">
          <v-alert
            type="info"
            density="compact"
            variant="tonal"
            class="mb-2"
          >
            {{ validationText(run) }}
          </v-alert>
          <div class="text-caption text-medium-emphasis mb-3">
            Для сравнения: только история повреждений и длина — ROC-AUC {{ num(run.metrics.auc_history_only, 3) }};
            логистическая регрессия — {{ num(run.metrics.auc_logit, 3) }}; «повреждения в 200 м» —
            {{ num(run.metrics.baselines_auc.near200, 3) }}. {{ populationText }}
            Ожидается около {{ num(run.expected_events, 0) }} повреждений за {{ run.horizon_years }} года — при полноте
            журнала как в {{ run.cutoffs.final.slice(0, 4) }}–{{ Number(run.cutoffs.final.slice(0, 4)) + run.horizon_years - 1 }} гг.
            (модель училась на них).
          </div>

          <template v-if="captureRows(run.metrics).length">
            <div class="text-subtitle-2 mb-1">
              Если бы перекладывали по прогнозу
            </div>
            <p class="text-caption text-medium-emphasis mb-1">
              Доля повреждений {{ run.cutoffs.test.slice(0, 4) }}–{{ Number(run.cutoffs.test.slice(0, 4)) + run.horizon_years - 1 }} гг.
              на участках, переложенных первыми в пределах бюджета (сеть в расчёте — {{ num(run.metrics.length_km, 0) }} км).
            </p>
            <v-table
              density="compact"
              class="fd-table mb-3"
            >
              <thead>
                <tr>
                  <th>Переложить</th>
                  <th class="text-right">
                    По прогнозу
                  </th>
                  <th class="text-right">
                    Самые старые первыми
                  </th>
                  <th class="text-right">
                    Где рядом были повреждения
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in captureRows(run.metrics)"
                  :key="c.km"
                >
                  <td>{{ c.km }} км</td>
                  <td class="text-right font-weight-medium">
                    {{ pctText(c.model, 0) }}
                  </td>
                  <td class="text-right">
                    {{ pctText(c.oldest, 0) }}
                  </td>
                  <td class="text-right">
                    {{ pctText(c.near, 0) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <div class="text-subtitle-2 mb-1">
            Что влияет на прогноз
          </div>
          <div class="fd-imp mb-3">
            <template
              v-for="f in run.importance.slice(0, 8)"
              :key="f.feature"
            >
              <span class="text-body-2">{{ f.label }}</span>
              <div class="fd-bar-track">
                <div
                  class="fd-bar"
                  :style="{ width: `${Math.max(2, (f.share / maxShare) * 100)}%` }"
                />
              </div>
              <span class="text-body-2 text-right">{{ pctText(f.share, 0) }}</span>
            </template>
          </div>

          <div class="d-flex align-center flex-wrap ga-2 mb-1">
            <div class="text-subtitle-2">
              Участки с наибольшим риском
            </div>
            <v-spacer />
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-map"
              :disabled="!top"
              @click="showMap"
            >
              На карте
            </v-btn>
          </div>
          <div class="d-flex flex-wrap ga-3 text-caption mb-1">
            <span
              v-for="c in RISK_CLASSES"
              :key="c.label"
            ><span
              class="fd-line"
              :style="{ background: c.color }"
            />{{ c.label }}</span>
          </div>
          <v-table
            v-if="top?.items.length"
            density="compact"
            class="fd-table"
          >
            <thead>
              <tr>
                <th>Участок</th>
                <th>Фрагмент</th>
                <th class="text-right">
                  Ø, мм
                </th>
                <th class="text-right">
                  Возраст
                </th>
                <th class="text-right">
                  Повр. / рядом
                </th>
                <th class="text-right">
                  Вероятность
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(x, i) in top.items.slice(0, LIST_LIMIT)"
                :key="x.lineid"
              >
                <td>
                  <span
                    class="fd-line"
                    :style="{ background: riskClass(i, top.items.length).color }"
                  />{{ x.lineid }}
                  <div class="text-caption text-medium-emphasis">
                    {{ num(x.len_m, 0) }} м
                  </div>
                </td>
                <td class="text-caption">
                  {{ x.fragment || '—' }}
                </td>
                <td class="text-right">
                  {{ num(x.dn, 0) }}
                </td>
                <td class="text-right">
                  {{ x.age == null ? '—' : `${num(x.age, 0)} л.` }}
                </td>
                <td class="text-right">
                  {{ x.hist_all ?? 0 }} / {{ x.near200 ?? 0 }}
                </td>
                <td class="text-right">
                  {{ pctText(x.prob) }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <p class="text-caption text-medium-emphasis mt-1">
            «Повр. / рядом» — повреждений участка и в 200 м от него по журналу. На карте — {{ top?.items.length ?? 0 }}
            участков с наибольшим риском.
          </p>
        </template>
        <p
          v-else-if="!loading"
          class="text-body-2 text-medium-emphasis"
        >
          Расчётов прогноза ещё нет.
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { formatApiError } from '~/utils/apiError';
import RelayPlanPanel from '~/components/RelayPlanPanel.vue';
import {
  captureRows,
  pctText,
  RISK_CLASSES,
  riskClass,
  riskFrame,
  validationText,
  type FailureRun,
  type FailureTop,
} from '~/utils/failureForecast';

/**
 * Прогноз аварийности участков теплосети (фаза 5): расчёт модели, проверка по времени, вклад признаков,
 * участки с наибольшим риском — списком и на карте.
 */
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
}>();
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { isMobile } = useMobile();
const authStore = useAuthStore();

const LIST_LIMIT = 30;
const tab = ref<'forecast' | 'plan'>('forecast');
const canEditPrices = computed(() => authStore.canEditData
  && (authStore.permissions.general as string[]).includes('refs'));
const canExport = computed(() => (authStore.permissions.general as string[]).includes('export'));
const TOP_ON_MAP = 200;
const run = ref<FailureRun | null>(null);
const top = ref<FailureTop | null>(null);
const loading = ref(false);
const busy = ref<'' | 'run'>('');
const errorMessage = ref('');

const maxShare = computed(() => Math.max(...(run.value?.importance.map((f) => f.share) ?? [1]), 1e-9));
/** Кто вошёл в расчёт: участки с заполненным паспортом — журнал ведётся по ним (иначе модель училась бы «в журнале или нет») */
const populationText = computed(() => {
  const r = run.value;
  if (!r) return '';
  const rule = r.metrics.population_rule;
  const base = `В расчёт вошли ${r.population.toLocaleString('ru-RU')} участков с заполненным паспортом`;
  if (!rule) return `${base}: журнал ведётся по ним.`;
  const copies = rule.copies_merged
    ? ` Копии одной трубы в разных фрагментах (сеть по сезонам) склеены: ${rule.copies_merged.toLocaleString('ru-RU')}.`
    : '';
  return `${base} (не меньше ${rule.min_filled} из ${rule.passport_fields.length} полей — как у `
    + `${pctText(rule.damaged_kept, 0)} повреждённых): журнал ведётся по ним.${copies}`;
});
const num = (v: number | null | undefined, digits = 1) => (v == null ? '—'
  : v.toLocaleString('ru-RU', { maximumFractionDigits: digits }));

const loadTop = async () => {
  if (!run.value) return;
  top.value = await fastApiService.getFailureTop(run.value.id, TOP_ON_MAP);
};

const load = async () => {
  loading.value = true;
  try {
    const runs = await fastApiService.getFailureRuns();
    run.value = runs[0] ?? null;
    await loadTop();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Прогноз не загрузился');
  } finally {
    loading.value = false;
  }
};

const calculate = async () => {
  busy.value = 'run';
  errorMessage.value = '';
  try {
    run.value = await fastApiService.runFailureForecast();
    await loadTop();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Прогноз не рассчитан');
  } finally {
    busy.value = '';
  }
};

const showFrame = (fc: GeoJSON.FeatureCollection) => {
  emit('show-on-map', fc);
  overlay.markShown();
};

const showMap = () => {
  if (top.value) showFrame(riskFrame(top.value));
};

watch(visible, (v) => {
  if (v) void load();
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.fd-imp { display: grid; grid-template-columns: minmax(160px, auto) 1fr 48px; gap: 4px 10px; align-items: center; }
.fd-bar-track { height: 8px; background: rgba(var(--v-theme-on-surface), 0.08); border-radius: 4px; }
.fd-bar { height: 8px; background: rgb(var(--v-theme-primary)); border-radius: 4px; }
.fd-table { font-size: var(--text-sm, 0.8125rem); }
.fd-line { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
</style>
