<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="950" scrollable>
    <v-card rounded="lg" class="throttling-dialog">
      <v-card-title class="d-flex align-center ga-2 bg-surface-variant py-3 px-4">
        <v-icon color="teal-darken-3" size="24">mdi-calculator-variant</v-icon>
        <span class="text-h6 font-weight-bold">Калькулятор дросселирования (Шайбы и Элеваторы)</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="visible = false" />
      </v-card-title>

      <v-card-text class="pa-4">
        <v-tabs v-model="activeTab" density="compact" color="primary" class="mb-4">
          <v-tab value="orifice">
            <v-icon start size="18">mdi-circle-slice-8</v-icon>
            Дроссельная шайба
          </v-tab>
          <v-tab value="elevator">
            <v-icon start size="18">mdi-elevator</v-icon>
            Сопло и элеватор
          </v-tab>
          <v-tab value="excel">
            <v-icon start size="18">mdi-file-excel</v-icon>
            Официальный бланк (Excel)
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <!-- 1. Дроссельная шайба -->
          <v-window-item value="orifice">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-card variant="outlined" class="pa-4 rounded-lg h-100">
                  <div class="text-subtitle-1 font-weight-bold mb-3">Параметры ввода</div>

                  <v-select
                    v-model="orificeForm.scheme"
                    :items="schemeOptions"
                    item-title="title"
                    item-value="value"
                    label="Схема установки шайбы"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />

                  <div class="d-flex ga-2 mb-3">
                    <v-text-field
                      v-model.number="orificeForm.p1"
                      label="P1 (подача), атм"
                      type="number"
                      density="compact"
                      variant="outlined"
                      step="0.1"
                      hide-details
                    />
                    <v-text-field
                      v-model.number="orificeForm.p2"
                      label="P2 (обратка), атм"
                      type="number"
                      density="compact"
                      variant="outlined"
                      step="0.1"
                      hide-details
                    />
                  </div>

                  <v-text-field
                    v-model.number="orificeForm.deltaH"
                    label="Располагаемый напор ΔH, м.в.ст"
                    type="number"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    step="0.5"
                    hide-details
                  />

                  <v-radio-group v-model="orificeForm.flowMode" inline density="compact" class="mb-2">
                    <v-radio label="Задать расход G (т/ч)" value="flow" />
                    <v-radio label="Рассчитать из нагрузки Q" value="load" />
                  </v-radio-group>

                  <v-text-field
                    v-if="orificeForm.flowMode === 'flow'"
                    v-model.number="orificeForm.flowG"
                    label="Расход сетевой воды G, т/ч"
                    type="number"
                    density="compact"
                    variant="outlined"
                    step="0.1"
                    hide-details
                  />

                  <div v-else class="d-flex flex-column ga-2">
                    <v-text-field
                      v-model.number="orificeForm.qLoad"
                      label="Тепловая нагрузка Q, Гкал/ч"
                      type="number"
                      density="compact"
                      variant="outlined"
                      step="0.05"
                      hide-details
                    />
                    <div class="d-flex ga-2">
                      <v-text-field
                        v-model.number="orificeForm.tSupply"
                        label="T1 (подача), °C"
                        type="number"
                        density="compact"
                        variant="outlined"
                        hide-details
                      />
                      <v-text-field
                        v-model.number="orificeForm.tReturn"
                        label="T2 (обратка), °C"
                        type="number"
                        density="compact"
                        variant="outlined"
                        hide-details
                      />
                    </div>
                  </div>

                  <v-btn
                    color="primary"
                    block
                    class="mt-4"
                    prepend-icon="mdi-calculator"
                    :loading="loadingOrifice"
                    @click="calcOrifice"
                  >
                    Рассчитать диаметр шайбы
                  </v-btn>
                </v-card>
              </v-col>

              <v-col cols="12" md="6">
                <v-card variant="tonal" color="teal-darken-4" class="pa-4 rounded-lg h-100 text-center d-flex flex-column justify-center align-center">
                  <div class="text-subtitle-1 font-weight-medium">Рассчитанный диаметр шайбы</div>
                  <div
                    class="font-weight-bold text-teal my-3"
                    :class="orificeResult && orificeResult.diameter_orifice_mm == null ? 'text-h5' : 'text-h2'"
                  >
                    {{ orificeDiameterText }}
                  </div>
                  <div v-if="orificeResult?.recommended_standard_diameter != null" class="text-body-2 text-medium-emphasis">
                    Рекомендуемый стандартный: <span class="font-weight-bold">{{ orificeResult.recommended_standard_diameter }} мм</span>
                  </div>
                  <v-alert
                    v-if="orificeResult?.warning"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mt-3 text-left w-100"
                  >
                    {{ orificeResult.warning }}
                  </v-alert>

                  <v-divider class="my-4 w-100" />

                  <div v-if="orificeResult" class="w-100 text-left px-4">
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Расход G:</span>
                      <span class="font-weight-bold">{{ orificeResult.flow_g }} т/ч</span>
                    </div>
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Располагаемый напор Hрас:</span>
                      <span class="font-weight-bold">{{ orificeResult.available_head_m }} м</span>
                    </div>
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Гасимый напор Hгас:</span>
                      <span class="font-weight-bold">{{ orificeResult.head_loss_dissipated }} м</span>
                    </div>
                    <div class="text-caption text-medium-emphasis mt-2">
                      Формула бланка dross: d = {{ orificeResult.scheme === 'nozzle' ? '9.6' : '10' }} · (G² / Hгас)¼, не менее 3 мм
                    </div>
                  </div>
                  <div v-else class="text-medium-emphasis">
                    Заполните параметры слева и нажмите «Рассчитать»
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- 2. Сопло и элеватор -->
          <v-window-item value="elevator">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-card variant="outlined" class="pa-4 rounded-lg h-100">
                  <div class="text-subtitle-1 font-weight-bold mb-3">Параметры элеваторного узла</div>

                  <div class="d-flex ga-2 mb-3">
                    <v-text-field
                      v-model.number="elevatorForm.p1"
                      label="P1 (подача), атм"
                      type="number"
                      density="compact"
                      variant="outlined"
                      step="0.1"
                      hide-details
                    />
                    <v-text-field
                      v-model.number="elevatorForm.p2"
                      label="P2 (обратка), атм"
                      type="number"
                      density="compact"
                      variant="outlined"
                      step="0.1"
                      hide-details
                    />
                  </div>

                  <v-text-field
                    v-model.number="elevatorForm.qHeating"
                    label="Нагрузка отопления Qот, Гкал/ч"
                    type="number"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    step="0.05"
                    hide-details
                  />

                  <div class="d-flex ga-2 mb-3">
                    <v-text-field
                      v-model.number="elevatorForm.t1"
                      label="T1 (сеть), °C"
                      type="number"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                    <v-text-field
                      v-model.number="elevatorForm.t2"
                      label="T2 (обратка), °C"
                      type="number"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                    <v-text-field
                      v-model.number="elevatorForm.t3"
                      label="T3 (система), °C"
                      type="number"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                  </div>

                  <v-text-field
                    v-model.number="elevatorForm.deltaHSystem"
                    label="Сопротивление СО Hc, м.в.ст"
                    type="number"
                    density="compact"
                    variant="outlined"
                    step="0.1"
                    hide-details
                  />

                  <v-btn
                    color="primary"
                    block
                    class="mt-4"
                    prepend-icon="mdi-calculator"
                    :loading="loadingElevator"
                    @click="calcElevator"
                  >
                    Рассчитать сопло и элеватор
                  </v-btn>
                </v-card>
              </v-col>

              <v-col cols="12" md="6">
                <v-card variant="tonal" color="indigo-darken-4" class="pa-4 rounded-lg h-100 text-center d-flex flex-column justify-center align-center">
                  <div class="text-subtitle-1 font-weight-medium">Рекомендуемый типоразмер</div>
                  <div class="text-h2 font-weight-bold text-indigo my-2">
                    {{ elevatorResult ? `Элеватор №${elevatorResult.elevator_number}` : '—' }}
                  </div>

                  <v-divider class="my-3 w-100" />

                  <div v-if="elevatorResult" class="w-100 text-left px-4">
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Диаметр сопла (Dс):</span>
                      <span class="font-weight-bold text-h6 text-primary">{{ elevatorResult.nozzle_diameter_mm }} мм</span>
                    </div>
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Диаметр горловины (Dгор):</span>
                      <span class="font-weight-bold text-h6">{{ elevatorResult.mixing_chamber_diameter_mm }} мм</span>
                    </div>
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Коэффициент смешения (u):</span>
                      <span class="font-weight-bold">{{ elevatorResult.mixing_ratio_u }}</span>
                    </div>
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Располагаемый напор Hрас:</span>
                      <span class="font-weight-bold">{{ elevatorResult.available_head_m }} м</span>
                    </div>
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Требуемый напор ≈ 1.4·hс·(1+u)²:</span>
                      <span class="font-weight-bold">{{ elevatorResult.required_head_m }} м</span>
                    </div>
                    <div class="d-flex justify-space-between py-1">
                      <span class="text-medium-emphasis">Расход сетевой воды:</span>
                      <span class="font-weight-bold">{{ elevatorResult.flow_g }} т/ч</span>
                    </div>
                    <v-alert
                      v-for="(w, i) in elevatorResult.warnings"
                      :key="i"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mt-2"
                    >
                      {{ w }}
                    </v-alert>
                  </div>
                  <div v-else class="text-medium-emphasis">
                    Заполните параметры и нажмите кнопку расчета
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- 3. Официальный бланк Excel -->
          <v-window-item value="excel">
            <v-card variant="outlined" class="pa-4 rounded-lg">
              <div class="text-subtitle-1 font-weight-bold mb-3">
                Формирование официального бланка расчета теплового ввода
              </div>
              <p class="text-body-2 text-medium-emphasis mb-4">
                Расчётный лист дроссельных диафрагм и сопла элеватора по форме десктопного бланка (dross) в формате Excel (.xlsx).
                Давления, нагрузка отопления и температуры берутся с вкладки «Сопло и элеватор».
              </p>

              <v-row dense>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="excelForm.district"
                    label="Эксплуатационный район (РЭТ)"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="excelForm.siteName"
                    label="Участок / Номер ТК"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="excelForm.consumerName"
                    label="Наименование потребителя"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="excelForm.address"
                    label="Адрес объекта"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="excelForm.qVent"
                    label="Нагрузка вентиляции Qв, Гкал/ч"
                    type="number"
                    step="0.01"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="excelForm.qGvsMax"
                    label="Нагрузка ГВС максимальная, Гкал/ч"
                    type="number"
                    step="0.01"
                    density="compact"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                </v-col>
                <v-col v-for="(signer, i) in excelForm.signers" :key="i" cols="12" sm="6">
                  <div class="d-flex ga-2 mb-3">
                    <v-text-field
                      v-model="signer.position"
                      :label="`Подпись ${i + 1}: должность`"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                    <v-text-field
                      v-model="signer.name"
                      label="ФИО"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                  </div>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="excelForm.organization"
                    label="Организация (строка под подписями)"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>
              </v-row>

              <div class="d-flex justify-end mt-4">
                <v-btn
                  color="success"
                  size="large"
                  prepend-icon="mdi-file-excel"
                  :loading="loadingExcel"
                  @click="downloadExcelSheet"
                >
                  Сформировать и скачать Excel (.xlsx)
                </v-btn>
              </div>
            </v-card>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-4 py-2">
        <v-spacer />
        <v-btn variant="text" @click="visible = false">Закрыть</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useMobile } from '~/composables/useMobile';
