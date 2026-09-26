<template>
  <v-dialog v-model="visible" max-width="700" scrollable>
    <v-card class="hydraulic-thematic-card">
      <v-card-title class="d-flex align-center justify-space-between py-3 px-4 bg-indigo-darken-3 text-white">
        <div class="d-flex align-center ga-2">
          <v-icon color="white">mdi-map-clock-outline</v-icon>
          <span class="text-h6 font-weight-bold">Гидравлический режим сети</span>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" color="white" @click="visible = false" />
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- Выбор расчета -->
        <v-row dense class="mb-3">
          <v-col cols="12" md="8">
            <v-select
              v-model="selectedCalculationId"
              :items="calculationOptions"
              item-title="title"
              item-value="id"
              label="Выберите гидравлический расчёт"
              variant="outlined"
              density="comfortable"
              :loading="loadingCalculations"
              prepend-inner-icon="mdi-calculator-variant"
              hide-details
              @update:model-value="onSelectCalculation"
            />
          </v-col>
          <v-col cols="12" md="4" class="d-flex align-center ga-2">
            <v-btn
              color="indigo-darken-2"
              variant="flat"
              block
              :loading="loadingResults"
              :disabled="!selectedCalculationId"
              @click="loadResults"
            >
              <v-icon start size="18">mdi-download</v-icon>
              Загрузить
            </v-btn>
          </v-col>
        </v-row>

        <!-- KPI сводка результатов -->
        <v-card v-if="summary" variant="tonal" color="indigo" class="pa-3 mb-4 rounded-lg">
          <div class="text-caption font-weight-bold mb-2 text-uppercase">
            Сводка расчета #{{ summary.calculation_id }}
          </div>
          <v-row dense>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">Участков</div>
              <div class="text-h6 font-weight-bold">{{ summary.lines_count }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">Узлов</div>
              <div class="text-h6 font-weight-bold">{{ summary.nodes_count }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-error font-weight-bold">hуд > 80 Па/м</div>
              <div class="text-h6 font-weight-bold text-error">{{ summary.over_resistance_count }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-warning font-weight-bold">v > 1.5 м/с</div>
              <div class="text-h6 font-weight-bold text-warning">{{ summary.high_velocity_count }}</div>
            </v-col>
          </v-row>
        </v-card>

        <!-- Настройки отображения слоев -->
        <v-card variant="outlined" class="pa-3 mb-4 rounded-lg">
          <div class="text-subtitle-2 font-weight-bold mb-2">Настройки тематического отображения</div>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-switch
                v-model="showFlowArrows"
                color="indigo"
                label="Стрелки направления потоков (▶)"
                density="compact"
                hide-details
                @change="emitSettings"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-switch
                v-model="colorPipesThematic"
                color="indigo"
                label="Цвет труб по hуд и скоростям v"
                density="compact"
                hide-details
                @change="emitSettings"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-switch
                v-model="colorNodesThematic"
                color="indigo"
                label="Цвет узлов по перепаду ΔH"
                density="compact"
                hide-details
                @change="emitSettings"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-switch
                v-model="showNodeLabels"
                color="indigo"
                label="Подписи напора узлов (ΔH м)"
                density="compact"
                hide-details
                @change="emitSettings"
              />
            </v-col>
          </v-row>
        </v-card>

        <!-- Легенда обозначений -->
        <v-card variant="tonal" class="pa-3 rounded-lg">
          <div class="text-subtitle-2 font-weight-bold mb-2">Легенда гидравлических режимов</div>
          <div class="d-flex flex-column ga-2 text-caption">
            <div class="d-flex align-center ga-2">
              <div style="width: 24px; height: 4px; background: #d32f2f; border-radius: 2px;"></div>
              <span><strong>Красный:</strong> h<sub>уд</sub> &gt; 80 Па/м (повышенное удельное сопротивление / перегрузка участка)</span>
            </div>
            <div class="d-flex align-center ga-2">
              <div style="width: 24px; height: 4px; background: #f57c00; border-radius: 2px;"></div>
              <span><strong>Оранжевый:</strong> v &gt; 1.5 м/с (высокая скорость теплоносителя, шум и абразивный износ)</span>
            </div>
            <div class="d-flex align-center ga-2">
              <div style="width: 24px; height: 4px; background: #7b1fa2; border-radius: 2px;"></div>
              <span><strong>Фиолетовый:</strong> v &lt; 0.3 м/с (низкая скорость, риск заиливания)</span>
            </div>
            <div class="d-flex align-center ga-2">
              <div style="width: 24px; height: 4px; background: #2e7d32; border-radius: 2px;"></div>
              <span><strong>Зеленый:</strong> нормальный гидравлический режим (30–80 Па/м, 0.5–1.5 м/с)</span>
            </div>
            <div class="d-flex align-center ga-2 mt-1">
              <div class="d-flex align-center ga-1">
                <span style="display:inline-block; width: 12px; height: 12px; border-radius: 50%; background: #304ffe;"></span>
                <span style="display:inline-block; width: 12px; height: 12px; border-radius: 50%; background: #00e676;"></span>
                <span style="display:inline-block; width: 12px; height: 12px; border-radius: 50%; background: #ff1744;"></span>
              </div>
              <span><strong>Узлы:</strong> располагаемый напор &Delta;H (от недостаточного &lt;15м до избыточного &gt;60м)</span>
            </div>
          </div>
        </v-card>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4 d-flex justify-space-between">
        <v-btn
          color="error"
          variant="outlined"
          :disabled="!isApplied"
          @click="clearThematic"
        >
          <v-icon start size="18">mdi-layers-off</v-icon>
          Скрыть с карты
        </v-btn>

        <div class="d-flex ga-2">
          <v-btn
            v-if="selectedCalculationId"
            color="success"
            variant="tonal"
            :loading="excelLoading"
            @click="downloadExcel"
          >
            <v-icon start size="18">mdi-file-excel</v-icon>
            Экспорт Excel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!geojsonResult"
            @click="applyThematic"
          >
            <v-icon start size="18">mdi-check-circle</v-icon>
            Применить на карте
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { fastApiService, type CalculationSummaryItem, type CalculationGeoJsonResponse } from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';

const visible = ref(false);
const calculations = ref<CalculationSummaryItem[]>([]);
const selectedCalculationId = ref<number | null>(null);
const loadingCalculations = ref(false);
const loadingResults = ref(false);
const geojsonResult = ref<CalculationGeoJsonResponse | null>(null);
const isApplied = ref(false);

// Toggles
const showFlowArrows = ref(true);
const colorPipesThematic = ref(true);
const colorNodesThematic = ref(true);
const showNodeLabels = ref(true);

const emit = defineEmits<{
  (e: 'apply-thematic', payload: {
    geojson: CalculationGeoJsonResponse;
    showArrows: boolean;
    colorPipes: boolean;
    colorNodes: boolean;
    showNodeLabels: boolean;
  }): void;
  (e: 'update-thematic-settings', payload: {
    showArrows: boolean;
    colorPipes: boolean;
    colorNodes: boolean;
    showNodeLabels: boolean;
  }): void;
  (e: 'clear-thematic'): void;
}>();

const summary = computed(() => geojsonResult.value?.summary ?? null);

const calculationOptions = computed(() => {
  return calculations.value.map((c) => ({
    id: c.id,
    title: `#${c.id} ${c.name || 'Без названия'} (${c.calculated_at ? new Date(c.calculated_at).toLocaleDateString('ru-RU') : 'не указано'})`,
  }));
});

// Через API-клиент: относительная ссылка /api/... уходила мимо базового адреса API
const excelLoading = ref(false);
const downloadExcel = async () => {
  if (!selectedCalculationId.value) return;
  excelLoading.value = true;
  try {
    const { blob, filename } = await fastApiService.downloadCalculationExcel(selectedCalculationId.value);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    useNotificationStore().showError(`Экспорт Excel: ${err?.message || 'ошибка сервера'}`);
  } finally {
    excelLoading.value = false;
  }
};

const open = async (calculationId?: number) => {
  visible.value = true;
  await fetchCalculations();
  if (calculationId) {
    selectedCalculationId.value = calculationId;
    await loadResults();
  } else if (calculations.value.length > 0 && !selectedCalculationId.value) {
    selectedCalculationId.value = calculations.value[0].id;
    await loadResults();
  }
};

const close = () => {
  visible.value = false;
};

const fetchCalculations = async () => {
  loadingCalculations.value = true;
  try {
    calculations.value = await fastApiService.getLatestCalculations(25);
  } catch (err: any) {
    useNotificationStore().showError('Не удалось загрузить список расчетов: ' + (err?.message || ''));
  } finally {
    loadingCalculations.value = false;
  }
};

const onSelectCalculation = async (calcId: number) => {
  selectedCalculationId.value = calcId;
  await loadResults();
};

const loadResults = async () => {
  if (!selectedCalculationId.value) return;
  loadingResults.value = true;
  try {
    geojsonResult.value = await fastApiService.getCalculationResultsGeoJson(selectedCalculationId.value);
    useNotificationStore().showSuccess(
      `Результаты расчета #${selectedCalculationId.value} загружены (${geojsonResult.value.features.length} объектов)`
    );
  } catch (err: any) {
    useNotificationStore().showError('Ошибка загрузки результатов расчета: ' + (err?.message || ''));
  } finally {
    loadingResults.value = false;
  }
};

const applyThematic = () => {
  if (!geojsonResult.value) return;
  isApplied.value = true;
  emit('apply-thematic', {
    geojson: geojsonResult.value,
    showArrows: showFlowArrows.value,
    colorPipes: colorPipesThematic.value,
    colorNodes: colorNodesThematic.value,
    showNodeLabels: showNodeLabels.value,
  });
  visible.value = false;
  useNotificationStore().showSuccess('Гидравлический режим отображен на карте.');
};

const emitSettings = () => {
  if (isApplied.value) {
    emit('update-thematic-settings', {
      showArrows: showFlowArrows.value,
      colorPipes: colorPipesThematic.value,
      colorNodes: colorNodesThematic.value,
      showNodeLabels: showNodeLabels.value,
    });
  }
};

const clearThematic = () => {
  isApplied.value = false;
  emit('clear-thematic');
  useNotificationStore().showInfo('Гидравлический режим скрыт с карты.');
};

defineExpose({
  open,
  openDialog: open,
  close,
});
</script>

<style scoped>
.hydraulic-thematic-card {
  border-radius: 12px;
  overflow: hidden;
}
</style>
