<template>
  <v-dialog v-model="dialog" max-width="900" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center bg-primary text-white pa-4">
        <v-icon class="mr-3">mdi-alert-octagon</v-icon>
        Диагностика неисправностей
        <v-spacer></v-spacer>
        <v-btn icon="mdi-refresh" variant="text" @click="fetchData" :loading="loading" class="mr-2" />
        <v-btn icon="mdi-close" variant="text" @click="dialog = false" />
      </v-card-title>
      
      <v-tabs v-model="activeTab" bg-color="primary" align-tabs="center">
        <v-tab value="layers">Слои на карте</v-tab>
        <v-tab value="list">Список неисправностей</v-tab>
      </v-tabs>
      
      <v-card-text class="pa-0" style="min-height: 400px; max-height: 600px;">
        <v-window v-model="activeTab">
          <v-window-item value="layers">
            <v-list lines="two" class="pa-4">
              <v-list-item>
                <template v-slot:prepend>
                  <v-avatar color="error" size="48">
                    <v-icon color="white">mdi-tools</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium">Дефекты</v-list-item-title>
                <v-list-item-subtitle class="mt-1">Отображать известные дефекты на карте (красные маркеры)</v-list-item-subtitle>
                <template v-slot:append>
                  <v-switch v-model="mapStore.isDefectsLayerVisible" color="error" hide-details></v-switch>
                </template>
              </v-list-item>
              <v-divider class="my-2"></v-divider>
              <v-list-item>
                <template v-slot:prepend>
                  <v-avatar color="warning" size="48">
                    <v-icon color="white">mdi-water-alert</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium">Индикаторы коррозии</v-list-item-title>
                <v-list-item-subtitle class="mt-1">Отображать индикаторы коррозии на карте (оранжевые маркеры)</v-list-item-subtitle>
                <template v-slot:append>
                  <v-switch v-model="mapStore.isCorrosionLayerVisible" color="warning" hide-details></v-switch>
                </template>
              </v-list-item>
            </v-list>
          </v-window-item>
          
          <v-window-item value="list">
            <div v-if="loading" class="d-flex flex-column justify-center align-center h-100 pa-10">
              <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
              <div class="text-subtitle-1 text-medium-emphasis">Загрузка данных...</div>
            </div>
            
            <div v-else-if="error" class="pa-6 text-center text-error">
              <v-icon size="48" class="mb-3">mdi-alert-circle</v-icon>
              <div>{{ error }}</div>
            </div>
            
            <v-list v-else lines="two" class="pa-0">
              <v-list-item v-for="(fault, index) in faults" :key="index" class="border-bottom" @click="locateFault(fault)">
                <template v-slot:prepend>
                  <v-avatar :color="fault.type === 'defect' ? 'error' : 'warning'" size="48">
                    <v-icon color="white">{{ fault.type === 'defect' ? 'mdi-tools' : 'mdi-water-alert' }}</v-icon>
                  </v-avatar>
                </template>
                
                <v-list-item-title class="font-weight-medium">
                  {{ fault.title }}
                </v-list-item-title>
                
                <v-list-item-subtitle class="mt-1 text-caption text-wrap">
                  {{ fault.description }}
                </v-list-item-subtitle>
                
                <template v-slot:append>
                  <v-btn icon="mdi-crosshairs-gps" size="small" variant="text" color="primary" @click.stop="locateFault(fault)" />
                </template>
              </v-list-item>
            </v-list>
          </v-window-item>
        </v-window>
      </v-card-text>
      
      <v-card-actions class="pa-4 bg-grey-lighten-4 border-top">
        <div v-if="activeTab === 'list'" class="text-caption text-medium-emphasis">
          Всего найдено: {{ faults.length }}
        </div>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="dialog = false">Закрыть</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { fastApiService } from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'
import { useMapStore } from '~/stores/mapStore'

const dialog = ref(false)
const activeTab = ref('layers')
const loading = ref(false)
const error = ref<string | null>(null)
const faults = ref<any[]>([])
const notificationStore = useNotificationStore()
const mapStore = useMapStore()

const emit = defineEmits<{
  'open-defect': [id: number],
  'open-corrosion': [id: number],
}>()

const fetchData = async () => {
  if (activeTab.value !== 'list') return;
  loading.value = true
  error.value = null
  try {
    const defectsRes = await fastApiService.getDefects({ page: 1, pageSize: 100 })
    const corrosionRes = await fastApiService.getCorrosionIndicators({ page: 1, pageSize: 100 })
    
    const defects = (defectsRes.items || []).map((i: any) => ({
      id: i.id,
      type: 'defect',
      title: `Дефект #${i.id}`,
      description: i.description || i.name || 'Без описания',
      lat: i.latitude,
      lng: i.longitude
    }))
    
    const corrosions = (corrosionRes.items || []).map((i: any) => ({
      id: i.id,
      type: 'corrosion',
      title: i.name || `Индикатор коррозии #${i.id}`,
      description: 'Индикатор коррозии',
      lat: i.latitude,
      lng: i.longitude
    }))
    
    // Combine and sort by ID descending (newest first roughly)
    faults.value = [...defects, ...corrosions].sort((a, b) => b.id - a.id)
  } catch (err: any) {
    error.value = 'Не удалось загрузить неисправности: ' + err.message
    notificationStore.showError(error.value)
  } finally {
    loading.value = false
  }
}

watch(activeTab, () => {
  if (activeTab.value === 'list' && faults.value.length === 0) {
    fetchData()
  }
})

watch(() => mapStore.isDefectsLayerVisible, () => mapStore.toggleDefectsLayer())
watch(() => mapStore.isCorrosionLayerVisible, () => mapStore.toggleCorrosionLayer())

const openDialog = () => {
  dialog.value = true
  if (activeTab.value === 'list') {
    fetchData()
  }
}

const locateFault = (fault: any) => {
  if (fault.lat != null && fault.lng != null) {
    mapStore.map?.flyTo({ center: [fault.lng, fault.lat], zoom: 18, duration: 1400, essential: true })
    if (fault.type === 'defect') {
      emit('open-defect', fault.id)
    } else if (fault.type === 'corrosion') {
      emit('open-corrosion', fault.id)
    }
  } else {
    notificationStore.showWarning('Координаты неисправности не указаны')
  }
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
