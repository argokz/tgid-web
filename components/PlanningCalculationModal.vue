<template>
  <v-dialog
    v-model="isOpen"
    :max-width="mobile ? undefined : 800"
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
          mdiCog
        </v-icon>
        Установки расчета планового режима
        <v-spacer />
        <v-btn
          icon
          density="compact"
          @click="close"
        >
          <v-icon>mdiClose</v-icon>
        </v-btn>
      </v-card-title>
      
      <v-card-text class="pt-4 pb-0">
        <v-form ref="form">
          <!-- Наименование расчета -->
          <p class="text-subtitle-2 mb-1">
            Наименование расчета
          </p>
          <v-text-field
            v-model="calculationName"
            placeholder="Расчет планового режима"
            variant="outlined"
            density="compact"
            class="mb-3"
            hide-details
          />
          
          <!-- Расчетные расходы потребителей -->
          <p class="text-subtitle-2 mb-1">
            Расчетные расходы потребителей
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
          
          <p class="text-subtitle-2 mb-1 mt-2">
            Активный фрагмент для расчета
          </p>
          <v-btn 
            variant="outlined" 
            class="mb-1" 
            :color="fragmentError ? 'error' : undefined"
            :class="{ 'error-border': fragmentError }"
            @click="fragmentSelectModal = true"
          >
            {{ selectedFragmentName }}
          </v-btn>
          <p
            v-if="fragmentError"
            class="text-caption text-error mb-2"
          >
            Необходимо выбрать фрагмент для расчета
          </p>
          
          <FragmentSelectModal
            v-model="fragmentSelectModal"
            :model-value-id="selectedFragmentId"
            @update:model-value-id="(val: number | null) => selectedFragmentId = val"
          />
          
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
              <!-- Температура расчета тепловых потерь -->
              <p class="text-subtitle-2 mb-1 mt-1">
                Температура расчета тепловых потерь
              </p>
              <div class="d-flex">
                <v-select
                  v-model="heatLossTemperature"
                  :items="heatLossTemperatureOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  class="mr-2"
                  hide-details
                />
              </div>
              
              <!-- Температура наружного воздуха -->
              <p class="text-subtitle-2 mb-1 mt-2">
                Температура наружного воздуха
              </p>
              <div class="d-flex align-center flex-wrap ga-2">
                <v-text-field
                  v-model="outdoorTemperature"
                  variant="outlined"
                  density="compact"
                  type="number"
                  class="flex-grow-1"
                  style="min-width: 120px;"
                  hide-details
                />
                <v-checkbox 
                  v-model="considerWind" 
                  label="Учитывать ветер"
                  density="compact"
                  hide-details
                />
              </div>
            </div>
          </div>
          
          <!-- Дополнительные опции -->
          <div class="d-flex flex-wrap mt-2 calc-form-row">
            <div class="w-50 pr-2 calc-form-col">
              <v-checkbox 
                v-model="calculateThrottleValves" 
                label="Расчет дроссельных органов и запись сопротивлений"
                density="compact"
                hide-details
              />
              
              <!-- <v-checkbox 
                v-model="calculateAutomatedConsumers" 
                label="Расчет автоматизированных потребителей"
                density="compact"
                hide-details
                :disabled="!isTemperatureMode"
              ></v-checkbox> -->
              
              <v-checkbox 
                v-model="recordMixingCoefficients" 
                label="Запись коэффициентов смешения"
                density="compact"
                hide-details
                :disabled="!isTemperatureMode"
              />
              
              <v-checkbox 
                v-model="networkQuantitativeCharacteristics" 
                label="Количественные характеристики сети"
                density="compact"
                hide-details
              />
            </div>
            
            <div class="w-50 pl-2 calc-form-col">
              <!-- Расчетный перепад напора -->
              <p class="text-subtitle-2 mb-1">
                Расчетный перепад напора:
              </p>
              <v-checkbox 
                v-model="mainFragment" 
                label="Магистральный фрагмент"
                density="compact"
                hide-details
              />
              
              <v-checkbox 
                v-model="recordHeatLoadLoss" 
                label="Запись тепловых нагрузок и потерь в обобщенный потребитель"
                density="compact"
                hide-details
              />
              
              <v-checkbox 
                v-model="considerVariationCoefficients" 
                label="С учетом коэффициентов вариации"
                density="compact"
                hide-details
              />
            </div>
          </div>
        </v-form>
      </v-card-text>
      
      <v-card-actions class="pa-3 d-flex flex-wrap gap-2" :class="mobile ? 'flex-column-reverse' : 'justify-end'">
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
          Расчет
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDisplay } from 'vuetify';
import FragmentSelectModal from '~/components/FragmentSelectModal.vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { useLayerStore } from '~/stores/layerStore';
import { fastApiService } from '~/services/fastApiService';

const heatLossTemperatureOptions = [
  { label: 'расчетная tн отопл', value: 0 },
  { label: 'среднесезонная tн от.периода', value: 1 },
  { label: 'Текущая tн', value: 2 }
];

const fragmentStore = useFragmentStore();
const fragments = computed(() => fragmentStore.getFragments);

const { mobile } = useDisplay();

const selectedFragmentId = ref<number | null>(null);
const fragmentSelectModal = ref(false);
const fragmentError = ref(false);
const calculating = ref(false);

