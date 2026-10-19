<template>
  <v-dialog
    v-model="open"
    max-width="640"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon
          start
          size="20"
        >
          mdi-history
        </v-icon>
        История правок
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          size="small"
          :loading="loading"
          aria-label="Обновить"
          @click="load"
        />
      </v-card-title>
      <v-card-subtitle class="pb-2">
        Ваши последние правки сети и свойств. «Откатить до сюда» отменяет правки от последней до выбранной.
      </v-card-subtitle>
      <v-card-text class="pt-0">
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ error }}
        </v-alert>
        <div
          v-if="!loading && !items.length && !error"
          class="text-medium-emphasis text-body-2 py-4 text-center"
        >
          Правок пока нет
        </div>
        <v-list
          density="compact"
          class="history-list"
        >
          <v-list-item
            v-for="(h, i) in items"
            :key="h.operation_id"
            :class="{ 'history-undone': h.undone_at }"
          >
            <template #prepend>
              <v-icon
                size="18"
                :color="h.undone_at ? 'grey' : 'primary'"
              >
                {{ operationIcon(h.operation) }}
              </v-icon>
            </template>
            <v-list-item-title class="text-body-2">
              {{ capitalize(topologyOperationLabel(h)) }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ formatTime(h.created_at) }}<template v-if="h.undone_at">
                · отменено {{ formatTime(h.undone_at) }}
              </template>
            </v-list-item-subtitle>
            <template #append>
              <v-btn
                v-if="h.bbox"
                icon="mdi-image-filter-center-focus"
                variant="text"
                size="small"
                aria-label="Показать на карте"
                title="Показать на карте"
                @click="emit('show', h.bbox)"
              />
              <v-btn
                v-if="!h.undone_at && h.undo_supported"
                variant="text"
                size="small"
                color="warning"
                :loading="busyId === h.operation_id"
                :disabled="busyId !== null"
                @click="rollback(h, i)"
              >
                {{ i === firstActive ? 'Отменить' : 'Откатить до сюда' }}
              </v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/** «История правок» пользователя (журнал отмены: сеть и карточки): показать на карте, откатить до места */
import { computed, ref, watch } from 'vue'
import { confirmAction } from '~/composables/useConfirm'
import { formatApiError } from '~/utils/apiError'
import { fastApiService, type TopologyHistoryItem } from '~/services/fastApiService'
import { useNotificationStore } from '~/stores/notificationStore'
import { topologyOperationLabel } from '~/utils/topologyLabels'

const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ show: [bbox: number[]]; changed: [] }>()

const items = ref<TopologyHistoryItem[]>([])
const loading = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)

/** первая неотменённая — у неё «Отменить» (как Ctrl+Z) */
const firstActive = computed(() => items.value.findIndex((h) => !h.undone_at))

const ICONS: Record<string, string> = {
  CHAIN: 'mdi-vector-polyline-plus', CREATE_NODE: 'mdi-circle-medium', CREATE_LINE: 'mdi-vector-line',
  MOVE: 'mdi-cursor-move', GEOMETRY: 'mdi-vector-polyline-edit', DELETE_NODE: 'mdi-delete-outline',
  DELETE_LINE: 'mdi-delete-outline', SPLIT: 'mdi-source-branch-plus', MERGE: 'mdi-call-merge',
  DISSOLVE_NODE: 'mdi-vector-polyline-remove', CARD_EDIT: 'mdi-card-text-outline', REVERSE: 'mdi-swap-horizontal',
}
const operationIcon = (op: string) => ICONS[op] || 'mdi-pencil-outline'
const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
const formatTime = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    items.value = (await fastApiService.getTopologyHistory(50)).items
  } catch (e) {
    error.value = formatApiError(e, 'Не удалось загрузить историю')
  } finally {
    loading.value = false
  }
}

watch(open, (on) => { if (on) void load() }, { immediate: true })

const rollback = async (h: TopologyHistoryItem, index: number) => {
  const count = items.value.slice(0, index + 1).filter((x) => !x.undone_at).length
  if (count > 1 && !(await confirmAction({
    text: `Отменить ${count} последних правок — до «${topologyOperationLabel(h)}» включительно?`,
    action: 'Откатить',
  }))) return
  busyId.value = h.operation_id
  const notify = useNotificationStore()
  try {
    const res = await fastApiService.undoTo(h.operation_id)
    if (res.complete) {
      notify.showSuccess(`Отменено правок: ${res.undone.length}`)
    } else {
      notify.showWarning(`Отменено правок: ${res.undone.length}; дальше нельзя — ${res.stopped?.reason ?? 'объекты изменены после правки'}`)
    }
    emit('changed')
  } catch (e) {
    notify.showError(formatApiError(e, 'Не удалось откатить'))
  } finally {
    busyId.value = null
    await load()
  }
}
</script>

<style scoped>
.history-list {
  max-height: 60vh;
  overflow-y: auto;
}
.history-undone :deep(.v-list-item-title) {
  text-decoration: line-through;
  opacity: 0.6;
}
</style>
