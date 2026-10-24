<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="980"
      scrollable
    >
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2 px-4 py-3">
          <v-icon color="blue-darken-2">mdi-format-list-numbered</v-icon>
          <div class="flex-grow-1">
            <div class="text-subtitle-1 font-weight-bold">Очередь опрессовок</div>
            <div class="text-caption text-medium-emphasis">
              Отдельный реестр (не журнал opres) · {{ total }} записей
              <span v-if="tableName"> · таблица {{ tableName }}</span>
            </div>
          </div>
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть"
            @click="visible = false"
          ><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-divider />
        <v-alert
          v-if="note"
          type="info"
          variant="tonal"
          density="compact"
          class="ma-3"
        >{{ note }}</v-alert>
        <StateView
          class="pa-3 ochered-body"
          variant="table"
          :rows="8"
          :loading="loading && !items.length"
          :error="error"
          :empty="!items.length"
          empty-title="Нет данных очереди"
          empty-text="Нужен дамп таблицы ochered_opressovok или opressovki_uchastok_ocheredi"
          error-title="Не удалось загрузить очередь опрессовок"
          :retrying="loading"
          @retry="load"
        >
          <DataTable
            :columns="tableColumns"
            :items="tableRows"
            item-key="__key"
            :loading="loading"
          />
        </StateView>
        <v-card-actions class="px-4 py-2">
          <span class="text-caption text-medium-emphasis">Стр. {{ page }}{{ pages ? ` / ${pages}` : '' }}</span>
          <v-spacer />
          <v-pagination
            v-if="pages > 1"
            v-model="page"
            :length="pages"
            density="compact"
            :total-visible="isMobile ? 3 : 7"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import StateView from '~/components/StateView.vue'
import DataTable from '~/components/DataTable.vue'
import { formatApiError } from '~/utils/apiError'
import { useMobile } from '~/composables/useMobile'
import { fastApiService } from '~/services/fastApiService'
import type { DataTableColumn } from '~/components/DataTable.vue'

const { isMobile } = useMobile()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const note = ref('')
const items = ref<Record<string, unknown>[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 50
const tableName = ref<string | null>(null)

const pages = computed(() => (total.value ? Math.ceil(total.value / pageSize) : 0))
const columns = computed(() => {
  const first = items.value[0]
  if (!first) return [] as string[]
  return Object.keys(first).filter((k) => !['shape', 'geom', 'geometry'].includes(k)).slice(0, 12)
})

const formatCell = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Колонки для DataTable: числовые — по первому значению, остальное текстом */
const tableColumns = computed<DataTableColumn[]>(() =>
  columns.value.map((col) => ({
    key: col,
    title: col,
    type: typeof items.value[0]?.[col] === 'number' ? 'number' : 'text',
  })),
)
const tableRows = computed(() =>
  items.value.map((row, idx) => {
    const out: Record<string, unknown> = { __key: idx }
    for (const col of columns.value) out[col] = typeof row[col] === 'number' ? row[col] : formatCell(row[col])
    return out
  }),
)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await fastApiService.getOcheredOpressovok(page.value, pageSize)
    items.value = data.items || []
    total.value = data.total || 0
    tableName.value = data.table ?? null
    note.value = data.note || ''
  } catch (e: any) {
    error.value = formatApiError(e)
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const openDialog = async () => {
  visible.value = true
  page.value = 1
  await load()
}

watch(page, () => {
  if (visible.value) void load()
})

defineExpose({ openDialog })
</script>

<style scoped>
.ochered-body {
  min-height: 280px;
}
</style>
