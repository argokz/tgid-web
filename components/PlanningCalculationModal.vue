<template>
  <v-dialog
    v-model="isOpen"
    :max-width="mobile ? undefined : 820"
    :fullscreen="mobile"
    scrollable
    persistent
    :transition="mobile ? 'dialog-bottom-transition' : 'dialog-transition'"
  >
    <v-card
      :rounded="mobile ? '0' : undefined"
      :class="{ 'calc-form--stacked': mobile }"
    >
      <v-card-title class="primary-text d-flex align-center flex-wrap py-2 gap-1">
        <v-icon class="mr-2">
          mdi-cog
        </v-icon>
        {{ dialogTitle }}
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-format-list-text"
          @click="calculationsOpen = true"
        >
          Расчёты
        </v-btn>
        <v-btn
          icon
          density="compact"
          aria-label="Закрыть"
          @click="close"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pt-2 pb-0">
        <v-form ref="form">
          <!-- Режим запуска (десктоп: Плановый / Фактический(аварийный) / … по списку) -->
          <v-btn-toggle
            v-model="runKind"
            mandatory
            color="primary"
            density="compact"
            variant="outlined"
            divided
            class="mb-3 flex-wrap"
          >
            <v-btn value="normal">
              Обычный
            </v-btn>
            <v-btn value="list">
              По списку
            </v-btn>
            <v-btn value="emergency">
              Аварийный
            </v-btn>
          </v-btn-toggle>

          <v-select
            v-if="runKind === 'list'"
            v-model="listMode"
            :items="listModeOptions"
            item-title="label"
            item-value="value"
            label="Тип расчёта для фрагментов списка"
            variant="outlined"
            density="compact"
            class="mb-3"
            hide-details
          />

          <p
            v-if="calcMode === 'emergency'"
            class="text-caption text-medium-emphasis mb-3"
          >
            Аварийный (фактический) режим: sety запускается без -dross — потребители считаются
            гидравлическими трактами (дроссели, элеваторы, приборы), состояние сети — текущее
            состояние объектов в БД (закрытые задвижки и т.п.).
          </p>

          <!-- Наименование расчёта -->
          <p class="text-subtitle-2 mb-1">
            Наименование расчёта
          </p>
          <v-text-field
            v-model="calculationName"
            variant="outlined"
            density="compact"
            class="mb-3"
            hide-details
            maxlength="200"
          />

          <p class="text-subtitle-2 mb-1">
            {{ runKind === 'list' ? 'Фрагменты для расчёта (по очереди)' : 'Фрагмент для расчёта' }}
          </p>
          <v-autocomplete
            v-if="runKind === 'list'"
            v-model="selectedFragmentIds"
            :items="fragmentItems"
            item-title="name"
            item-value="id"
            :filter-keys="FRAGMENT_FILTER_KEYS"
            multiple
            chips
            closable-chips
            variant="outlined"
            density="compact"
            placeholder="Выберите фрагменты"
            :error="fragmentError"
            :error-messages="fragmentError ? 'Выберите хотя бы два фрагмента' : undefined"
            class="mb-2"
          />
          <v-autocomplete
            v-else
            v-model="selectedFragmentId"
            :items="fragmentItems"
            item-title="name"
            item-value="id"
            :filter-keys="FRAGMENT_FILTER_KEYS"
            variant="outlined"
            density="compact"
            placeholder="Выберите фрагмент"
            :error="fragmentError"
            :error-messages="fragmentError ? 'Необходимо выбрать фрагмент для расчёта' : undefined"
            class="mb-2"
          />

          <!-- Плановый режим (Param1Dialog) -->
          <template v-if="calcMode === 'plan'">
            <p class="text-subtitle-2 mb-1">
              Расчётные расходы потребителей
            </p>
            <v-radio-group
              v-model="consumptionType"
              :inline="!mobile"
              class="my-0"
              density="compact"
              hide-details
            >
              <v-radio
                value="specific"
                label="По удельным расходам"
              />
              <v-radio
                value="temperature"
                label="По температурному графику"
              />
            </v-radio-group>

            <div class="d-flex flex-wrap mt-2 calc-form-row">
              <div class="w-50 pr-2 calc-form-col">
                <v-checkbox
                  v-model="considerHeatLoss"
                  label="С учетом тепловых потерь в сети"
                  density="compact"
                  hide-details
                  :disabled="!isTemperatureMode"
                />
                <v-checkbox
                  v-model="considerMixingCoefficients"
                  label="С учетом рассчитанных коэффициентов смешения"
                  density="compact"
                  hide-details
                  :disabled="!isTemperatureMode"
                />
                <v-checkbox
                  v-model="considerInternalHeat"
                  label="С учетом внутренних тепловыделений"
                  density="compact"
                  hide-details
                />
              </div>

              <div class="w-50 pl-2 calc-form-col">
                <p class="text-subtitle-2 mb-1 mt-1">
                  Температура расчёта тепловых потерь
                </p>
                <v-select
                  v-model="heatLossTemperature"
                  :items="heatLossTemperatureOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </div>
            </div>
          </template>

          <!-- Аварийный / фактический режим (Param2Dialog) -->
          <template v-else>
            <p class="text-subtitle-2 mb-1">
              Гидравлическое сопротивление потребителей
            </p>
            <v-radio-group
              v-model="consumerResistance"
              :inline="!mobile"
              class="my-0"
              density="compact"
              hide-details
            >
              <v-radio
                value="detailed"
                label="Детализированное"
              />
              <v-radio
                value="equivalent"
                label="Эквивалентное"
                :disabled="summerMode"
              />
            </v-radio-group>
            <div class="d-flex flex-wrap calc-form-row">
              <div class="w-50 pr-2 calc-form-col">
                <v-checkbox
                  v-model="summerMode"
                  label="Летний режим"
                  density="compact"
                  hide-details
                />
              </div>
              <div class="w-50 pl-2 calc-form-col">
                <v-checkbox
                  v-model="saveSummerResistance"
                  label="Запись летних сопротивлений в обобщенный потребитель"
                  density="compact"
                  hide-details
                  :disabled="!summerMode || !canWriteSource"
                />
              </div>
            </div>
          </template>

          <!-- Общие -->
          <div class="d-flex flex-wrap mt-2 calc-form-row">
            <div class="w-50 pr-2 calc-form-col">
              <p class="text-subtitle-2 mb-1 mt-1">
                Температура наружного воздуха, °C
              </p>
              <div class="d-flex align-center flex-wrap ga-2">
                <v-text-field
                  v-model="outdoorTemperature"
                  variant="outlined"
                  density="compact"
                  type="number"
                  class="flex-grow-1"
                  style="min-width: 120px;"
                  :error="tnError"
                  :hint="tnHint"
                  :persistent-hint="!!tnHint"
                  :hide-details="!tnHint"
                  @update:model-value="tnError = false"
                />
                <v-checkbox
                  v-if="calcMode === 'plan'"
                  v-model="considerWind"
                  label="Учитывать ветер"
                  density="compact"
                  hide-details
                />
              </div>
              <template v-if="calcMode === 'plan'">
                <v-checkbox
                  v-model="calculateThrottleValves"
                  label="Расчёт дроссельных органов и запись сопротивлений"
                  density="compact"
                  hide-details
                  :disabled="!canWriteSource"
                />
                <v-checkbox
                  v-model="recordMixingCoefficients"
                  label="Запись коэффициентов смешения"
                  density="compact"
                  hide-details
                  :disabled="!isTemperatureMode || !canWriteSource"
                />
              </template>
              <v-checkbox
                v-model="networkQuantitativeCharacteristics"
                label="Количественные характеристики сети"
                density="compact"
                hide-details
              />
            </div>

            <div class="w-50 pl-2 calc-form-col">
              <p class="text-subtitle-2 mb-1">
                Расчётный перепад напора:
              </p>
              <v-checkbox
                v-model="mainFragment"
                label="Магистральный фрагмент"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-if="calcMode === 'plan'"
                v-model="recordHeatLoadLoss"
                label="Запись тепловых нагрузок и потерь в обобщенный потребитель"
                density="compact"
                hide-details
                :disabled="!canWriteSource"
              />
              <v-checkbox
                v-model="considerVariationCoefficients"
                label="С учетом коэффициентов вариации"
                density="compact"
                hide-details
              />
            </div>
          </div>

          <v-alert
            v-if="savePoRequested"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ SAVE_PO_WARNING }}
          </v-alert>
          <p
            v-if="!canWriteSource"
            class="text-caption text-medium-emphasis mt-2 mb-0"
          >
            Запись в исходные данные (сопротивления, коэффициенты смешения, нагрузки обобщённых
            потребителей) выключена: нужна роль calculator или выше и MUTATIONS_ENABLED=true на сервере.
          </p>
        </v-form>
      </v-card-text>

      <v-card-actions
        class="pa-3 d-flex flex-wrap gap-2"
        :class="mobile ? 'flex-column-reverse' : 'justify-end'"
      >
        <v-btn
          variant="outlined"
          min-width="100"
          density="comfortable"
          :block="mobile"
          @click="close"
        >
          Отмена
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          min-width="100"
          density="comfortable"
          :block="mobile"
          :loading="calculating"
          @click="calculate"
        >
          Расчёт
        </v-btn>
      </v-card-actions>
    </v-card>

    <CalculationsDialog v-model="calculationsOpen" />

    <!-- -save_po: подтверждение перезаписи нагрузок обобщённых потребителей -->
    <v-dialog
      v-model="savePoConfirmOpen"
      max-width="560"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon
            color="warning"
            class="mr-2"
          >
            mdi-alert
          </v-icon>
          Запись нагрузок в обобщённые потребители
        </v-card-title>
        <v-card-text>
          <p class="mb-2">
            {{ SAVE_PO_WARNING }}
          </p>
          <p class="mb-0">
            Старые значения останутся только в истории правок. Продолжить расчёт с записью?
          </p>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn
            variant="text"
            @click="answerSavePo(false)"
          >
            Отмена
          </v-btn>
          <v-btn
            color="warning"
            variant="flat"
            @click="answerSavePo(true)"
          >
            Записать и рассчитать
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { formatApiErrorWith } from '~/utils/apiError';
import { ref, computed, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import CalculationsDialog from '~/components/CalculationsDialog.vue';
import { useAuthStore } from '~/stores/authStore';
import { requestSavesPo } from '~/utils/permissions';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useLayerStore } from '~/stores/layerStore';
import { fastApiService, type SetyCalcMode, type SetyRunRequest } from '~/services/fastApiService';
import { tnRangeHint, tnValidationError, type TnRange } from '~/utils/calcTemperature';

