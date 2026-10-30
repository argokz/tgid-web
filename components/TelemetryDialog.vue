<template>
  <v-dialog
    v-model="visible"
    :max-width="1180"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon
          class="mr-2"
          color="primary"
        >
          mdi-gauge
        </v-icon>
        <span class="text-h6 flex-grow-1">Телеметрия: факт против модели</span>
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
        <v-alert
          v-if="importResult"
          :type="importResult.accepted ? 'success' : 'warning'"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="importResult = null"
        >
          Принято показаний: {{ importResult.accepted }}<template v-if="importResult.skipped">
            , пропущено: {{ importResult.skipped }}
          </template><template v-if="importResult.unknown_codes.length">
            · нет таких датчиков: {{ importResult.unknown_codes.join(', ') }}
          </template><template v-if="importResult.future">
            · время из будущего: {{ importResult.future }}
          </template><template v-if="importResult.notes?.length">
            · {{ importResult.notes.join('; ') }}
          </template>
        </v-alert>

        <!-- непринятые тревоги: расхождение с моделью или датчик молчит -->
        <v-alert
          v-if="openAlerts.length"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
          icon="mdi-bell-alert-outline"
        >
          <div class="text-subtitle-2 mb-1">
            Тревоги: {{ openAlerts.length }}
          </div>
          <div
            v-for="a in openAlerts.slice(0, ALERTS_SHOWN)"
            :key="a.id"
            class="d-flex align-center ga-2 tm-alert"
          >
            <span
              class="tm-alert__dot"
              :style="{ background: ALERT_COLORS[a.status] }"
              aria-hidden="true"
            />
            <span class="flex-grow-1">
              <b>{{ a.name }}</b> — {{ a.label }}<template v-if="a.status === 'bad' && a.pct != null">
                ({{ deviationText({ diff: a.diff ?? 0, pct: a.pct, status: 'bad', base_unit: '' }) }})
              </template>
            </span>
            <span class="text-caption text-medium-emphasis text-no-wrap">{{ shortTime(a.at) }}</span>
            <v-btn
              v-if="canImport"
              size="x-small"
              variant="text"
              :loading="acking === a.id"
              @click="acknowledge(a)"
            >
              Принято
            </v-btn>
          </div>
          <div
            v-if="openAlerts.length > ALERTS_SHOWN"
            class="text-caption"
          >
            и ещё {{ openAlerts.length - ALERTS_SHOWN }}
          </div>
        </v-alert>

        <!-- сводка -->
        <div class="tm-tiles mb-3">
          <KpiTile
            v-for="t in tiles"
            :key="t.label"
            :label="t.label"
            :value="t.value"
            :status="t.status"
          />
        </div>

        <div class="d-flex flex-wrap ga-2 mb-3">
          <v-btn
            v-if="canEdit"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            @click="startNew"
          >
            Датчик
          </v-btn>
          <v-btn
            v-if="canImport"
            variant="tonal"
            prepend-icon="mdi-file-upload-outline"
            :loading="importing"
            @click="fileInput?.click()"
          >
            Загрузить выгрузку ОДПУ
          </v-btn>
          <input
            ref="fileInput"
            type="file"
            accept=".csv,.txt,.xlsx"
            class="d-none"
            @change="onImport"
          >
          <v-btn
            variant="text"
            prepend-icon="mdi-map-marker-multiple-outline"
            :disabled="!sensors.length"
            @click="showOnMap"
          >
            На карте
          </v-btn>
          <v-spacer />
          <v-btn
            variant="text"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="load"
          >
            Обновить
          </v-btn>
        </div>

        <v-tabs
          v-model="tab"
          density="compact"
          class="mb-3"
        >
          <v-tab value="sensors">
            Датчики
          </v-tab>
          <v-tab value="calibration">
            Калибровка
          </v-tab>
        </v-tabs>

        <!-- калибровка: потери напора между соседними датчиками давления -->
        <div v-if="tab === 'calibration'">
          <p class="text-body-2 mb-2">
            Потери напора между соседними датчиками давления одной трубы — по показаниям (среднее за
            {{ calibration?.window_min ?? 30 }} мин) и по последнему расчёту. Расхождение в пределах погрешности
            датчиков (±{{ calibration?.accuracy_m ?? 0.5 }} м вод. ст. каждый) модель не меняет; «шероховатость» —
            эквивалентная шероховатость участков пары ×r⁴; «местное сопротивление» — шероховатостью не объяснить.
            Модель не меняется: участки и значение — для проверки (групповые установщики, сценарий).
          </p>
          <v-progress-linear
            v-if="calibrationLoading"
            indeterminate
          />
          <p
            v-else-if="calibration && !calibration.segments.length"
            class="text-body-2 text-medium-emphasis"
          >
            Пар для сравнения нет: нужны два и больше датчика давления одной трубы в соседних узлах с показаниями
            и расчётом.
          </p>
          <v-table
            v-else-if="calibration"
            density="compact"
            class="tm-cal"
          >
            <thead>
              <tr>
                <th>Участок</th>
                <th class="text-right">
                  Потери: модель / факт
                </th>
                <th class="text-right">
                  Отношение
                </th>
                <th>Вывод</th>
                <th class="text-right">
                  Шероховатость, мм
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="seg in calibration.segments"
                :key="`${seg.pipe}-${seg.from.node_id}-${seg.to.node_id}`"
              >
                <td>
                  {{ seg.label }}
                  <div class="text-caption text-medium-emphasis">
                    {{ seg.pipe === 'supply' ? 'подача' : 'обратка' }} · {{ (seg.length_m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) }} км ·
                    участков {{ seg.lines }}<template v-if="seg.d_min">
                      · d внутр. {{ seg.d_min === seg.d_max ? seg.d_min : `${seg.d_min}–${seg.d_max}` }} мм
                    </template>
                  </div>
                </td>
                <td class="text-right text-no-wrap">
                  {{ seg.dh_model.toLocaleString('ru-RU') }} / {{ seg.dh_fact.toLocaleString('ru-RU') }} м
                </td>
                <td class="text-right text-no-wrap">
                  {{ seg.ratio.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) }}
                  <div class="text-caption text-medium-emphasis">
                    ±{{ Math.round(seg.uncertainty * 100) }} %
                  </div>
                </td>
                <td>
                  <span :style="{ color: CALIBRATION_META[seg.status].color }">{{ CALIBRATION_META[seg.status].label }}</span>
                  <div class="text-caption text-medium-emphasis tm-cal__text">
                    {{ seg.text }}
                  </div>
                </td>
                <td class="text-right text-no-wrap">
                  <template v-if="seg.roughness_suggested_mm != null">
                    {{ seg.roughness_mm }} → <b>{{ seg.roughness_suggested_mm }}</b>
                  </template>
                  <template v-else>
                    {{ seg.roughness_mm ?? '—' }}
                  </template>
                </td>
                <td>
                  <v-btn
                    v-if="seg.geometry"
                    size="x-small"
                    variant="text"
                    icon="mdi-map-marker-path"
                    :aria-label="`Участки пары ${seg.label} на карте`"
                    @click="showSegment(seg)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div
            v-if="calibration?.skipped.length"
            class="text-caption text-medium-emphasis mt-2"
          >
            Не сравниваются: {{ calibration.skipped.join('; ') }}
          </div>
        </div>

        <div
          v-else
          class="tm-grid"
        >
          <!-- датчики -->
          <div class="tm-list">
            <v-progress-linear
              v-if="loading && !sensors.length"
              indeterminate
            />
            <p
              v-else-if="!sensors.length"
              class="text-body-2 text-medium-emphasis"
            >
              Датчиков ещё нет. Добавьте датчик (код из SCADA или ОДПУ, узел или участок) — показания придут от шлюза
              SCADA (API v2) или из выгрузки ОДПУ.
            </p>
            <v-table
              v-else
              density="compact"
              hover
              class="tm-table"
            >
              <thead>
                <tr>
                  <th>Датчик</th>
                  <th class="text-right">
                    Факт
                  </th>
                  <th class="text-right">
                    От модели
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in sorted"
                  :key="s.id"
                  :class="{ 'tm-row--active': s.id === selectedId, 'text-medium-emphasis': !s.active }"
                  tabindex="0"
                  @click="select(s)"
                  @keydown.enter="select(s)"
                >
                  <td>
                    <div class="d-flex align-center ga-1">
                      <v-icon
                        :icon="STATUS_ICONS[sensorStatus(s)]"
                        :color="STATUS_META[sensorStatus(s)].color"
                        size="16"
                        :aria-label="STATUS_META[sensorStatus(s)].label"
                      />
                      <span class="text-truncate">{{ s.name }}</span>
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ s.kind_label }}, {{ s.pipe_label }} · {{ s.code }}
                    </div>
                  </td>
                  <td class="text-right text-no-wrap">
                    {{ valueText(s.last?.value, s.unit_label) }}
                  </td>
                  <td class="text-right text-no-wrap">
                    <span :style="{ color: STATUS_META[sensorStatus(s)].color }">{{ deviationText(s.deviation) }}</span>
                    <div class="text-caption text-medium-emphasis">
                      {{ STATUS_META[sensorStatus(s)].label }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <!-- выбранный датчик или форма -->
          <div class="tm-detail">
            <template v-if="mode === 'edit'">
              <div class="text-subtitle-1 mb-2">
                {{ draft.id ? `Датчик ${draft.code}` : 'Новый датчик' }}
              </div>
              <div class="d-flex ga-2">
                <v-text-field
                  v-model="draft.code"
                  label="Код в SCADA / ОДПУ"
                  density="compact"
                  variant="outlined"
                  maxlength="100"
                />
                <v-switch
                  v-model="draft.active"
                  label="Принимает показания"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </div>
              <v-text-field
                v-model="draft.name"
                label="Название"
                density="compact"
                variant="outlined"
                maxlength="200"
              />
              <div class="d-flex ga-2">
                <v-select
                  v-model="draft.kind"
                  :items="units?.kinds ?? []"
                  item-title="label"
                  item-value="value"
                  label="Что измеряет"
                  density="compact"
                  variant="outlined"
                  @update:model-value="draft.unit = unitsFor($event)[0]?.value ?? ''"
                />
                <v-select
                  v-model="draft.pipe"
                  :items="units?.pipes ?? []"
                  item-title="label"
                  item-value="value"
                  label="Трубопровод"
                  density="compact"
                  variant="outlined"
                />
                <v-select
                  v-model="draft.unit"
                  :items="unitsFor(draft.kind)"
                  item-title="label"
                  item-value="value"
                  label="Единица"
                  density="compact"
                  variant="outlined"
                />
              </div>
              <v-text-field
                v-if="draft.kind === 'flow'"
                v-model.number="draft.line_id"
                type="number"
                label="Участок (id)"
                hint="Расходомер — на участке: id из карточки участка"
                persistent-hint
                density="compact"
                variant="outlined"
              />
              <v-text-field
                v-else
                v-model.number="draft.node_id"
                type="number"
                label="Узел (id)"
                hint="Датчик давления или температуры — в узле: id из карточки узла"
                persistent-hint
                density="compact"
                variant="outlined"
              />
              <v-textarea
                v-model="draft.note"
                label="Примечание"
                rows="1"
                auto-grow
                density="compact"
                variant="outlined"
                class="mt-2"
              />
              <div class="d-flex ga-2">
                <v-btn
                  color="primary"
                  :loading="saving"
                  :disabled="!draft.code.trim() || !draft.name.trim() || !draft.unit"
                  @click="save"
                >
                  Сохранить
                </v-btn>
                <v-btn
                  variant="text"
                  @click="mode = 'view'"
                >
                  Отмена
                </v-btn>
                <v-spacer />
                <v-btn
                  v-if="draft.id"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-delete-outline"
                  @click="remove"
                >
                  Удалить
                </v-btn>
              </div>
            </template>

            <template v-else-if="selected">
              <div class="d-flex align-start ga-2 mb-1">
                <div class="flex-grow-1 min-w-0">
                  <div class="text-subtitle-1">
                    {{ selected.name }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ selected.kind_label }}, {{ selected.pipe_label }} · {{ placeText(selected) }} · код {{ selected.code }}
                  </div>
                </div>
                <v-btn
                  v-if="selected.lon != null"
                  size="small"
                  variant="text"
                  icon="mdi-crosshairs-gps"
                  aria-label="Показать датчик на карте"
                  @click="flyTo(selected)"
                />
                <v-btn
                  v-if="canEdit"
                  size="small"
                  variant="text"
                  icon="mdi-pencil"
                  aria-label="Изменить датчик"
                  @click="startEdit(selected)"
                />
              </div>
              <div class="tm-facts mb-2">
                <div>
                  <div class="text-caption text-medium-emphasis">
                    Факт
                  </div>
                  <div class="text-body-1">
                    {{ valueText(selected.last?.value, selected.unit_label) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ selected.last ? shortTime(selected.last.ts) : 'нет показаний' }}
                  </div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">
                    Модель
                  </div>
                  <div class="text-body-1">
                    {{ valueText(selected.model, selected.unit_label) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ selected.calculation ? `расчёт №${selected.calculation.id}, ${shortTime(selected.calculation.at)}` : 'расчёта фрагмента нет' }}
                  </div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">
                    Расхождение
                  </div>
                  <div
                    class="text-body-1"
                    :style="{ color: STATUS_META[sensorStatus(selected)].color }"
                  >
                    {{ deviationText(selected.deviation) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ STATUS_META[sensorStatus(selected)].label }}
                  </div>
                </div>
              </div>
              <v-btn-toggle
                v-model="period"
                mandatory
                density="compact"
                variant="outlined"
                class="mb-2"
              >
                <v-btn
                  v-for="p in PERIODS"
                  :key="p.value"
                  :value="p.value"
                  size="small"
                >
                  {{ p.title }}
                </v-btn>
              </v-btn-toggle>
              <v-progress-linear
                v-if="seriesLoading"
                indeterminate
              />
              <ChartFrame
                v-if="series && series.points.length"
                :option="chartOption"
                :label="`${selected.name}: показания`"
                :summary="chartSummary"
                :height="280"
              />
              <p
                v-else-if="series"
                class="text-body-2 text-medium-emphasis"
              >
                За этот период показаний нет.
              </p>
            </template>
            <p
              v-else
              class="text-body-2 text-medium-emphasis"
            >
              Выберите датчик — покажем его показания за период и линию расчётного значения.
            </p>
          </div>
        </div>
        <p class="text-caption text-medium-emphasis mt-3">
          Модель — последний расчёт фрагмента, где стоит датчик: давление — напор над отметкой в узле, температура — в
          узле, расход — на участке. Норма: давление и расход — в пределах {{ units?.thresholds.ok_pct ?? 5 }} %,
          температура — {{ units?.thresholds.ok_deg ?? 2 }} °C; «молчит» — нет показаний дольше
          {{ units?.thresholds.stale_min ?? 60 }} мин.
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { LineChart } from 'echarts/charts';
import { MarkLineComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import ChartFrame from '~/components/ChartFrame.vue';
import HintTip from '~/components/HintTip.vue';
import KpiTile from '~/components/KpiTile.vue';
import { confirmAction } from '~/composables/useConfirm';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';
import { useMobile } from '~/composables/useMobile';
import { fastApiService } from '~/services/fastApiService';
import { useAuthStore } from '~/stores/authStore';
import { useMapStore } from '~/stores/mapStore';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatApiError } from '~/utils/apiError';
import {
  ALERT_COLORS,
  CALIBRATION_META,
  calibrationFeature,
  deviationText,
  sensorStatus,
  seriesOption,
  seriesSummary,
  sortSensors,
  STATUS_META,
  valueText,
  type CalibrationResult,
  type CalibrationSegment,
  type ImportResult,
  type Sensor,
  type SensorInput,
  type SensorKind,
  type SensorSeries,
  type SensorStatus,
  type TelemetryAlert,
  type TelemetryUnits,
} from '~/utils/telemetry';

