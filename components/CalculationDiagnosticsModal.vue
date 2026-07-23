<template>
  <v-dialog v-model="dialog" max-width="800" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center bg-primary text-white pa-4">
        <v-icon class="mr-3">mdi-calculator-variant</v-icon>
        Диагностика расчетов
        <v-spacer></v-spacer>
        <v-btn icon="mdi-refresh" variant="text" @click="fetchData" :loading="loading" class="mr-2" />
        <v-btn icon="mdi-close" variant="text" @click="dialog = false" />
      </v-card-title>
      
      <v-card-text class="pa-4" style="min-height: 400px; max-height: 600px;">
        <div class="mb-4">
          <div class="text-subtitle-2 mb-2">Настройки отображения</div>
          <v-radio-group v-model="mapStore.calculationColorMode" @change="mapStore.updateCalculationColors()" inline hide-details>
            <v-radio label="По падению давления (атм)" value="pressure_drop" color="primary"></v-radio>
            <v-radio label="По скорости воды (м/с)" value="velocity" color="primary"></v-radio>
          </v-radio-group>
          <div class="d-flex align-center mt-2 ga-2">
            <span class="text-caption text-medium-emphasis">Легенда:</span>
            <div style="height: 12px; flex-grow: 1; border-radius: 6px; background: linear-gradient(to right, #00ff00, #ffff00 30%, #ff0000 70%, #8b0000 100%);"></div>
            <span class="text-caption font-weight-bold" style="min-width: 50px; text-align: right;">
              {{ mapStore.calculationColorMode === 'pressure_drop' ? '0 - 5.0 атм' : '0 - 3.0 м/с' }}
            </span>
          </div>
        </div>
        
        <v-divider class="mb-4"></v-divider>
        
        <div class="text-subtitle-2 mb-2">История расчетов (последние 20)</div>
        <v-list lines="two">
          <v-list-item
            v-for="calc in calculations"
            :key="calc.id"
            :value="calc.id"
            :active="mapStore.activeCalculationId === calc.id"
            color="primary"
            class="border-bottom"
            @click="toggleCalculation(calc.id)"
          >
            <template v-slot:prepend>
              <v-avatar :color="mapStore.activeCalculationId === calc.id ? 'primary' : 'grey-lighten-2'" size="48">
                <v-icon :color="mapStore.activeCalculationId === calc.id ? 'white' : 'grey-darken-2'">
                  {{ mapStore.activeCalculationId === calc.id ? 'mdi-check-circle' : 'mdi-calculator' }}
                </v-icon>
              </v-avatar>
            </template>
            
            <v-list-item-title class="font-weight-medium">
              Расчет #{{ calc.id }}: {{ calc.name || 'Без названия' }}
            </v-list-item-title>
            
            <v-list-item-subtitle class="mt-1">
              {{ new Date(calc.calculated_at).toLocaleString('ru-RU') }}
            </v-list-item-subtitle>
            
            <template v-slot:append>
              <v-btn
                v-if="mapStore.activeCalculationId === calc.id"
                icon="mdi-file-excel"
                color="success"
                size="small"
                variant="text"
                class="mr-2"
                title="Скачать Excel"
                @click.stop="downloadCalcExcel(calc.id)"
              />
              <v-btn
                v-if="mapStore.activeCalculationId === calc.id"
                variant="outlined"
                color="error"
                size="small"
                @click.stop="toggleCalculation(null)"
              >
                Отключить
              </v-btn>
              <v-btn
                v-else
                variant="tonal"
                color="primary"
                size="small"
                @click.stop="toggleCalculation(calc.id)"
              >
                Показать
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
        
        <div v-if="loading" class="d-flex justify-center pa-4">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>
        <div v-if="error" class="text-error text-center pa-4">
          {{ error }}
        </div>
      </v-card-text>
      
      <v-card-actions class="pa-4 bg-grey-lighten-4 border-top">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="dialog = false">Закрыть</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { fastApiService } from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'
import { useMapStore } from '~/stores/mapStore'

const dialog = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const calculations = ref<any[]>([])
const notificationStore = useNotificationStore()
const mapStore = useMapStore()

const fetchData = async () => {
  loading.value = true
  error.value = null
  try {
    calculations.value = await fastApiService.getLatestCalculations(20)
  } catch (err: any) {
    error.value = 'Не удалось загрузить историю расчетов: ' + err.message
    notificationStore.showError(error.value)
  } finally {
    loading.value = false
  }
}

const toggleCalculation = async (id: number | null) => {
  if (id === mapStore.activeCalculationId) {
    id = null; // toggle off
  }
  
  loading.value = true;
  try {
    await mapStore.loadCalculation(id);
    if (id !== null) {
      notificationStore.showSuccess('Расчет #' + id + ' загружен на карту');
    }
  } catch (err: any) {
    notificationStore.showError('Ошибка загрузки расчета');
  } finally {
    loading.value = false;
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
    notificationStore.showSuccess('Результаты расчета #' + calcId + ' выгружены в Excel')
  } catch (err: any) {
    notificationStore.showError('Ошибка выгрузки Excel: ' + err.message)
  }
}

const openDialog = () => {
  dialog.value = true
  fetchData()
}

defineExpose({
  openDialog
})
</script>

<style scoped>
.border-bottom {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.border-top {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