type RunKind = 'normal' | 'list' | 'emergency';

const heatLossTemperatureOptions = [
  { label: 'расчётная tн отопл', value: 0 },
  { label: 'среднесезонная tн от.периода', value: 1 },
  { label: 'Текущая tн', value: 2 }
];

const listModeOptions = [
  { label: 'Плановый', value: 'plan' },
  { label: 'Аварийный (фактический)', value: 'emergency' },
];

const fragmentStore = useFragmentStore();
const fragments = computed(() => fragmentStore.getFragments);
/** Фрагмент ищется и по имени, и по id (QA F32) */
const FRAGMENT_FILTER_KEYS = ['title', 'value'];
const fragmentItems = computed(() =>
  fragments.value.map(f => ({ id: Number(f.id), name: f.name ?? `Фрагмент ${f.id}` })));

const { isMobile: mobile } = useMobile();

const runKind = ref<RunKind>('normal');
const listMode = ref<SetyCalcMode>('plan');
const calcMode = computed<SetyCalcMode>(() => {
  if (runKind.value === 'emergency') return 'emergency';
  if (runKind.value === 'list') return listMode.value;
  return 'plan';
});

const selectedFragmentId = ref<number | null>(null);
const selectedFragmentIds = ref<number[]>([]);
const fragmentError = ref(false);
const tnError = ref(false);
const calculating = ref(false);
const calculationsOpen = ref(false);