use([LineChart, MarkLineComponent]);

/**
 * Телеметрия (фаза 3, «Цифровой двойник»): датчики давления, температуры и расхода в узлах и на участках,
 * последние показания против последнего расчёта, график за период с линией модели, датчики на карте (цвет —
 * оценка), загрузка выгрузки ОДПУ. Показания от шлюза SCADA — POST /api/v2/telemetry/readings (ключ API).
 */
const emit = defineEmits<{
  'show-on-map': [data: GeoJSON.FeatureCollection];
  'clear-highlight': [];
}>();
const visible = defineModel<boolean>({ default: false });
const overlay = useDialogMapOverlay(visible, () => emit('clear-highlight'));
const { isMobile } = useMobile();
const authStore = useAuthStore();
const mapStore = useMapStore();
const notify = useNotificationStore();

const REFRESH_MS = 60_000;
/** Значок оценки — вместе с цветом и подписью, не одним цветом */
const STATUS_ICONS: Record<SensorStatus, string> = {
  ok: 'mdi-check-circle-outline',
  warn: 'mdi-alert-outline',
  bad: 'mdi-alert-octagon-outline',
  stale: 'mdi-timer-sand',
  no_model: 'mdi-help-circle-outline',
  no_data: 'mdi-minus-circle-outline',
};
const PERIODS = [
  { value: 1, title: 'Сутки' },
  { value: 7, title: 'Неделя' },
  { value: 30, title: 'Месяц' },
];

