<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1150"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-history</v-icon>
        История правок
        <span
          v-if="filter.table && filter.record_id"
          class="text-body-2 text-medium-emphasis"
        >
          — {{ filter.table }} #{{ filter.record_id }}
        </span>
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          density="compact"
          :loading="loading"
          aria-label="Обновить"
          @click="load"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>

      <v-card-text class="pt-0">
        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-combobox
            v-model="filter.table"
            :items="lookups.tables.map((t) => t.name)"
            label="Таблица"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            style="min-width: 190px; flex: 2 1 190px;"
          />
          <v-text-field
            v-model.number="filter.record_id"
            label="ID объекта"
            type="number"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            style="min-width: 120px; flex: 1 1 120px;"
          />
          <v-combobox
            v-model="filter.changed_by"
            :items="lookups.users.map((u) => u.name)"
            label="Пользователь"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            style="min-width: 150px; flex: 1 1 150px;"
          />
          <v-select
            v-model="filter.operation"
            :items="lookups.operations.map((o) => o.name)"
            label="Операция"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            style="min-width: 130px; flex: 1 1 130px;"
          />
          <v-text-field
            v-model="filter.date_from"
            label="С даты"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            style="min-width: 150px; flex: 1 1 150px;"
          />
          <v-text-field
            v-model="filter.date_to"
            label="По дату"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            style="min-width: 150px; flex: 1 1 150px;"
          />
          <v-btn
            variant="text"
            prepend-icon="mdi-filter-remove"
            class="mt-1"
            @click="resetFilter"
          >
            Сбросить
          </v-btn>
        </div>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ error }}
        </v-alert>
        <v-alert
          v-if="note"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ note }}
        </v-alert>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          v-model:expanded="expanded"
          :headers="headers"
          :items="items"
          :items-length="total"
          :loading="loading"
          :items-per-page-options="[25, 50, 100, 200]"
          item-value="log_id"
          show-expand
          density="compact"
          no-data-text="Изменений не найдено"
          @update:options="load"
        >
          <template #[`item.changed_at`]="{ item }">
            {{ formatDate(item.changed_at) }}
          </template>
          <template #[`item.operation`]="{ item }">
            <v-chip
              size="x-small"
              :color="operationColor(item.operation)"
              variant="tonal"
            >
              {{ item.operation || '—' }}
            </v-chip>
          </template>
          <template #[`item.object`]="{ item }">
            <a
              href="#"
              class="text-primary"
              :title="`Только ${item.table_name} #${item.record_id}`"
              @click.prevent="focusObject(item)"
            >{{ item.table_name }}<template v-if="item.record_id != null"> #{{ item.record_id }}</template></a>
          </template>
          <template #[`item.changes`]="{ item }">
            <span class="text-caption">{{ summarize(item.changes) }}</span>
          </template>
          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="py-2">
                <table
                  v-if="item.changes.length"
                  class="audit-diff"
                >
                  <thead>
                    <tr>
                      <th>Поле</th>
                      <th>Было</th>
                      <th>Стало</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="c in item.changes"
                      :key="c.field"
                    >
                      <td>{{ c.field }}</td>
                      <td class="audit-diff__old">{{ formatValue(c.old) }}</td>
                      <td class="audit-diff__new">{{ formatValue(c.new) }}</td>
                    </tr>
                  </tbody>
                </table>
                <span
                  v-else
                  class="text-caption text-medium-emphasis"
                >Значения полей не изменились (или снимок не сохранён).</span>
                <div
                  v-if="item.change_group_id"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  Группа изменений:
                  <a
                    href="#"
                    @click.prevent="focusGroup(item.change_group_id)"
                  >{{ item.change_group_id }}</a>
                  <span v-if="item.comment"> · {{ item.comment }}</span>
                </div>
              </td>
            </tr>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import {
  fastApiService,
  type AuditChange,
  type AuditLogItem,
  type AuditLookups,
} from '~/services/fastApiService'

const { mobile } = useDisplay()

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const note = ref('')
const items = ref<AuditLogItem[]>([])
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(50)
const expanded = ref<string[]>([])
const lookups = ref<AuditLookups>({ tables: [], users: [], operations: [] })

