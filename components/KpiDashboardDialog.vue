<template>
  <v-dialog
    v-model="visible"
    :max-width="1200"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-chart-box-outline
        </v-icon>
        <span class="text-h6 flex-grow-1">Показатели эксплуатации</span>
        <v-btn
          v-if="overlayShown"
          variant="tonal"
          size="small"
          class="mr-2"
          @click="keepOnMap"
        >
          Оставить на карте
        </v-btn>
        <HintTip text="Закрыть">
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              size="small"
              aria-label="Закрыть"
              @click="visible = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <!-- фильтры — одной строкой над графиками -->
        <div class="d-flex flex-wrap align-center ga-2 mb-3">
          <v-btn-toggle
            v-model="preset"
            mandatory
            divided
            density="compact"
            variant="outlined"
          >
            <v-btn value="12m">
              12 месяцев
            </v-btn>
            <v-btn value="year">
              Этот год
            </v-btn>
            <v-btn value="prev-year">
              Прошлый год
            </v-btn>
            <v-btn value="custom">
              Свой
            </v-btn>
          </v-btn-toggle>
          <template v-if="preset === 'custom'">
            <v-text-field
              v-model="dateFrom"
              type="date"
              label="С"
              density="compact"
              variant="outlined"
              hide-details
              class="kpi-date"
            />
            <v-text-field
              v-model="dateTo"
              type="date"
              label="По"
              density="compact"
              variant="outlined"
              hide-details
              class="kpi-date"
            />
          </template>
          <v-switch
            v-model="byView"
            label="Только видимая область карты"
            color="primary"
            density="compact"
            hide-details
            inset
          />
          <v-spacer />
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="asTable ? 'mdi-chart-box-outline' : 'mdi-table'"
            @click="asTable = !asTable"
          >
            {{ asTable ? 'Графики' : 'Таблицы' }}
          </v-btn>
        </div>

        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>
        <v-progress-linear
          v-if="loading"
          indeterminate
          class="mb-2"
        />

        <template v-if="data">
          <div class="text-caption text-medium-emphasis mb-2">
            {{ formatDate(data.period.from) }} — {{ formatDate(data.period.to) }}<span v-if="byView"> · в видимой области карты</span>
            · сеть {{ nf(data.network.km, 1) }} км трубопроводов ({{ nf(data.network.lines) }} участков с паспортом)
          </div>

          <div class="kpi-tiles mb-4">
            <KpiTile
              label="Дефектов за период"
              :value="data.defects.total"
              :compact="false"
              :trend="data.defects.by_month.map((m) => m.count)"
              trend-label="по месяцам"
            />
            <KpiTile
              label="Открытых дефектов"
              :value="data.defects.open_now"
              :compact="false"
              :status="data.defects.open_now > 0 ? 'warning' : undefined"
            />
            <KpiTile
              label="Повреждений на 100 км в год"
              :value="data.defects.per_100km_year ?? '—'"
              :digits="2"
              :compact="false"
            />
            <KpiTile
              label="Средний срок ремонта"
              :value="data.defects.repair_avg_days ?? '—'"
              units="дн."
              :digits="1"
              :compact="false"
            />
            <KpiTile
              label="Средний износ"
              :value="data.wear?.avg_wear ?? '—'"
              units="%"
              :digits="1"
              :compact="false"
            />
            <KpiTile
              label="Открытых нарядов"
              :value="openOrders"
              :compact="false"
              :status="data.work_orders.overdue > 0 ? 'serious' : undefined"
            />
            <KpiTile
              label="Просрочено нарядов"
              :value="data.work_orders.overdue"
              :compact="false"
              :status="data.work_orders.overdue > 0 ? 'serious' : undefined"
            />
            <KpiTile
              label="Отключений за период"
              :value="data.outages.total"
              :compact="false"
            />
          </div>

          <div class="kpi-grid">
            <section
              v-for="c in charts"
              :key="c.key"
              class="kpi-card"
            >
              <h3 class="text-subtitle-2 mb-1">
                {{ c.title }}
              </h3>
              <div
                v-if="c.hint"
                class="text-caption text-medium-emphasis mb-1"
              >
                {{ c.hint }}
              </div>
              <div
                v-if="!c.spec.values.some((v) => v)"
                class="text-body-2 text-medium-emphasis pa-4 text-center"
              >
                {{ c.empty }}
              </div>
              <v-table
                v-else-if="asTable"
                density="compact"
              >
                <thead>
                  <tr>
                    <th>{{ c.column }}</th>
                    <th class="text-right">
                      {{ c.spec.name }}{{ c.spec.unit ? `, ${c.spec.unit}` : '' }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in tableRows(c.spec.categories, c.spec.values)"
                    :key="row.name"
                  >
                    <td>{{ row.name }}</td>
                    <td class="text-right kpi-num">
                      {{ nf(row.value, c.spec.digits ?? 0) }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <ChartFrame
                v-else
                :option="barOption(c.spec)"
                :label="c.title"
                :summary="c.summary"
                :zoomable="false"
                :height="c.spec.horizontal ? Math.max(170, c.spec.categories.length * 30 + 56) : 250"
                @click="(e: { dataIndex: number }) => c.onPick?.(e.dataIndex)"
              />
            </section>
          </div>
          <div class="text-caption text-medium-emphasis mt-2">
            Нажмите на столбец дефектов — они появятся на карте. Износ — по всей сети, расчёт
            {{ data.wear?.at ? formatDate(data.wear.at) : 'не выполнялся' }}.
          </div>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { BarChart } from 'echarts/charts';
import { use } from 'echarts/core';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ChartFrame from '~/components/ChartFrame.vue';
import HintTip from '~/components/HintTip.vue';
import KpiTile from '~/components/KpiTile.vue';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { useNotification } from '~/composables/useNotification';
import { fastApiService } from '~/services/fastApiService';
import { useMapStore } from '~/stores/mapStore';
import { formatApiError } from '~/utils/apiError';
import {
  barOption,
  bboxParam,
  defectMapFeatures,
  monthLabel,
  peakMonth,
  presetPeriod,
  tableRows,
  wearBars,
  workOrderBars,
  type KpiDashboard,
  type PeriodPreset,
} from '~/utils/kpi';
import { OPEN_STATUSES } from '~/utils/workOrders';

use([BarChart]);

/**
 * Показатели эксплуатации (фаза 2, дашборды KPI): аварийность, ремонты, износ, наряды, отключения и сеть одной
 * сводкой (itwin-api GET /api/v1/kpi/dashboard). Связь с картой: «Только видимая область» пересчитывает показатели
 * при каждом сдвиге карты; столбец дефектов (месяц, категория, состояние) показывает эти дефекты на карте.
 */
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
}>();

const RELOAD_DEBOUNCE_MS = 600;
const WO_LABELS: Record<string, string> = {
  new: 'Заявка', assigned: 'Назначен', in_progress: 'В работе', done: 'Выполнен', closed: 'Закрыт', cancelled: 'Отменён',
};

const visible = defineModel<boolean>({ default: false });
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { shown: overlayShown, keepOnMap } = overlay;
const { isMobile } = useMobile();
const mapStore = useMapStore();
const { showInfo } = useNotification();

const loading = ref(false);
const errorMessage = ref('');
const data = ref<KpiDashboard | null>(null);
const preset = ref<PeriodPreset>('12m');
const dateFrom = ref(presetPeriod('12m').from);
const dateTo = ref(presetPeriod('12m').to);
const byView = ref(false);
const asTable = ref(false);
let requestSeq = 0;

const nf = (v: number, digits = 0) => v.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const formatDate = (s: string) => new Date(s).toLocaleDateString('ru-RU');
const openOrders = computed(() => OPEN_STATUSES.reduce((n, s) => n + (data.value?.work_orders.by_status[s] ?? 0), 0));

function currentBbox(): string | null {
  const map = mapStore.map;
  if (!byView.value || !map) return null;
  const b = map.getBounds();
  return bboxParam({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
}

async function load(): Promise<void> {
  const seq = ++requestSeq;
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await fastApiService.getKpiDashboard({ date_from: dateFrom.value, date_to: dateTo.value, bbox: currentBbox() });
    if (seq === requestSeq) data.value = res;
  } catch (err: unknown) {
    if (seq === requestSeq) errorMessage.value = formatApiError(err, 'Показатели не загружены');
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

/** Столбец дефектов → эти дефекты на карте */
async function showDefects(filter: { month?: string; category_id?: number; state_id?: number }, label: string): Promise<void> {
  try {
    const fc = await fastApiService.getKpiDefectPoints({ date_from: dateFrom.value, date_to: dateTo.value, bbox: currentBbox(), ...filter });
    emit('show-on-map', defectMapFeatures(fc));
    overlay.markShown();
    showInfo(`На карте: ${label} — ${fc.features.length}${fc.truncated ? ' (показаны не все)' : ''}`);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Дефекты на карте не показаны');
  }
}

interface ChartCard {
  key: string;
  title: string;
  hint?: string;
  column: string;
  empty: string;
  summary: string;
  spec: Parameters<typeof barOption>[0];
  onPick?: (index: number) => void;
}

const charts = computed<ChartCard[]>(() => {
  const d = data.value;
  if (!d) return [];
  const months = d.defects.by_month;
  const cats = d.defects.by_category;
  const states = d.defects.by_state;
  const list: ChartCard[] = [
    {
      key: 'defects-month', title: 'Дефекты по месяцам', column: 'Месяц', empty: 'Дефектов за период нет',
      summary: `Всего ${d.defects.total}, больше всего — ${peakMonth(months) ?? '—'}`,
      spec: { categories: months.map((m) => monthLabel(m.month)), values: months.map((m) => m.count), name: 'Дефектов' },
      onPick: (i) => months[i] && void showDefects({ month: months[i].month }, `дефекты, ${monthLabel(months[i].month)}`),
    },
    {
      key: 'defects-category', title: 'Дефекты по категориям', column: 'Категория', empty: 'Дефектов за период нет',
      summary: cats.map((c) => `${c.name} — ${c.count}`).join(', '),
      spec: { categories: cats.map((c) => c.name), values: cats.map((c) => c.count), name: 'Дефектов', horizontal: true },
      onPick: (i) => cats[i] && void showDefects({ category_id: cats[i].id ?? 0 }, `дефекты «${cats[i].name}»`),
    },
    {
      key: 'defects-state', title: 'Дефекты по состоянию', column: 'Состояние', empty: 'Дефектов за период нет',
      summary: states.map((c) => `${c.name} — ${c.count}`).join(', '),
      spec: { categories: states.map((c) => c.name), values: states.map((c) => c.count), name: 'Дефектов', horizontal: true },
      onPick: (i) => states[i] && void showDefects({ state_id: states[i].id ?? 0 }, `дефекты «${states[i].name}»`),
    },
  ];
  if (d.wear) {
    list.push({
      key: 'wear', title: 'Износ участков по категориям', hint: 'Последний расчёт износа, вся сеть', column: 'Категория',
      empty: 'Расчёта износа нет', summary: `Средний износ ${d.wear.avg_wear != null ? nf(d.wear.avg_wear, 1) : '—'} %`,
      spec: wearBars(d.wear),
    });
  }
  const wo = workOrderBars(d.work_orders.by_status, WO_LABELS);
  list.push(
    {
      key: 'orders', title: 'Наряды по статусам', hint: 'Сейчас, все наряды', column: 'Статус', empty: 'Нарядов нет',
      summary: `Открытых ${openOrders.value}, просрочено ${d.work_orders.overdue}`, spec: wo,
    },
    {
      key: 'decade', title: 'Сеть по годам прокладки', hint: 'Дата перекладки, иначе прокладки', column: 'Десятилетие',
      empty: 'Нет данных о сети', summary: `${nf(d.network.km, 1)} км`,
      spec: { categories: d.network.by_decade.map((x) => x.name), values: d.network.by_decade.map((x) => x.km), name: 'Длина', unit: 'км', digits: 1 },
    },
    {
      key: 'diameter', title: 'Сеть по диаметрам', hint: 'Условный диаметр, мм', column: 'Диаметр, мм',
      empty: 'Нет данных о сети', summary: `${nf(d.network.km, 1)} км`,
      spec: { categories: d.network.by_diameter.map((x) => x.name), values: d.network.by_diameter.map((x) => x.km), name: 'Длина', unit: 'км', digits: 1 },
    },
  );
  return list;
});

watch(preset, (p) => {
  if (p === 'custom') return;
  const range = presetPeriod(p);
  dateFrom.value = range.from;
  dateTo.value = range.to;
});
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
const reloadSoon = () => {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS);
};
watch([dateFrom, dateTo, byView], () => {
  if (visible.value && dateFrom.value && dateTo.value) reloadSoon();
});

/** «Только видимая область»: сдвиг карты — показатели заново */
const onMapMove = () => {
  if (visible.value && byView.value) reloadSoon();
};
watch([visible, byView], ([open, view]) => {
  const map = mapStore.map;
  if (!map) return;
  map.off('moveend', onMapMove);
  if (open && view) map.on('moveend', onMapMove);
});

watch(visible, (open) => {
  if (open) void load();
}, { immediate: true });

onBeforeUnmount(() => {
  if (reloadTimer) clearTimeout(reloadTimer);
  mapStore.map?.off('moveend', onMapMove);
});

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.kpi-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-2, 8px); }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--space-4, 16px); }
.kpi-card {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.kpi-date { max-width: 170px; }
.kpi-num { font-variant-numeric: tabular-nums; }
@media (max-width: 720px) {
  .kpi-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
