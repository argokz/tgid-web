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
          mdi-chart-line
        </v-icon>
        <span class="text-h6 flex-grow-1">Перспективный прирост нагрузки</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <p class="text-body-2 mb-2">
          Сколько тепловой нагрузки добавится к источникам за 5–15 лет — по реестру технических условий на
          подключение: тренд фактических подключений (акты допуска) и верхняя оценка по выданным ТУ. Оба способа
          проверены на прошлых годах.
        </p>
        <v-alert
          v-if="errorMessage"
          type="warning"
          density="compact"
          variant="tonal"
          class="mb-2"
        >
          {{ errorMessage }}
        </v-alert>
        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-2"
        />
        <template v-if="data">
          <div class="d-flex flex-wrap ga-3 mb-3">
            <v-card
              v-for="(value, years) in data.milestones"
              :key="years"
              variant="tonal"
              class="lp-tile pa-3"
            >
              <div class="text-caption text-medium-emphasis">
                за {{ years }} лет ({{ data.years[0] }}–{{ data.years[Number(years) - 1] }})
              </div>
              <div class="text-h6">
                +{{ num(value, 0) }} Гкал/ч
              </div>
              <div class="text-caption text-medium-emphasis">
                верхняя оценка: +{{ num(data.upper.milestones[years] ?? 0, 0) }}
              </div>
            </v-card>
          </div>
          <p class="text-body-2 mb-1">
            Тренд — {{ num(data.trend_rate) }} Гкал/ч в год: средний прирост по актам допуска
            {{ data.trend_years[0] }}–{{ data.trend_years[1] }} гг. Проверка на прошлом —
            {{ checkText(data.trend_backtest) }}.
          </p>
          <p class="text-body-2 mb-1">
            Верхняя оценка — ожидающие ТУ со сроками подключения и долей аннулирования по данным, плюс новые ТУ
            ({{ num(data.upper.issue_rate) }} Гкал/ч выдаётся в год). Проверка — {{ checkText(data.upper_backtest) }}:
            реализация ТУ упала, их всё чаще аннулируют.
          </p>
          <p
            v-if="data.unrecorded_years.length"
            class="text-body-2 mb-3"
          >
            Акты допуска в реестре полны по {{ Number(data.acts_complete_until.slice(0, 4)) - 1 }} г.; в
            {{ data.unrecorded_years.join('–') }} гг. подключения шли, но актов нет — по тренду около
            {{ num(data.unrecorded, 0) }} Гкал/ч (в прирост выше не входят).
          </p>

          <div class="text-subtitle-2 mb-1">
            По источникам (как указано в ТУ)
          </div>
          <v-table
            density="compact"
            class="lp-table mb-3"
          >
            <thead>
              <tr>
                <th>Источник</th>
                <th class="text-right">
                  Доля подключений
                </th>
                <th
                  v-for="years in milestoneYears"
                  :key="years"
                  class="text-right"
                >
                  +{{ years }} лет, Гкал/ч
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in data.by_source.slice(0, SOURCE_LIMIT)"
                :key="s.label"
              >
                <td>{{ s.label }}</td>
                <td class="text-right">
                  {{ num(s.share * 100) }} %
                </td>
                <td
                  v-for="years in milestoneYears"
                  :key="years"
                  class="text-right"
                >
                  {{ num(s.cumulative[years - 1] ?? 0) }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <div class="text-subtitle-2 mb-1">
            Крупнейшие ожидающие ТУ
          </div>
          <v-table
            density="compact"
            class="lp-table mb-2"
          >
            <thead>
              <tr>
                <th>Объект</th>
                <th>Источник</th>
                <th>Выдано</th>
                <th class="text-right">
                  Прирост, Гкал/ч
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in data.largest_waiting"
                :key="t.id"
              >
                <td class="text-caption">
                  {{ t.name || `ТУ № ${t.id}` }}
                </td>
                <td class="text-caption">
                  {{ t.label }}
                </td>
                <td>{{ formatDate(t.issued) }}</td>
                <td class="text-right">
                  {{ num(t.increment, 2) }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="text-subtitle-2 mt-4 mb-1">
            Перспективный режим фрагмента
          </div>
          <p class="text-body-2 mb-2">
            Сценарий-копия фрагмента, где у потребителей рядом с ожидающими ТУ нагрузка увеличена на их долю
            прироста. Посчитайте основу и сценарий одинаково и сравните в окне «Сценарии»: недотоп, перегрузка и
            скорости участков.
          </p>
          <div class="d-flex align-center flex-wrap ga-2 mb-2">
            <v-select
              v-model="planFileid"
              :items="fragmentItems"
              label="Фрагмент"
              density="compact"
              variant="outlined"
              hide-details
              class="lp-fragment"
            />
            <v-btn-toggle
              v-model="planHorizon"
              density="compact"
              mandatory
              variant="outlined"
              divided
            >
              <v-btn
                v-for="y in HORIZONS"
                :key="y"
                :value="y"
              >
                {{ y }} лет
              </v-btn>
            </v-btn-toggle>
            <v-btn
              size="small"
              variant="tonal"
              :loading="busy === 'plan'"
              :disabled="!planFileid || !!busy"
              @click="loadPlan"
            >
              Показать прирост
            </v-btn>
            <v-btn
              v-if="canCreate"
              size="small"
              color="primary"
              variant="flat"
              prepend-icon="mdi-content-copy"
              :loading="busy === 'create'"
              :disabled="!plan || !plan.consumers_count || !!busy"
              @click="createScenario"
            >
              Создать сценарий
            </v-btn>
          </div>
          <v-alert
            v-if="planError"
            type="error"
            density="compact"
            variant="tonal"
            closable
            class="mb-2"
            @click:close="planError = ''"
          >
            {{ planError }}
          </v-alert>
          <v-alert
            v-if="created"
            type="success"
            density="compact"
            variant="tonal"
            class="mb-2"
          >
            Создан сценарий «{{ created.name }}» (фрагмент № {{ created.fileid }}), изменено потребителей —
            {{ created.consumers_changed }}. Посчитайте основу и сценарий с одинаковыми параметрами и сравните режимы
            в окне «Сценарии».
          </v-alert>
          <template v-if="plan">
            <p class="text-body-2 mb-1">
              {{ partsText(plan) }}
            </p>
            <p class="text-body-2 mb-2">
              В сценарий: +{{ num(plan.fragment_growth) }} Гкал/ч к нагрузке фрагмента {{ num(plan.fragment_load, 0) }}
              Гкал/ч, потребителей — {{ plan.consumers_count }}<template v-if="plan.skipped_zero_load">
                (ещё {{ num(plan.skipped_zero_load) }} Гкал/ч — у узлов без нагрузки, не добавлены)
              </template>.
            </p>
            <v-table
              v-if="plan.consumers.length"
              density="compact"
              class="lp-table mb-2"
            >
              <thead>
                <tr>
                  <th>Потребитель</th>
                  <th class="text-right">
                    Нагрузка, Гкал/ч
                  </th>
                  <th class="text-right">
                    Прибавка
                  </th>
                  <th class="text-right">
                    Множитель
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in plan.consumers.slice(0, PLAN_LIMIT)"
                  :key="c.type + '-' + c.id"
                >
                  <td class="text-caption">
                    {{ c.name }}
                  </td>
                  <td class="text-right">
                    {{ num(c.load, 3) }}
                  </td>
                  <td class="text-right">
                    {{ num(c.add, 3) }}
                  </td>
                  <td
                    class="text-right"
                    :class="{ 'text-warning': c.factor > BIG_FACTOR }"
                    :title="c.factor > BIG_FACTOR ? 'Новая нагрузка намного больше существующей — проверьте место ТУ' : ''"
                  >
                    ×{{ num(c.factor, 2) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <p class="text-caption text-medium-emphasis">
            Реестр: записей — {{ num(data.registry.rows, 0) }}, в расчёте — {{ num(data.registry.used, 0) }}; не вошли:
            {{ droppedText(data.registry.dropped) }}. Прирост — поле прироста ТУ, но не больше полной нагрузки (ошибки
            единиц). Снос и отключения не учитываются.
          </p>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { formatApiError } from '~/utils/apiError';
import {
  checkText,
  droppedText,
  partsText,
  type LoadPerspective,
  type PerspectiveScenarioPlan,
  type PerspectiveScenarioResult,
} from '~/utils/loadPerspective';

/**
 * Перспективный прирост тепловой нагрузки на 5–15 лет по реестру ТУ (itwin-api database/load_perspective.py):
 * тренд подключений и верхняя оценка по выданным ТУ, по источникам, с проверкой на прошлом.
 */
const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();
const authStore = useAuthStore();
const fragmentStore = useFragmentStore();

const SOURCE_LIMIT = 15;
const PLAN_LIMIT = 15;
const BIG_FACTOR = 10;            // прибавка больше нагрузки в 10 раз — подсветить: место ТУ стоит проверить
const HORIZONS = [5, 10, 15];
const data = ref<LoadPerspective | null>(null);
const loading = ref(false);
const errorMessage = ref('');

const planFileid = ref<number | null>(null);
const planHorizon = ref(10);
const plan = ref<PerspectiveScenarioPlan | null>(null);
const created = ref<PerspectiveScenarioResult | null>(null);
const busy = ref<'' | 'plan' | 'create'>('');
const planError = ref('');
const canCreate = computed(() => authStore.canEditNetworkStruct);
const fragmentItems = computed(() => fragmentStore.fragments
  .map((f: { id: number; name?: string }) => ({ value: f.id, title: f.name ? `${f.name} (№ ${f.id})` : `№ ${f.id}` })));

const milestoneYears = computed(() => Object.keys(data.value?.milestones ?? {}).map(Number));
const num = (v: number, digits = 1) => v.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');

const load = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    data.value = await fastApiService.getLoadPerspective();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Прирост нагрузки не рассчитан');
  } finally {
    loading.value = false;
  }
};

const loadPlan = async () => {
  if (!planFileid.value) return;
  busy.value = 'plan';
  planError.value = '';
  created.value = null;
  try {
    plan.value = await fastApiService.getPerspectiveScenarioPlan(planFileid.value, planHorizon.value);
  } catch (err: unknown) {
    plan.value = null;
    planError.value = formatApiError(err, 'Прирост фрагмента не рассчитан');
  } finally {
    busy.value = '';
  }
};

const createScenario = async () => {
  if (!plan.value) return;
  busy.value = 'create';
  planError.value = '';
  try {
    created.value = await fastApiService.createPerspectiveScenario(plan.value.fileid, plan.value.horizon);
    void fragmentStore.loadFragments();
  } catch (err: unknown) {
    planError.value = formatApiError(err, 'Сценарий не создан');
  } finally {
    busy.value = '';
  }
};

// другой фрагмент или горизонт — прежний расчёт прироста уже не про них
watch([planFileid, planHorizon], () => {
  plan.value = null;
});

watch(visible, (open) => {
  if (!open) return;
  if (!data.value) void load();
  if (!fragmentStore.fragments.length) void fragmentStore.loadFragments();
  planFileid.value ??= fragmentStore.selectedFragmentId
    ?? (fragmentStore.visibleFragments.length === 1 ? fragmentStore.visibleFragments[0] : null);
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.lp-tile { min-width: 190px; flex: 1 1 190px; }
.lp-table { font-size: var(--text-sm, 0.8125rem); }
.lp-fragment { max-width: 320px; }
</style>