const props = defineProps<{
  modelValue: boolean
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'calculate': []
  'protocol-log': [{ timestamp: string; message: string; type: string; html: boolean }]
  'show-protocol': [value: boolean]
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const dialogTitle = computed(() => (calcMode.value === 'plan'
  ? 'Установки расчёта планового режима'
  : 'Установки расчёта аварийного (фактического) режима'));

function defaultCalculationName() {
  const stamp = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '');
  return calcMode.value === 'plan'
    ? `Расчёт планового режима ${stamp}`
    : `Расчёт аварийного режима ${stamp}`;
}

const calculationName = ref(defaultCalculationName());

/** Диапазон Tн из «Системы теплоснабжения»: умолчание формы = t_or (у Алматы -25, а не -32) */
const tnRange = ref<TnRange | null>(null);
const tnHint = computed(() => (summerActive.value ? '' : tnRangeHint(tnRange.value)));
let tnAutoValue = '-32';
const loadTnRange = async () => {
  try {
    const range = await fastApiService.getCalculationTemperatureRange();
    tnRange.value = range;
    if (range.t_or !== null && outdoorTemperature.value === tnAutoValue) {
      tnAutoValue = String(range.t_or);
      outdoorTemperature.value = tnAutoValue;
    }
  } catch {
    tnRange.value = null; // проверит сервер при запуске
  }
};

