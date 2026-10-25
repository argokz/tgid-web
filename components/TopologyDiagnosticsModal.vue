<template>
  <v-dialog
    v-model="dialog"
    max-width="1100"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-avatar
          color="primary"
          variant="tonal"
          size="40"
        >
          <v-icon>mdi-stethoscope</v-icon>
        </v-avatar>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold">
            Диагностика топологии сети
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            Проверка связности одного фрагмента; щелчок по строке — объект на карте
          </div>
        </div>
        <HintTip
          text="Проверить заново"
          location="bottom"
        >
          <template #default="{ props: tip }">
            <v-btn
              v-bind="tip"
              icon="mdi-refresh"
              variant="text"
              aria-label="Проверить заново"
              :loading="loading"
              :disabled="fragmentId === null"
              @click="fetchDiagnostics"
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
        style="min-height: 420px;"
      >
        <AppSelect
          v-model="fragmentId"
          :items="fragmentItems"
          item-title="title"
          item-value="value"
          label="Фрагмент"
          class="mb-3"
          style="max-width: 420px"
          searchable
          :clearable="false"
        />

        <StateView
          variant="table"
          :rows="8"
          :loading="loading"
          :error="error"
          :empty="fragmentId === null || (!!result && result.total === 0)"
          :empty-title="fragmentId === null ? 'Выберите фрагмент' : 'Ошибок топологии не найдено'"
          :empty-text="fragmentId === null
            ? 'Диагностика выполняется по одному фрагменту сети'
            : `Узлов ${formatCount(result?.nodes)}, участков ${formatCount(result?.lines)} — связность в порядке`"
          :empty-icon="fragmentId === null ? 'mdi-stethoscope' : 'mdi-check-circle-outline'"
          error-title="Не удалось выполнить диагностику"
          :retrying="loading"
          @retry="fetchDiagnostics"
        >
          <template v-if="result">
            <!-- Итог: полные числа сервера (список — не больше limit на тип); плитка типа — фильтр таблицы -->
            <div class="topo-tiles mb-2">
              <KpiTile
                label="Проблем"
                :value="result.total"
                :compact="false"
                status="serious"
              />
              <KpiTile
                label="Узлов"
                :value="result.nodes"
                :compact="false"
              />
              <KpiTile
                label="Участков"
                :value="result.lines"
                :compact="false"
              />
              <KpiTile
                v-for="row in countRows"
                :key="row.type"
                :label="row.label"
                :value="row.count"
                :title="result.types?.[row.type] || row.label"
                :compact="false"
                selectable
                :active="typeFilter === row.type"
                @select="typeFilter = typeFilter === row.type ? null : row.type"
              />
            </div>

            <div class="d-flex flex-wrap align-center ga-2 mb-2">
              <SearchField
                v-model="search"
                class="topo-search"
                label="Поиск по номеру объекта или описанию"
                density="compact"
                :result-count="search ? tableRows.length : null"
              />
              <v-spacer />
              <span
                v-if="result.truncated"
                class="text-caption text-medium-emphasis"
              >
                В списке — не больше {{ result.limit }} каждого типа; числа на плитках — полные
              </span>
            </div>

            <DataTable
              :columns="columns"
              :items="tableRows"
              item-key="key"
              selectable
              :height="360"
              no-data-text="Нет проблем по фильтру"
              @select="(row) => locateFault(row as unknown as TableRow)"
            >
              <template #[`item.type`]="{ item }">
                <span class="topo-type">
                  <v-icon
                    :color="topologyFaultMeta(item.type).color"
                    size="18"
                  >{{ topologyFaultMeta(item.type).icon }}</v-icon>
                  {{ topologyFaultMeta(item.type).label }}
                </span>
              </template>
              <template #[`item.locate`]="{ item }">
                <v-icon
                  v-if="item.lat != null && item.lng != null"
                  size="16"
                  color="primary"
                  aria-label="Есть на карте"
                >
                  mdi-crosshairs-gps
                </v-icon>
              </template>
            </DataTable>
          </template>
        </StateView>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-spacer />
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
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import KpiTile from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import StateView from '~/components/StateView.vue'
import {
  fastApiService,
  type TopologyDiagnosticFault,
  type TopologyDiagnosticsResponse,
} from '~/services/fastApiService'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiErrorWith } from '~/utils/apiError'
import { topologyFaultCounts, topologyFaultMeta } from '~/utils/topologyDiagnostics'

