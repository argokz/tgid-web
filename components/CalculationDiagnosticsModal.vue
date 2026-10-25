<template>
  <v-dialog
    v-model="dialog"
    max-width="820"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-avatar
          color="primary"
          variant="tonal"
          size="40"
        >
          <v-icon>mdi-calculator-variant</v-icon>
        </v-avatar>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold">
            Диагностика расчётов
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            Результаты расчёта раскрашивают участки на карте; шкала — в легенде внизу слева
          </div>
        </div>
        <HintTip
          text="Обновить список"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-refresh"
              variant="text"
              aria-label="Обновить список"
              :loading="loading"
              @click="fetchData"
            />
          </template>
        </HintTip>
        <HintTip
          text="Закрыть"
          hotkey="Esc"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-close"
              variant="text"
              aria-label="Закрыть"
              @click="dialog = false"
            />
          </template>
        </HintTip>
      </v-card-title>
      <v-divider />

      <v-card-text
        class="pa-4"
        style="min-height: 400px; max-height: 600px;"
      >
        <div class="d-flex align-center flex-wrap ga-3 mb-4">
          <span class="text-subtitle-2">Раскрашивать участки</span>
          <SegmentedToggle
            v-model="mapStore.calculationColorMode"
            :items="colorModes"
            aria-label="Показатель раскраски участков"
          />
          <span class="text-caption text-medium-emphasis">
            шкала 0 … {{ formatChartNumber(scaleMax, 1) }} {{ scale.units }} и выше
          </span>
        </div>

        <div class="text-subtitle-2 mb-2">
          История расчётов (последние 20)
        </div>
        <StateView
          variant="list"
          :rows="6"
          :loading="loading && !calculations.length"
          :error="error"
          :empty="!loading && !error && !calculations.length"
          empty-title="Расчётов нет"
          empty-text="После гидравлического расчёта фрагмента результаты появятся здесь"
          empty-icon="mdi-calculator-variant"
          error-title="Не удалось загрузить историю расчётов"
          :retrying="loading"
          @retry="fetchData"
        >
          <v-list
            lines="two"
            class="py-0"
          >
            <v-list-item
              v-for="calc in calculations"
              :key="calc.id"
              :value="calc.id"
              :active="mapStore.activeCalculationId === calc.id"
              color="primary"
              class="calc-item"
              @click="toggleCalculation(calc.id)"
            >
              <template #prepend>
                <v-avatar
                  :color="mapStore.activeCalculationId === calc.id ? 'primary' : 'surface-variant'"
                  size="40"
                >
                  <v-icon :color="mapStore.activeCalculationId === calc.id ? 'white' : undefined">
                    {{ mapStore.activeCalculationId === calc.id ? 'mdi-check-circle' : 'mdi-calculator' }}
                  </v-icon>
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-medium">
                Расчёт №{{ calc.id }}: {{ calc.name || 'Без названия' }}
              </v-list-item-title>
              <v-list-item-subtitle class="mt-1">
                {{ formatDate(calc.calculated_at) }}
              </v-list-item-subtitle>

              <template #append>
                <HintTip
                  v-if="mapStore.activeCalculationId === calc.id"
                  text="Скачать результаты в Excel"
                >
                  <template #default="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      icon="mdi-file-excel"
                      color="success"
                      size="small"
                      variant="text"
                      class="mr-2"
                      aria-label="Скачать результаты в Excel"
                      @click.stop="downloadCalcExcel(calc.id)"
                    />
                  </template>
                </HintTip>
                <v-btn
                  v-if="mapStore.activeCalculationId === calc.id"
                  variant="outlined"
                  color="error"
                  size="small"
                  :loading="switchingId === calc.id"
                  @click.stop="toggleCalculation(null)"
                >
                  Убрать с карты
                </v-btn>
                <v-btn
                  v-else
                  variant="tonal"
                  color="primary"
                  size="small"
                  :loading="switchingId === calc.id"
                  @click.stop="toggleCalculation(calc.id)"
                >
                  Показать
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </StateView>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-3 flex-wrap ga-2">
        <v-spacer />
        <v-btn
          v-if="mapStore.activeCalculationId !== null"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-map-check-outline"
          @click="keepOnMap"
        >
          Оставить на карте
        </v-btn>
        <v-btn
          variant="text"
          @click="dialog = false"
        >
          Закрыть
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import HintTip from '~/components/HintTip.vue'
import SegmentedToggle, { type SegmentedToggleItem } from '~/components/SegmentedToggle.vue'
import StateView from '~/components/StateView.vue'
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay'
import { fastApiService } from '~/services/fastApiService'
import { useMapStore } from '~/stores/mapStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiErrorWith } from '~/utils/apiError'
import { calculationScale, type CalculationColorMode } from '~/utils/calculationScale'
import { formatChartNumber } from '~/utils/chartOptions'