watch(isOpen, (val) => {
  if (!val) return;
  calculationName.value = defaultCalculationName();
  void loadTnRange();
  if (!fragments.value.length) void fragmentStore.loadFragments();
  if (selectedFragmentId.value === null && fragmentStore.selectedFragmentId !== null) {
    selectedFragmentId.value = fragmentStore.selectedFragmentId;
  }
});

watch(calcMode, () => {
  // имя по умолчанию следует за режимом, пока пользователь его не менял
  if (/^Расчёт (планового|аварийного) режима /.test(calculationName.value)) {
    calculationName.value = defaultCalculationName();
  }
});

// Состояние формы — плановый
const consumptionType = ref('specific');
const considerHeatLoss = ref(true);
const considerMixingCoefficients = ref(false);
const considerInternalHeat = ref(true);
const heatLossTemperature = ref(0);
const considerWind = ref(false);
const calculateThrottleValves = ref(false);
const recordMixingCoefficients = ref(false);
const recordHeatLoadLoss = ref(false);
// аварийный (десктоп по умолчанию — эквивалентное сопротивление)
const consumerResistance = ref<'detailed' | 'equivalent'>('equivalent');
const summerMode = ref(false);
const saveSummerResistance = ref(false);
// общие
const outdoorTemperature = ref('-32');
const networkQuantitativeCharacteristics = ref(false);
const mainFragment = ref(false);
const considerVariationCoefficients = ref(true);

const summerActive = computed(() => calcMode.value === 'emergency' && summerMode.value);

const isTemperatureMode = computed(() => consumptionType.value === 'temperature');

/** Флаги записи в исходные таблицы: роль calculator+ и MUTATIONS_ENABLED (сервер вернёт 503) */
const authStore = useAuthStore();
const canWriteSource = computed(() => authStore.canRunWritingCalc);
watch(canWriteSource, (allowed) => {
  if (allowed) return;
  calculateThrottleValves.value = false;
  recordMixingCoefficients.value = false;
  recordHeatLoadLoss.value = false;
  saveSummerResistance.value = false;
});

const SAVE_PO_WARNING =
  'Во фрагменте с обобщёнными потребителями sety перезапишет нагрузки магистрали нулями '
  + '(так же работает десктоп, см. docs/acceptance-numeric.md). Включайте запись только для '
  + 'фрагментов с реальными потребителями.';
const savePoRequested = computed(() => requestSavesPo({
  save_po: calcMode.value === 'plan' && recordHeatLoadLoss.value,
  save_leto: calcMode.value !== 'plan' && summerMode.value && saveSummerResistance.value,
}));
const savePoConfirmOpen = ref(false);
let savePoResolve: ((ok: boolean) => void) | null = null;
const askSavePoConfirm = () => new Promise<boolean>((resolve) => {
  savePoResolve = resolve;
  savePoConfirmOpen.value = true;
});
const answerSavePo = (ok: boolean) => {
  const resolve = savePoResolve;
  savePoResolve = null;
  savePoConfirmOpen.value = false;
  resolve?.(ok);
};
// Закрыли окно подтверждения кликом мимо / Esc — это отказ
watch(savePoConfirmOpen, (open) => {
  if (!open && savePoResolve) answerSavePo(false);
});

watch(summerMode, (on) => {
  // Param2Dialog: летний режим — только детализированное сопротивление
  if (on) consumerResistance.value = 'detailed';
  else saveSummerResistance.value = false;
});

const form = ref();

const close = () => {
  isOpen.value = false;
};

const addProtocolLog = (message: string, type: string = 'info', html = false) => {
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  emit('protocol-log', { timestamp, message, type, html });
};