import { useNotificationStore } from '~/stores/notificationStore';
import {
  fastApiService,
  type ElevatorNozzleResult,
  type OrificePlateParams,
  type OrificePlateResult,
  type OrificeScheme,
  type ThrottlingSheetParams,
} from '~/services/fastApiService';

const visible = defineModel<boolean>({ default: false });
const { isMobile } = useMobile();

const activeTab = ref('orifice');
const loadingOrifice = ref(false);
const loadingElevator = ref(false);
const loadingExcel = ref(false);

const notificationStore = useNotificationStore();

const schemeOptions: { title: string; value: OrificeScheme }[] = [
  { title: 'Безэлеваторный ввод (Hгас = ΔH − 5)', value: 'bezelevator' },
  { title: 'Перед насосами смешения (Hгас = ΔH − 2)', value: 'pump_mix' },
  { title: 'Перед соплом элеватора (Hгас = ΔH, при Hгас > 35 м)', value: 'pre_nozzle' },
  { title: 'Сопло элеватора (коэффициент 9.6, ΔH)', value: 'nozzle' },
  { title: 'На вентиляцию (Hгас = ΔH − 5)', value: 'ventilation' },
  { title: 'Перед водоводяным подогревателем (Hгас = ΔH − 5)', value: 'heater' },
  { title: 'На циркуляционную линию ГВС (Hгас = ΔH − 5)', value: 'gvs_circulation' },
];