const sensors = ref<Sensor[]>([]);
const tab = ref<'sensors' | 'calibration'>('sensors');
const calibration = ref<CalibrationResult | null>(null);
const calibrationLoading = ref(false);
const openAlerts = ref<TelemetryAlert[]>([]);
const acking = ref<number | null>(null);
const ALERTS_SHOWN = 5;
const units = ref<TelemetryUnits | null>(null);
const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const errorMessage = ref('');
const importResult = ref<ImportResult | null>(null);
const selectedId = ref<number | null>(null);
const mode = ref<'view' | 'edit'>('view');
const period = ref(1);
const series = ref<SensorSeries | null>(null);
const seriesLoading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const emptyDraft = () => ({ id: null as number | null, code: '', name: '', kind: 'pressure' as SensorKind,
  pipe: 'supply' as 'supply' | 'return', unit: 'kgf_cm2', node_id: null as number | null,
  line_id: null as number | null, active: true, note: '' });
const draft = reactive(emptyDraft());

const general = computed(() => authStore.permissions.general as string[]);
const canEdit = computed(() => authStore.canEditData && general.value.includes('refs'));
const canImport = computed(() => authStore.canEditData && general.value.includes('journals'));
const sorted = computed(() => sortSensors(sensors.value));
const selected = computed(() => sensors.value.find((s) => s.id === selectedId.value) ?? null);
const tiles = computed(() => {
  const count = (st: string) => sensors.value.filter((s) => sensorStatus(s) === st).length;
  const silent = count('stale') + count('no_data');
  return [
    { label: 'Датчиков', value: sensors.value.length, status: 'none' as const },
    { label: 'В норме', value: count('ok'), status: 'good' as const },
    { label: 'Внимание', value: count('warn'), status: count('warn') ? 'warning' as const : 'none' as const },
    { label: 'Расхождение', value: count('bad'), status: count('bad') ? 'critical' as const : 'none' as const },
    { label: 'Молчат', value: silent, status: silent ? 'serious' as const : 'none' as const },
  ];
});
const chartOption = computed(() => (series.value ? seriesOption(series.value, selected.value?.model) : {}));
const chartSummary = computed(() => (series.value ? seriesSummary(series.value, selected.value?.model) : ''));