const buildRequest = (fragmentIds: number[], tn: number): SetyRunRequest => {
  const base: SetyRunRequest = {
    mode: calcMode.value,
    fragment_ids: fragmentIds,
    name: calculationName.value.trim() || undefined,
    tn,
    char_sety: networkQuantitativeCharacteristics.value,
    mag_fragment: mainFragment.value,
    use_kv: considerVariationCoefficients.value,
  };
  if (calcMode.value === 'plan') {
    const tg = isTemperatureMode.value;
    return {
      ...base,
      tg,
      teplopoter: tg ? considerHeatLoss.value : true,
      uf_calc: tg && considerMixingCoefficients.value,
      save_uf_new: canWriteSource.value && tg && recordMixingCoefficients.value,
      teplovyd: considerInternalHeat.value,
      dross_yes: canWriteSource.value && calculateThrottleValves.value,
      save_po: canWriteSource.value && recordHeatLoadLoss.value,
      veter: considerWind.value,
      trtp: heatLossTemperature.value,
    };
  }
  return {
    ...base,
    consumer_resistance: summerMode.value ? 'detailed' : consumerResistance.value,
    leto: summerMode.value,
    save_leto: canWriteSource.value && summerMode.value && saveSummerResistance.value,
  };
};

const pollTask = async (taskId: string) => {
  let lastStatus = '';
  let lastProgress = '';
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusResponse = await fastApiService.getTaskStatus(taskId);

    if (statusResponse.status !== lastStatus) {
      lastStatus = statusResponse.status;
      addProtocolLog(`Статус: ${lastStatus}`, 'info');
    }
    const progress = statusResponse.meta?.message;
    if (progress && progress !== lastProgress) {
      lastProgress = progress;
      addProtocolLog(progress, 'info');
    }

    if (statusResponse.status === 'SUCCESS') {
      const finalResult = statusResponse.result || {};
      const ok = finalResult.status === 'success';
      addProtocolLog(finalResult.message || 'Расчёт окончен', ok ? 'success' : 'error');
      if (finalResult.output) addProtocolLog(finalResult.output, ok ? 'success' : 'info', true);
      if (finalResult.error) addProtocolLog(finalResult.error, 'error', true);
      const layerStore = useLayerStore();
      layerStore.visibleGeoServerLayers.forEach(id => layerStore.refreshLayerSource(id));
      return;
    }
    if (statusResponse.status === 'FAILURE') {
      addProtocolLog('Ошибка при выполнении расчёта на сервере', 'error');
      if (statusResponse.error) addProtocolLog(statusResponse.error, 'error', true);
      return;
    }
  }
};

const calculate = async () => {
  emit('show-protocol', true);

  const fragmentIds = runKind.value === 'list'
    ? [...selectedFragmentIds.value]
    : (selectedFragmentId.value !== null ? [selectedFragmentId.value] : []);
  fragmentError.value = runKind.value === 'list' ? fragmentIds.length < 2 : fragmentIds.length === 0;
  const tn = Number(outdoorTemperature.value);
  const tnMessage = tnValidationError(outdoorTemperature.value, tnRange.value, summerActive.value);
  tnError.value = tnMessage !== null;
  if (fragmentError.value || tnMessage) {
    addProtocolLog(fragmentError.value
      ? 'Ошибка: необходимо выбрать фрагмент(ы) для расчёта'
      : `Ошибка: ${tnMessage}`, 'error');
    return;
  }

  const body = buildRequest(fragmentIds, tn);
  if (requestSavesPo(body) && !(await askSavePoConfirm())) {
    addProtocolLog('Расчёт не запущен: запись нагрузок в обобщённые потребители не подтверждена', 'info');
    return;
  }

  isOpen.value = false;
  addProtocolLog('Отправка запроса на расчёт...', 'info');

  calculating.value = true;
  try {
    const result = await fastApiService.runSetyMode(body);
    if (!result.task_id) {
      addProtocolLog(result.message || 'Ошибка: сервер не вернул ID задачи', 'error');
      return;
    }
    addProtocolLog(`Параметры: ${result.params}`, 'info');
    addProtocolLog(result.message || 'Задача добавлена в очередь', 'success');
    addProtocolLog(`Task ID: ${result.task_id}`, 'info');
    await pollTask(result.task_id);
  } catch (error: any) {
    addProtocolLog('Ошибка при связи с сервером', 'error');
    addProtocolLog(formatApiErrorWith('Детали ошибки', error), 'error');
  } finally {
    calculating.value = false;
  }
  emit('calculate');
};
</script>

<style scoped>
.w-50 {
  width: 50%;
}

.calc-form--stacked .calc-form-col.w-50 {
  width: 100%;
  padding-left: 0 !important;
  padding-right: 0 !important;
}
</style>
