<template>
  <v-dialog
    v-model="visible"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1250"
    scrollable
  >
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center ga-2 py-2">
        <v-icon>mdi-account-clock-outline</v-icon>
        Журнал действий
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-file-delimited-outline"
          :loading="exporting"
          @click="exportCsv"
        >
          В Excel (CSV)
        </v-btn>
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
          <AppSelect
            v-model="filter.username"
            :items="lookups.users"
            label="Пользователь"
            style="min-width: 180px; flex: 1 1 180px;"
            searchable
          />
          <AppSelect
            v-model="filter.action"
            :items="lookups.actions"
            item-title="title"
            item-value="value"
            label="Действие"
            style="min-width: 190px; flex: 1 1 190px;"
          />
          <AppSelect
            v-if="lookups.cities.length > 1"
            v-model="filter.city"
            :items="lookups.cities"
            label="Город"
            style="min-width: 120px; flex: 0 1 140px;"
          />
          <v-text-field
            v-model="filter.date_from"
            type="date"
            label="С"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 160px;"
          />
          <v-text-field
            v-model="filter.date_to"
            type="date"
            label="По"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 160px;"
          />
          <v-text-field
            v-model="filter.q"
            label="Поиск: адрес, IP, подробности"
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="min-width: 200px; flex: 2 1 200px;"
          />
          <v-checkbox
            v-model="filter.failed"
            label="Только ошибки"
            density="compact"
            hide-details
          />
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
        <v-data-table-server
          :headers="headers"
          :items="items"
          :items-length="total"
          :loading="loading"
          :page="page"
          :items-per-page="pageSize"
          :items-per-page-options="[25, 50, 100, 200]"
          density="compact"
          no-data-text="Записей нет"
          @update:page="(p: number) => { page = p; void load() }"
          @update:items-per-page="(n: number) => { pageSize = n; page = 1; void load() }"
        >
          <template #[`item.at`]="{ item }">
            <span class="text-no-wrap">{{ formatAt(item.at) }}</span>
          </template>
          <template #[`item.action_label`]="{ item }">
            <v-chip
              size="x-small"
              variant="tonal"
              :color="actionColor(item.action)"
            >
              {{ item.action_label }}
            </v-chip>
          </template>
          <template #[`item.path`]="{ item }">
            <span
              class="text-caption activity-path"
              :title="item.user_agent || ''"
            >
              <b v-if="item.method">{{ item.method }}</b> {{ item.path }}
            </span>
          </template>
          <template #[`item.status`]="{ item }">
            <span :class="(item.status ?? 0) >= 400 ? 'text-error font-weight-bold' : 'text-medium-emphasis'">
              {{ item.status ?? '' }}
            </span>
          </template>
        </v-data-table-server>
        <div class="text-caption text-medium-emphasis mt-1">
          Пишутся входы и выходы, изменения данных, расчёты и выгрузки (без предпросмотров и чтения).
          Что именно изменилось в данных — «История правок».
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
/** Журнал действий всех пользователей (activity_log, право «Просмотр журнала действий») */
import { reactive, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { formatApiError } from '~/utils/apiError'
import { fastApiService, type ActivityLogItem, type ActivityLogQuery } from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'

const { mobile } = useDisplay()
const visible = ref(false)
const loading = ref(false)
const exporting = ref(false)
const error = ref('')
const items = ref<ActivityLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const lookups = reactive<{ users: string[]; cities: string[]; actions: { value: string; title: string }[] }>({
  users: [], cities: [], actions: [],
})
const emptyFilter = () => ({
  username: null as string | null,
  action: null as string | null,
  city: null as string | null,
  date_from: '' as string,
  date_to: '' as string,
  q: '' as string,
  failed: false,
})
const filter = reactive(emptyFilter())

const headers = [
  { title: 'Время', key: 'at', sortable: false, width: 150 },
  { title: 'Пользователь', key: 'username', sortable: false },
  { title: 'Город', key: 'city', sortable: false, width: 80 },
  { title: 'Действие', key: 'action_label', sortable: false },
  { title: 'Запрос', key: 'path', sortable: false },
  { title: 'Статус', key: 'status', sortable: false, width: 70 },
  { title: 'мс', key: 'duration_ms', sortable: false, width: 60 },
  { title: 'IP', key: 'ip', sortable: false },
]

const formatAt = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
  : '')
const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'green', LOGOUT: 'grey', LOGIN_FAIL: 'error', USERS: 'purple', PASSWORD: 'purple',
  NETWORK: 'deep-orange', UNDO: 'orange', CARD: 'blue', GROUP: 'indigo', CALC_RUN: 'teal',
  CALC_SAVE: 'teal', EXPORT: 'brown', IMPORT: 'deep-purple',
}
const actionColor = (a: string) => ACTION_COLORS[a] || undefined

const query = (): ActivityLogQuery => ({
  username: filter.username || undefined,
  action: filter.action || undefined,
  city: filter.city || undefined,
  date_from: filter.date_from || undefined,
  date_to: filter.date_to || undefined,
  q: filter.q?.trim() || undefined,
  failed: filter.failed || undefined,
})

let request = 0
const load = async () => {
  const id = ++request
  loading.value = true
  error.value = ''
  try {
    const res = await fastApiService.getActivityLog({ ...query(), page: page.value, page_size: pageSize.value })
    if (id !== request) return
    items.value = res.items
    total.value = res.total
    Object.assign(lookups, res.lookups)
  } catch (e) {
    if (id === request) error.value = formatApiError(e, 'Не удалось загрузить журнал действий')
  } finally {
    if (id === request) loading.value = false
  }
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null
watch(() => ({ ...filter }), () => {
  if (!visible.value) return
  if (reloadTimer) clearTimeout(reloadTimer)
  // поиск — с задержкой, чтобы не дёргать API на каждый символ
  reloadTimer = setTimeout(() => {
    page.value = 1
    void load()
  }, 350)
})

const exportCsv = async () => {
  exporting.value = true
  try {
    const blob = await fastApiService.downloadActivityLogCsv(query())
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `журнал-действий-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    useNotificationStore().showError(formatApiError(e, 'Не удалось выгрузить журнал'))
  } finally {
    exporting.value = false
  }
}

/** scope: { username } — журнал одного пользователя (из админки) */
const openDialog = (scope?: { username?: string }) => {
  Object.assign(filter, emptyFilter(), { username: scope?.username ?? null })
  page.value = 1
  visible.value = true
  void load()
}

defineExpose({ openDialog })
</script>

<style scoped>
.activity-path {
  word-break: break-all;
}
</style>