const unitsFor = (kind: SensorKind) => (units.value?.units ?? []).filter((u) => u.kind === kind);
const shortTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
const placeText = (s: Sensor) => (s.node_id ? `узел ${s.node_name || s.node_id}` : `участок ${s.line_id}`);

const load = async () => {
  loading.value = true;
  try {
    const [u, list, alerts] = await Promise.all([
      units.value ? Promise.resolve(units.value) : fastApiService.getTelemetryUnits(),
      fastApiService.getSensors(),
      fastApiService.getTelemetryAlerts(true),
    ]);
    units.value = u;
    sensors.value = list;
    openAlerts.value = alerts;
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Датчики не загружены');
  } finally {
    loading.value = false;
  }
};

const loadSeries = async () => {
  const s = selected.value;
  if (!s) return;
  seriesLoading.value = true;
  const to = new Date();
  const from = new Date(to.getTime() - period.value * 24 * 3600_000);
  try {
    series.value = await fastApiService.getSensorSeries(s.id, from.toISOString(), to.toISOString());
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Показания не загружены');
  } finally {
    seriesLoading.value = false;
  }
};

const loadCalibration = async () => {
  calibrationLoading.value = true;
  try {
    calibration.value = await fastApiService.getCalibration();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Калибровка не рассчиталась');
  } finally {
    calibrationLoading.value = false;
  }
};
watch(tab, (t) => {
  if (t === 'calibration') void loadCalibration();
});

