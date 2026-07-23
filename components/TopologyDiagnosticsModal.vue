<template>
  <v-dialog v-model="dialog" max-width="900" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center bg-primary text-white pa-4">
        <v-icon class="mr-3">mdi-stethoscope</v-icon>
        Диагностика топологии сети
        <v-spacer></v-spacer>
        <v-btn icon="mdi-refresh" variant="text" @click="fetchDiagnostics" :loading="loading" class="mr-2" />
        <v-btn icon="mdi-close" variant="text" @click="dialog = false" />
      </v-card-title>
      
      <v-card-text class="pa-0" style="min-height: 400px; max-height: 600px;">
        <div v-if="loading" class="d-flex flex-column justify-center align-center h-100 pa-10">
          <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
          <div class="text-subtitle-1 text-medium-emphasis">Идет анализ сети...</div>
        </div>
        
        <div v-else-if="error" class="pa-6 text-center text-error">
          <v-icon size="48" class="mb-3">mdi-alert-circle</v-icon>
          <div>{{ error }}</div>
        </div>
        
        <template v-else>
          <div v-if="faults.length === 0" class="d-flex flex-column justify-center align-center h-100 pa-10 text-success">
            <v-icon size="64" class="mb-4">mdi-check-circle</v-icon>
            <div class="text-h6">Ошибок топологии не найдено</div>
            <div class="text-body-2 mt-2 text-medium-emphasis">Сеть в хорошем состоянии</div>
          </div>
          
          <v-list v-else lines="two" class="pa-0">
            <v-list-item v-for="(fault, index) in faults" :key="index" class="border-bottom" @click="locateFault(fault)">
              <template v-slot:prepend>
                <v-avatar :color="getFaultColor(fault.type)" size="48">
                  <v-icon color="white">{{ getFaultIcon(fault.type) }}</v-icon>
                </v-avatar>
              </template>
              
              <v-list-item-title class="font-weight-medium">
                {{ getFaultTitle(fault) }}
              </v-list-item-title>
              
              <v-list-item-subtitle class="mt-1 text-caption text-wrap">
                {{ fault.description }}
              </v-list-item-subtitle>
              
              <template v-slot:append>
                <v-btn icon="mdi-crosshairs-gps" size="small" variant="text" color="primary" @click.stop="locateFault(fault)" />
              </template>
            </v-list-item>
          </v-list>
        </template>
      </v-card-text>
      
      <v-card-actions class="pa-4 bg-grey-lighten-4 border-top">
        <div class="text-caption text-medium-emphasis">
          Найдено проблем: {{ faults.length }}
        </div>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="dialog = false">Закрыть</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { fastApiService, type TopologyDiagnosticFault } from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'

const dialog = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const faults = ref<TopologyDiagnosticFault[]>([])
const notificationStore = useNotificationStore()

const emit = defineEmits<{
  'locate-fault': [fault: TopologyDiagnosticFault]
}>()

const fetchDiagnostics = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await fastApiService.getTopologyDiagnostics(200)
    faults.value = res.items || []
  } catch (err: any) {
    error.value = 'Не удалось загрузить диагностику топологии: ' + err.message
    notificationStore.showError(error.value)
  } finally {
    loading.value = false
  }
}

const openDialog = () => {
  dialog.value = true
  fetchDiagnostics()
}

const locateFault = (fault: TopologyDiagnosticFault) => {
  if (fault.lat != null && fault.lng != null) {
    emit('locate-fault', fault)
    // Опционально можно закрывать окно при навигации:
    // dialog.value = false
  } else {
    notificationStore.showWarning('Координаты неисправности неизвестны')
  }
}

const getFaultColor = (type: string) => {
  switch (type) {
    case 'orphaned_node': return 'orange-darken-2'
    case 'dangling_line': return 'red-darken-2'
    case 'zero_length_line': return 'deep-purple-darken-2'
    default: return 'grey'
  }
}

const getFaultIcon = (type: string) => {
  switch (type) {
    case 'orphaned_node': return 'mdi-map-marker-off'
    case 'dangling_line': return 'mdi-vector-line'
    case 'zero_length_line': return 'mdi-ray-start-end'
    default: return 'mdi-alert'
  }
}

const getFaultTitle = (fault: TopologyDiagnosticFault) => {
  const typeName = fault.object_type === 'node' ? 'Узел' : 'Линия'
  switch (fault.type) {
    case 'orphaned_node': return `Изолированный ${typeName} #${fault.object_id}`
    case 'dangling_line': return `Разорванная ${typeName} #${fault.object_id}`
    case 'zero_length_line': return `Нулевая ${typeName} #${fault.object_id}`
    default: return `Проблема: ${typeName} #${fault.object_id}`
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