/**
 * Диагностика топологии фрагмента (GET api/v1/topology/diagnostics): итог — плитки по типам проблем (полные
 * числа сервера), список — `DataTable` с фильтром по типу и поиском. Фрагмент выбирается здесь же, по умолчанию —
 * выбранный на карте. Щелчок по строке — перелёт к объекту (`locate-fault`).
 */
type TableRow = TopologyDiagnosticFault & { key: string; object: string; [field: string]: unknown }

/** Не больше стольких проблем каждого типа в списке */
const FAULTS_PER_TYPE = 200

const emit = defineEmits<{
  'locate-fault': [fault: TopologyDiagnosticFault]
}>()

const dialog = ref(false)
const loading = ref(false)
const error = ref('')
const result = ref<TopologyDiagnosticsResponse | null>(null)
const fragmentId = ref<number | null>(null)
const typeFilter = ref<string | null>(null)
const search = ref('')
const notificationStore = useNotificationStore()
const fragmentStore = useFragmentStore()
let fetchSeq = 0

const fragmentItems = computed(() =>
  fragmentStore.fragments.map((f: { id: number; name?: string }) => ({
    value: f.id,
    title: f.name ? `${f.name} (#${f.id})` : `Фрагмент #${f.id}`,
  })),
)
const countRows = computed(() => topologyFaultCounts(result.value?.counts))
const formatCount = (value: number | null | undefined) => (value ?? 0).toLocaleString('ru-RU')

const tableRows = computed<TableRow[]>(() => {
  const faults = result.value?.faults ?? []
  const query = search.value.trim().toLowerCase()
  return faults
    .filter((fault) => !typeFilter.value || fault.type === typeFilter.value)
    .map((fault) => ({
      ...fault,
      key: `${fault.type}-${fault.object_type}-${fault.object_id}`,
      object: `${fault.object_type === 'node' ? 'Узел' : 'Участок'} №${fault.object_id}`,
    }))
    .filter((row) => !query || row.object.toLowerCase().includes(query) || String(row.object_id).includes(query)
      || (row.description || '').toLowerCase().includes(query))
})

const columns: DataTableColumn[] = [
  { key: 'type', title: 'Проблема', width: 260 },
  { key: 'object', title: 'Объект', width: 140 },
  { key: 'description', title: 'Описание' },
  { key: 'locate', title: '', width: 36, sortable: false },
]

const fetchDiagnostics = async () => {
  const id = fragmentId.value
  const seq = ++fetchSeq
  error.value = ''
  result.value = null // ошибка запроса не должна выглядеть как «0 проблем» (QA F35)
  typeFilter.value = null
  if (id === null) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const response = await fastApiService.getTopologyDiagnostics(id, FAULTS_PER_TYPE)
    if (seq === fetchSeq) result.value = response
  } catch (err: unknown) {
    if (seq !== fetchSeq) return
    error.value = formatApiErrorWith('Не удалось загрузить диагностику топологии', err)
    notificationStore.showError(error.value)
  } finally {
    if (seq === fetchSeq) loading.value = false
  }
}

// другой фрагмент — проверить его (только пока окно открыто)
watch(fragmentId, () => {
  if (dialog.value) void fetchDiagnostics()
})

const openDialog = () => {
  const initial = fragmentStore.selectedFragmentId
    ?? (fragmentStore.visibleFragments.length === 1 ? fragmentStore.visibleFragments[0] : null)
  dialog.value = true
  if (fragmentId.value !== initial && initial != null) {
    fragmentId.value = initial // watch запустит проверку
  } else {
    void fetchDiagnostics()
  }
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
.topo-tiles { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.topo-search { flex: 0 1 360px; min-width: 220px; }
.topo-type { display: inline-flex; align-items: center; gap: var(--space-1); }
</style>