/**
 * Диагностика расчётов: история последних расчётов, показ результата на карте раскраской участков (падение
 * давления или скорость воды). Шкала — `utils/calculationScale`, та же у слоя карты и у легенды `MapLegend`
 * (показывается на карте, пока расчёт на ней). Слой снимается при закрытии окна, кроме «Оставить на карте».
 */
const dialog = ref(false)
const loading = ref(false)
const error = ref('')
const calculations = ref<Array<{ id: number; name?: string | null; calculated_at?: string | null }>>([])
/** Расчёт, который сейчас грузится на карту (кнопка с индикатором) */
const switchingId = ref<number | null>(null)
const notificationStore = useNotificationStore()
const mapStore = useMapStore()
// calculation-lines-layer снимается при закрытии окна, кроме «Оставить на карте» (QA F37)
const { markShown, markCleared, keepOnMap } = useDialogMapOverlay(dialog, () => {
  void mapStore.loadCalculation(null)
})

const colorModes: SegmentedToggleItem<CalculationColorMode>[] = [
  { value: 'pressure_drop', label: 'Падение давления', icon: 'mdi-gauge-low' },
  { value: 'velocity', label: 'Скорость воды', icon: 'mdi-speedometer' }
]
const scale = computed(() => calculationScale(mapStore.calculationColorMode))
const scaleMax = computed(() => scale.value.stops[scale.value.stops.length - 1][0])
// смена показателя — сразу перекрасить слой на карте
watch(() => mapStore.calculationColorMode, () => mapStore.updateCalculationColors())

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString('ru-RU') : 'дата не записана')

const fetchData = async () => {
  loading.value = true
  error.value = ''
  try {
    calculations.value = await fastApiService.getLatestCalculations(20)
  } catch (err: unknown) {
    error.value = formatApiErrorWith('Не удалось загрузить историю расчётов', err)
  } finally {
    loading.value = false
  }
}

const toggleCalculation = async (id: number | null) => {
  // повторный щелчок по показанному — убрать с карты
  const target = id === mapStore.activeCalculationId ? null : id
  switchingId.value = target ?? mapStore.activeCalculationId
  try {
    await mapStore.loadCalculation(target)
    if (target === null) {
      markCleared()
    } else {
      markShown()
      notificationStore.showSuccess(`Расчёт №${target} показан на карте`)
    }
  } catch (err: unknown) {
    notificationStore.showError(formatApiErrorWith(`Расчёт №${target} не загрузился на карту`, err))
  } finally {
    switchingId.value = null
  }
}

const downloadCalcExcel = async (calcId: number) => {
  try {
    const { blob, filename } = await fastApiService.downloadCalculationExcel(calcId)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    notificationStore.showSuccess(`Результаты расчёта №${calcId} выгружены в Excel`)
  } catch (err: unknown) {
    notificationStore.showError(formatApiErrorWith('Ошибка выгрузки Excel', err))
  }
}

const openDialog = () => {
  dialog.value = true
  void fetchData()
}

defineExpose({
  openDialog
})
</script>

<style scoped>
.calc-item { border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06); }
</style>
