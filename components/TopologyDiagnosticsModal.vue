<template>
  <v-dialog
    v-model="dialog"
    max-width="900"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center bg-primary text-white pa-4">
        <v-icon class="mr-3">mdi-stethoscope</v-icon>
        Диагностика топологии сети
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          aria-label="Обновить"
          @click="fetchDiagnostics"
          :loading="loading"
          :disabled="fragmentId === null"
          class="mr-2"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Закрыть"
          @click="dialog = false"
        />
      </v-card-title>

      <div
        v-if="result"
        class="px-4 pt-3"
      >
        <div class="text-subtitle-2">
          {{ result.fragment_name || `Фрагмент #${result.fragment_id}` }}
          <span class="text-medium-emphasis">· узлов {{ result.nodes }}, участков {{ result.lines }}</span>
        </div>
        <div
          v-if="countRows.length"
          class="d-flex flex-wrap ga-2 mt-2"
        >
          <v-chip
            v-for="row in countRows"
            :key="row.type"
            :color="row.color"
            :prepend-icon="row.icon"
            size="small"
            variant="tonal"
            :title="result.types?.[row.type] || row.label"
          >
            {{ row.label }}: {{ row.count }}
          </v-chip>
        </div>
      </div>

      <v-card-text
        class="pa-0"
        style="min-height: 400px; max-height: 600px;"
      >
        <div
          v-if="loading"
          class="d-flex flex-column justify-center align-center h-100 pa-10"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
            class="mb-4"
          />
          <div class="text-subtitle-1 text-medium-emphasis">Идет анализ сети...</div>
        </div>

        <div
          v-else-if="fragmentId === null"
          class="pa-6 text-center text-medium-emphasis"
        >
          <v-icon
            size="48"
            class="mb-3"
          >mdi-alert-circle</v-icon>
          <div>Выберите фрагмент: диагностика выполняется по одному фрагменту сети.</div>
        </div>

        <div
          v-else-if="error"
          class="pa-6 text-center text-error"
        >
          <v-icon
            size="48"
            class="mb-3"
          >mdi-alert-circle</v-icon>
          <div>{{ error }}</div>
        </div>

        <template v-else-if="result">
          <div
            v-if="result.total === 0"
            class="d-flex flex-column justify-center align-center h-100 pa-10 text-success"
          >
            <v-icon
              size="64"
              class="mb-4"
            >mdi-check-circle</v-icon>
            <div class="text-h6">Ошибок топологии не найдено</div>
          </div>

          <v-list
            v-else
            lines="two"
            class="pa-0"
          >
            <v-list-item
              v-for="fault in result.faults"
              :key="`${fault.type}-${fault.object_id}`"
              class="border-bottom"
              @click="locateFault(fault)"
            >
              <template #prepend>
                <v-avatar
                  :color="topologyFaultMeta(fault.type).color"
                  size="48"
                >
                  <v-icon color="white">{{ topologyFaultMeta(fault.type).icon }}</v-icon>
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-medium">
                {{ topologyFaultTitle(fault) }}
              </v-list-item-title>

              <v-list-item-subtitle class="mt-1 text-caption text-wrap">
                {{ fault.description }}
              </v-list-item-subtitle>

              <template #append>
                <v-btn
                  icon="mdi-crosshairs-gps"
                  size="small"
                  variant="text"
                  color="primary"
                  :disabled="fault.lat == null || fault.lng == null"
                  aria-label="Показать на карте"
                  @click.stop="locateFault(fault)"
                />
              </template>
            </v-list-item>
          </v-list>
        </template>
      </v-card-text>

      <v-card-actions class="pa-4 bg-grey-lighten-4 border-top">
        <div
          v-if="result && !error && !loading"
          class="text-caption text-medium-emphasis"
        >
          Найдено проблем: {{ result.total }}<template v-if="result.truncated">
            (в списке — не больше {{ result.limit }} каждого типа)</template>
        </div>
        <v-spacer />
        <v-btn
          variant="text"
          @click="dialog = false"
        >Закрыть</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { formatApiErrorWith } from '~/utils/apiError'
import { computed, ref } from 'vue'
import {
  fastApiService,
  type TopologyDiagnosticFault,
  type TopologyDiagnosticsResponse,
} from '~/services/fastApiService'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { topologyFaultCounts, topologyFaultMeta, topologyFaultTitle } from '~/utils/topologyDiagnostics'

const dialog = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<TopologyDiagnosticsResponse | null>(null)
const notificationStore = useNotificationStore()
const fragmentStore = useFragmentStore()

const fragmentId = computed(() => fragmentStore.selectedFragmentId)
const countRows = computed(() => topologyFaultCounts(result.value?.counts))

const emit = defineEmits<{
  'locate-fault': [fault: TopologyDiagnosticFault]
}>()

const fetchDiagnostics = async () => {
  const id = fragmentId.value
  error.value = null
  result.value = null // ошибка запроса не должна выглядеть как «0 проблем» (QA F35)
  if (id === null) return
  loading.value = true
  try {
    result.value = await fastApiService.getTopologyDiagnostics(id, 200)
  } catch (err: any) {
    error.value = formatApiErrorWith('Не удалось загрузить диагностику топологии', err)
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
  } else {
    notificationStore.showWarning('Координаты объекта неизвестны')
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