type Filter = {
  table: string | null
  record_id: number | null
  changed_by: string | null
  operation: string | null
  date_from: string | null
  date_to: string | null
  change_group_id: string | null
}
const emptyFilter = (): Filter => ({
  table: null,
  record_id: null,
  changed_by: null,
  operation: null,
  date_from: null,
  date_to: null,
  change_group_id: null,
})
const filter = reactive<Filter>(emptyFilter())

const headers = [
  { title: 'Когда', key: 'changed_at', sortable: false, width: 150 },
  { title: 'Кто', key: 'changed_by', sortable: false },
  { title: 'Операция', key: 'operation', sortable: false },
  { title: 'Объект', key: 'object', sortable: false },
  { title: 'Изменения', key: 'changes', sortable: false },
  { title: '', key: 'data-table-expand', width: 40 },
]

const formatDate = (value: string | null) =>
  (value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' }) : '—')

const formatValue = (value: any) => (value === null || value === undefined || value === '' ? '—' : String(value))

const summarize = (changes: AuditChange[]) => {
  if (!changes.length) return '—'
  const names = changes.slice(0, 4).map((c) => c.field).join(', ')
  return changes.length > 4 ? `${names} и ещё ${changes.length - 4}` : names
}

const operationColor = (op: string | null) => {
  const key = (op || '').toUpperCase()
  if (key === 'INSERT') return 'green'
  if (key === 'DELETE') return 'error'
  if (key === 'UPDATE') return 'primary'
  return 'grey'
}

let loadedFilterKey = ''

const load = async () => {
  loadedFilterKey = JSON.stringify(filter)
  loading.value = true
  error.value = ''
  try {
    const res = await fastApiService.getAuditLog({
      table: filter.table?.trim() || null,
      record_id: Number.isFinite(filter.record_id as number) ? filter.record_id : null,
      changed_by: filter.changed_by?.trim() || null,
      operation: filter.operation,
      date_from: filter.date_from || null,
      date_to: filter.date_to || null,
      change_group_id: filter.change_group_id,
      page: page.value,
      page_size: itemsPerPage.value,
    })
    items.value = res.items
    total.value = res.total
    note.value = res.note || ''
  } catch (e: any) {
    error.value = e?.userMessage || e?.message || 'Не удалось загрузить историю правок'
  } finally {
    loading.value = false
  }
}

const loadLookups = async () => {
  if (lookups.value.tables.length) return
  try {
    lookups.value = await fastApiService.getAuditLookups()
  } catch {
    // фильтры остаются свободным вводом
  }
}

const focusObject = (item: AuditLogItem) => {
  Object.assign(filter, emptyFilter(), { table: item.table_name, record_id: item.record_id })
}

const focusGroup = (groupId: string) => {
  Object.assign(filter, emptyFilter(), { change_group_id: groupId })
}

const resetFilter = () => Object.assign(filter, emptyFilter())

let reloadTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => ({ ...filter }),
  () => {
    if (!visible.value || JSON.stringify(filter) === loadedFilterKey) return
    if (reloadTimer) clearTimeout(reloadTimer)
    // текстовые фильтры — с задержкой, чтобы не дёргать API на каждый символ
    reloadTimer = setTimeout(() => {
      page.value = 1
      expanded.value = []
      void load()
    }, 350)
  },
)

/** scope из карточки объекта: история именно этой записи */
const openDialog = (scope?: { table?: string; recordId?: number }) => {
  Object.assign(filter, emptyFilter(), {
    table: scope?.table ?? null,
    record_id: scope?.recordId ?? null,
  })
  page.value = 1
  expanded.value = []
  visible.value = true
  void loadLookups()
  void load()
}

defineExpose({ openDialog })
</script>

<style scoped>
.audit-diff {
  border-collapse: collapse;
  font-size: 0.8rem;
  width: 100%;
}
.audit-diff th,
.audit-diff td {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 2px 8px;
  text-align: left;
  vertical-align: top;
  word-break: break-word;
}
.audit-diff__old {
  color: rgb(var(--v-theme-error));
}
.audit-diff__new {
  color: rgb(var(--v-theme-success));
}
</style>