const selectedFragmentName = computed(() => {
  if (selectedFragmentId.value === null) return 'Выбрать фрагмент';
  const frag = fragments.value.find(f => f.id === selectedFragmentId.value);
  return frag?.name ?? 'Выбрать фрагмент';
});

// Определяем пропсы
const props = defineProps<{
  modelValue: boolean
}>();

// Определяем события
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'calculate': []
  'protocol-log': [{ timestamp: string; message: string; type: string; html: boolean }]
  'show-protocol': [value: boolean]
}>();

// Компьютед свойство для режима диалога
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function getCurrentCalculationName() {
  const now = new Date();
  return `Расчет планового режима ${now.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '')}`;
}

const calculationName = ref(getCurrentCalculationName());

watch(isOpen, (val) => {
  if (val) {
    calculationName.value = getCurrentCalculationName();
  }
});

// Состояние формы
const consumptionType = ref('specific'); // или 'temperature'
const considerHeatLoss = ref(true);
const considerMixingCoefficients = ref(false);
const considerInternalHeat = ref(true);
const heatLossStandard = ref('нормы');
const heatLossTemperature = ref(0);
const outdoorTemperature = ref('-32');
const considerWind = ref(false);
const calculateThrottleValves = ref(false);
const calculateAutomatedConsumers = ref(false);
const recordMixingCoefficients = ref(false);
const networkQuantitativeCharacteristics = ref(false);
const mainFragment = ref(false);
const recordHeatLoadLoss = ref(false);
const considerVariationCoefficients = ref(true);

const isTemperatureMode = computed(() => consumptionType.value === 'temperature');

// Методы
const form = ref();

// Закрыть модальное окно
const close = () => {
  isOpen.value = false;
};

const addProtocolLog = (message: string, type: string = 'info', html = false) => {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('ru-RU');
  emit('protocol-log', { timestamp, message, type, html });
};

const buildApiString = () => {
  const params = [];
  params.push(`-name "${calculationName.value}"`);
  params.push(`-time "${new Date().toISOString().slice(0, 19).replace('T', ' ')}"`);
  if (selectedFragmentId.value !== null) params.push(`-fileID ${selectedFragmentId.value}`);

  if (isTemperatureMode.value) {
    params.push('-tg');
    if (!considerHeatLoss.value) params.push('-no_teplopoter');
    if (considerMixingCoefficients.value) params.push('-uf_calc');
    if (recordMixingCoefficients.value) params.push('-save_uf_new');
  }

  params.push(`-trtp ${heatLossTemperature.value}`);
  if (outdoorTemperature.value) params.push(`-Tn ${outdoorTemperature.value}`);
  if (considerWind.value) params.push('-veter');
  if (!considerInternalHeat.value) params.push('-no_teplovyd');
  if (calculateThrottleValves.value) params.push('-dross_yes');
  if (networkQuantitativeCharacteristics.value) params.push('-char_sety');
  if (mainFragment.value) params.push('-mag_fragment');
  if (recordHeatLoadLoss.value) params.push('-save_po');
  if (!considerVariationCoefficients.value) params.push('-no_kv');
  params.push(`-user_gid 1`);

  return params.join(' ');
};

// Выполнить расчет
const calculate = async () => {
  emit('show-protocol', true);
  
  if (selectedFragmentId.value === null) {
    fragmentError.value = true;
    addProtocolLog('Ошибка: необходимо выбрать фрагмент для расчета', 'error');
    return;
  }
  fragmentError.value = false;

  // Закрываем диалог при начале расчета
  isOpen.value = false;

  const apiString = buildApiString();
  addProtocolLog('Отправка запроса на расчет...', 'info');
  addProtocolLog(`Параметры: ${apiString}`, 'info');

  calculating.value = true;
  try {
    const result = await fastApiService.postRunSetyCmd(apiString);
    if (!result.task_id) {
      addProtocolLog(result.message || 'Ошибка: сервер не вернул ID задачи', 'error');
      calculating.value = false;
      return;
    }
    
    addProtocolLog(result.message || 'Задача добавлена в очередь', 'success');
    addProtocolLog(`Task ID: ${result.task_id}`, 'info');
    
    // Polling logic
    let isDone = false;
    let lastStatus = '';
    
    while (!isDone) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
      const statusResponse = await fastApiService.getTaskStatus(result.task_id);
      
      if (statusResponse.status !== lastStatus) {
        lastStatus = statusResponse.status;
        addProtocolLog(`Статус: ${lastStatus}`, 'info');
      }
      
      if (statusResponse.status === 'SUCCESS') {
        const finalResult = statusResponse.result;
        addProtocolLog(finalResult.message || 'Расчет окончен', 'success');
        if (finalResult.output) {
          addProtocolLog(finalResult.output, 'success', true);
        }
        isDone = true;
        
        // Refresh map layers to show new colors
        const layerStore = useLayerStore();
        layerStore.visibleGeoServerLayers.forEach(id => layerStore.refreshLayerSource(id));
      } else if (statusResponse.status === 'FAILURE') {
        addProtocolLog('Ошибка при выполнении расчета на сервере', 'error');
        if (statusResponse.error) {
          addProtocolLog(statusResponse.error, 'error', true);
        }
        isDone = true;
      }
    }
  } catch (error) {
    addProtocolLog('Ошибка при связи с сервером', 'error');
    addProtocolLog(`Детали ошибки: ${error}`, 'error');
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
.error-border {
  border: 2px solid rgb(var(--v-theme-error));
}
</style> 