const showSegment = (seg: CalibrationSegment) => {
  emit('show-on-map', calibrationFeature(seg));
  overlay.markShown();
};

const acknowledge = async (a: TelemetryAlert) => {
  acking.value = a.id;
  try {
    await fastApiService.acknowledgeTelemetryAlert(a.id);
    openAlerts.value = openAlerts.value.filter((x) => x.id !== a.id);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Тревога не принята');
  } finally {
    acking.value = null;
  }
};

const select = (s: Sensor) => {
  selectedId.value = s.id;
  mode.value = 'view';
  series.value = null;
  void loadSeries();
};
watch(period, () => void loadSeries());

const startNew = () => {
  Object.assign(draft, emptyDraft());
  mode.value = 'edit';
};

const startEdit = (s: Sensor) => {
  Object.assign(draft, { id: s.id, code: s.code, name: s.name, kind: s.kind, pipe: s.pipe, unit: s.unit,
    node_id: s.node_id, line_id: s.line_id, active: s.active, note: s.note });
  mode.value = 'edit';
};

const save = async () => {
  saving.value = true;
  errorMessage.value = '';
  const body: SensorInput = {
    code: draft.code.trim(), name: draft.name.trim(), kind: draft.kind, pipe: draft.pipe, unit: draft.unit,
    node_id: draft.kind === 'flow' ? null : draft.node_id || null,
    line_id: draft.kind === 'flow' ? draft.line_id || null : null,
    active: draft.active, note: draft.note,
  };
  try {
    const saved = draft.id ? await fastApiService.updateSensor(draft.id, body) : await fastApiService.createSensor(body);
    await load();
    select(saved);
    notify.showSuccess(`Датчик «${saved.name}» сохранён`);
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Датчик не сохранён');
  } finally {
    saving.value = false;
  }
};

