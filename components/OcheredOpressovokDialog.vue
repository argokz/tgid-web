<template>
  <Teleport to="body">
    <v-dialog v-model="visible" :fullscreen="isMobile" max-width="980" scrollable>
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
          <v-btn icon variant="text" @click="visible = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-divider />
        <v-alert v-if="note" type="info" variant="tonal" density="compact" class="ma-3">{{ note }}</v-alert>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="ma-3">{{ error }}</v-alert>
        <div class="pa-3" style="min-height: 280px; overflow: auto">
          <v-progress-linear v-if="loading" indeterminate color="blue-darken-2" class="mb-3" />
          <v-table v-else-if="items.length" density="compact" hover>
            <thead>
              <tr>
                <th v-for="col in columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in items" :key="idx">
                <td v-for="col in columns" :key="col">{{ formatCell(row[col]) }}</td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="text-medium-emphasis text-center py-10">
            Нет данных очереди. Нужен дамп `ochered_opressovok` / `opressovki_uchastok_ocheredi`.
          </div>
        </div>
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
import { useDisplay } from 'vuetify'
import { fastApiService } from '~/services/fastApiService'

const { smAndDown: isMobile } = useDisplay()
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
    error.value = e?.message || String(e)
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