const orificeForm = reactive({
  scheme: 'bezelevator' as OrificeScheme,
  p1: 6.0,
  p2: 4.0,
  deltaH: 20.0,
  flowMode: 'flow' as 'flow' | 'load',
  flowG: 12.5,
  qLoad: 0.8,
  tSupply: 130.0,
  tReturn: 70.0,
});

const elevatorForm = reactive({
  p1: 6.0,
  p2: 4.0,
  qHeating: 0.8,
  t1: 130.0,
  t2: 70.0,
  t3: 95.0,
  deltaHSystem: 1.5,
});

const excelForm = reactive({
  district: '',
  siteName: '',
  consumerName: '',
  address: '',
  qVent: 0,
  qGvsMax: 0,
  signers: [
    { position: '', name: '' },
    { position: '', name: '' },
  ],
  organization: '',
});

const orificeResult = ref<OrificePlateResult | null>(null);
const elevatorResult = ref<ElevatorNozzleResult | null>(null);

const orificeDiameterText = computed(() => {
  if (!orificeResult.value) return '—';
  const d = orificeResult.value.diameter_orifice_mm;
  return d == null ? 'не рассчитывается' : `${d} мм`;
});

const reportError = (what: string, err: any) => {
  notificationStore.showError(`${what}: ${err?.message || 'ошибка сервера'}`);
};