const remove = async () => {
  if (!draft.id) return;
  const ok = await confirmAction({
    text: `Удалить датчик «${draft.name}» вместе со всеми его показаниями?`,
    action: 'Удалить',
    color: 'error',
  });
  if (!ok) return;
  try {
    const res = await fastApiService.deleteSensor(draft.id);
    notify.showSuccess(`Датчик удалён, показаний: ${res.readings_deleted}`);
    selectedId.value = null;
    mode.value = 'view';
    await load();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Датчик не удалён');
  }
};

const onImport = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  importing.value = true;
  errorMessage.value = '';
  try {
    importResult.value = await fastApiService.importTelemetry(file);
    await load();
    if (selected.value) void loadSeries();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Выгрузка не загружена');
  } finally {
    importing.value = false;
  }
};

const showOnMap = async () => {
  try {
    const fc = await fastApiService.getSensorsGeojson();
    fc.features.forEach((f) => {
      const st = (f.properties?.status ?? 'no_model') as keyof typeof STATUS_META;
      if (f.properties) f.properties.color = STATUS_META[st]?.color ?? STATUS_META.no_model.color;
    });
    emit('show-on-map', fc);
    overlay.markShown();
  } catch (err: unknown) {
    errorMessage.value = formatApiError(err, 'Датчики на карту не загрузились');
  }
};

const flyTo = (s: Sensor) => {
  if (s.lon == null || s.lat == null) return;
  mapStore.map?.flyTo({ center: [s.lon, s.lat], zoom: Math.max(mapStore.map.getZoom(), 16) });
};

let timer: ReturnType<typeof setInterval> | null = null;
watch(visible, (open) => {
  if (timer) clearInterval(timer);
  timer = null;
  if (!open) return;
  void load();
  // новые показания приходят от шлюза каждую минуту — список свежий, пока окно открыто
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void load();
  }, REFRESH_MS);
}, { immediate: true });
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const openDialog = () => {
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped>
.tm-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-2, 8px); }
.tm-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-4, 16px); }
.tm-table tbody tr { cursor: pointer; }
/* длинные названия не выталкивают колонки факта и расхождения за край */
.tm-table :deep(table) { table-layout: fixed; }
.tm-table :deep(th:nth-child(2)) { width: 120px; }
.tm-table :deep(th:nth-child(3)) { width: 104px; }
.tm-table td:first-child .text-truncate, .tm-table td:first-child .text-caption { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-row--active { background: rgba(var(--v-theme-primary), 0.08); }
.tm-cal { font-size: var(--text-sm, 0.8125rem); }
.tm-cal__text { white-space: normal; max-width: 280px; }
.tm-alert { font-size: var(--text-sm, 0.8125rem); }
.tm-alert__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.tm-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2, 8px); }
@media (max-width: 900px) {
  .tm-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
