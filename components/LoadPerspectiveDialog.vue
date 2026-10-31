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
import { formatApiError } from '~/utils/apiError';
import { checkText, droppedText, type LoadPerspective } from '~/utils/loadPerspective';

/**
 * Перспективный прирост тепловой нагрузки на 5–15 лет по реестру ТУ (itwin-api database/load_perspective.py):
 * тренд подключений и верхняя оценка по выданным ТУ, по источникам, с проверкой на прошлом.
 */
const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();

const SOURCE_LIMIT = 15;
const data = ref<LoadPerspective | null>(null);
const loading = ref(false);
const errorMessage = ref('');

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

watch(visible, (open) => {
  if (open && !data.value) void load();
}, { immediate: true });

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.lp-tile { min-width: 190px; flex: 1 1 190px; }
.lp-table { font-size: var(--text-sm, 0.8125rem); }
</style>