watch(
  [() => orificeForm.p1, () => orificeForm.p2],
  ([p1, p2]) => {
    if (p1 !== undefined && p2 !== undefined) {
      orificeForm.deltaH = Math.max(0, Math.round((p1 - p2) * 10 * 10) / 10);
    }
  }
);

const calcOrifice = async () => {
  loadingOrifice.value = true;
  try {
    const payload: OrificePlateParams = {
      flow_g: orificeForm.flowMode === 'flow' ? orificeForm.flowG : undefined,
      delta_h: orificeForm.deltaH,
      p1: orificeForm.p1,
      p2: orificeForm.p2,
      q_heating_gcal: orificeForm.flowMode === 'load' ? orificeForm.qLoad : undefined,
      t_supply: orificeForm.tSupply,
      t_return: orificeForm.tReturn,
      scheme: orificeForm.scheme,
    };
    orificeResult.value = await fastApiService.calculateOrificePlate(payload);
  } catch (err: any) {
    orificeResult.value = null;
    reportError('Расчёт шайбы', err);
  } finally {
    loadingOrifice.value = false;
  }
};

const calcElevator = async () => {
  loadingElevator.value = true;
  try {
    const payload = {
      q_heating_gcal: elevatorForm.qHeating,
      p1: elevatorForm.p1,
      p2: elevatorForm.p2,
      t1: elevatorForm.t1,
      t2: elevatorForm.t2,
      t3: elevatorForm.t3,
      delta_h_system: elevatorForm.deltaHSystem,
    };
    elevatorResult.value = await fastApiService.calculateElevatorNozzle(payload);
  } catch (err: any) {
    elevatorResult.value = null;
    reportError('Расчёт элеватора', err);
  } finally {
    loadingElevator.value = false;
  }
};

const downloadExcelSheet = async () => {
  loadingExcel.value = true;
  try {
    const payload: ThrottlingSheetParams = {
      district: excelForm.district || undefined,
      site_name: excelForm.siteName || undefined,
      consumer_name: excelForm.consumerName || undefined,
      address: excelForm.address || undefined,
      p1: elevatorForm.p1,
      p2: elevatorForm.p2,
      q_heating_gcal: elevatorForm.qHeating,
      q_vent_gcal: excelForm.qVent || 0,
      q_gvs_gcal: excelForm.qGvsMax || 0,
      t1: elevatorForm.t1,
      t2: elevatorForm.t2,
      t3: elevatorForm.t3,
      signers: excelForm.signers.filter((sg) => sg.position || sg.name),
      organization: excelForm.organization || undefined,
    };
    const { blob, filename } = await fastApiService.downloadThrottlingSheet(payload);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    reportError('Бланк Excel', err);
  } finally {
    loadingExcel.value = false;
  }
};

const openDialog = (scope?: {
  p1?: number;
  p2?: number;
  flowG?: number;
  qHeating?: number;
  tab?: 'orifice' | 'elevator' | 'excel';
}) => {
  if (scope?.p1 !== undefined) {
    orificeForm.p1 = scope.p1;
    elevatorForm.p1 = scope.p1;
  }
  if (scope?.p2 !== undefined) {
    orificeForm.p2 = scope.p2;
    elevatorForm.p2 = scope.p2;
  }
  if (scope?.flowG !== undefined) {
    orificeForm.flowG = scope.flowG;
  }
  if (scope?.qHeating !== undefined) {
    orificeForm.qLoad = scope.qHeating;
    elevatorForm.qHeating = scope.qHeating;
  }
  if (scope?.tab) {
    activeTab.value = scope.tab;
  }
  visible.value = true;
  calcOrifice();
  calcElevator();
};

defineExpose({ openDialog });
</script>

<style scoped>
.throttling-dialog {
  max-height: 90vh;
}
</style>
