<template>
  <v-dialog
    v-model="visible"
    :fullscreen="isMobile"
    max-width="1100"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon>mdi-file-excel</v-icon>
        Отчёты Excel
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Закрыть"
          @click="visible = false"
        />
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Таблицы десктопа (меню «Excel»): шаблон и шапка как в gid6, данные по фрагменту и расчёту.
        </p>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ error }}
        </v-alert>

        <div class="er-layout">
          <div class="er-list">
            <v-text-field
              v-model="search"
              prepend-inner-icon="mdi-magnify"
              label="Поиск отчёта"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              class="mb-2"
            />
            <v-progress-linear
              v-if="loadingCatalog"
              indeterminate
              color="primary"
              class="mb-2"
            />
            <v-list
              density="compact"
              nav
              class="er-scroll"
            >
              <template
                v-for="group in groups"
                :key="group.title"
              >
                <v-list-subheader>{{ group.title }}</v-list-subheader>
                <v-list-item
                  v-for="item in group.items"
                  :key="`${item.kind}:${item.id}`"
                  :active="selected?.id === item.id && selected?.kind === item.kind"
                  color="primary"
                  :subtitle="item.sheets.length > 1 ? `${item.sheets.length} листа(ов)` : undefined"
                  @click="select(item)"
                >
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                  <template #append>
                    <v-icon
                      v-if="item.uses_calculation"
                      size="16"
                      color="indigo"
                      title="Нужны результаты расчёта"
                    >
                      mdi-calculator
                    </v-icon>
                  </template>
                </v-list-item>
              </template>
              <div
                v-if="!loadingCatalog && !groups.length"
                class="text-body-2 text-medium-emphasis pa-2"
              >
                Ничего не найдено.
              </div>
            </v-list>
          </div>

          <div class="er-detail">
            <template v-if="selected">
              <div class="text-subtitle-1 mb-1">{{ selected.title }}</div>
              <div
                v-if="selected.desktop"
                class="text-caption text-medium-emphasis mb-2"
              >
                gid6: {{ selected.desktop }}
              </div>
              <v-alert
                v-if="selected.note"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-2"
              >
                {{ selected.note }}
              </v-alert>

              <div class="d-flex flex-wrap ga-1 mb-3">
                <v-chip
                  v-for="sheet in selected.sheets"
                  :key="sheet.title"
                  size="small"
                  variant="tonal"
                >
                  {{ sheet.title }}
                </v-chip>
              </div>

              <div class="d-flex flex-column ga-3">
                <v-autocomplete
                  v-if="needsFragment"
                  v-model="fragmentId"
                  :items="fragmentItems"
                  item-title="title"
                  item-value="value"
                  label="Фрагмент"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
                <v-select
                  v-if="selected.uses_calculation"
                  v-model="calculationId"
                  :items="calculationItems"
                  item-title="title"
                  item-value="value"
                  label="Расчёт"
                  density="compact"
                  variant="outlined"
                  hide-details
                  :loading="loadingCalculations"
                  :disabled="!fragmentId"
                />
                <v-text-field
                  v-if="selected.params.year"
                  v-model.number="year"
                  type="number"
                  label="Год (необязательно)"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
                <p
                  v-if="selected.uses_calculation && fragmentId && !loadingCalculations && !calculations.length"
                  class="text-caption text-warning mb-0"
                >
                  У фрагмента нет расчёта: листы результатов будут только с шапкой.
                </p>
                <div>
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-download"
                    :loading="downloading"
                    :disabled="needsFragment && !fragmentId"
                    @click="download"
                  >
                    Скачать Excel
                  </v-btn>
                </div>
                <p
                  v-if="downloading && progressText"
                  class="text-caption text-medium-emphasis mb-0"
                  data-testid="file-job-progress"
                >{{ progressText }}</p>
                <p
                  v-else-if="lastDownload"
                  class="text-caption text-medium-emphasis mb-0"
                >{{ lastDownload }}</p>
              </div>
            </template>
            <div
              v-else
              class="text-body-2 text-medium-emphasis"
            >Выберите отчёт в списке.</div>

            <details
              v-if="notPorted.length"
              class="mt-4 text-caption text-medium-emphasis"
            >
              <summary>Не перенесены из десктопа ({{ notPorted.length }})</summary>
              <ul class="mt-1">
                <li
                  v-for="n in notPorted"
                  :key="n.sql"
                >{{ n.sql }} — {{ n.reason }}</li>
              </ul>
            </details>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { formatApiError } from '~/utils/apiError'
import { computed, ref, watch } from 'vue'
import { useMobile } from '~/composables/useMobile'
import {
  describeFileJobProgress,
  fastApiService,
  type CalculationListItem,
  type FileJobProgress,
  type ReportCatalogItem,
} from '~/services/fastApiService'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { groupReports, reportNeedsFragment, saveBlob } from '~/utils/reportsCatalog'

const { isMobile } = useMobile()
const fragmentStore = useFragmentStore()

const visible = ref(false)
const error = ref('')
const search = ref('')
const items = ref<ReportCatalogItem[]>([])
const notPorted = ref<{ sql: string; reason: string }[]>([])
const loadingCatalog = ref(false)
const selected = ref<ReportCatalogItem | null>(null)
const fragmentId = ref<number | null>(null)
const calculationId = ref<number | null>(null)
const calculations = ref<CalculationListItem[]>([])
const loadingCalculations = ref(false)
const year = ref<number | null>(null)
const downloading = ref(false)
const lastDownload = ref('')
const progressText = ref('')
const onProgress = (p: FileJobProgress) => {
  progressText.value = describeFileJobProgress(p)
}

const groups = computed(() => groupReports(items.value, search.value || ''))
const needsFragment = computed(() => reportNeedsFragment(selected.value))

const fragmentItems = computed(() =>
  fragmentStore.fragments.map((f: { id: number; name?: string }) => ({
    value: f.id,
    title: f.name ? `${f.name} (#${f.id})` : `Фрагмент #${f.id}`,
  })),
)

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU') : '')

const calculationItems = computed(() => [
  { value: null, title: 'Последний расчёт фрагмента' },
  ...calculations.value.map((c) => ({
    value: c.id,
    title: `№${c.id} ${c.name || ''} ${formatDate(c.calculated_at)}${c.tn != null ? `, Tн ${c.tn} °C` : ''}`.trim(),
  })),
])

const select = (item: ReportCatalogItem) => {
  selected.value = item
  lastDownload.value = ''
}

const loadCalculations = async () => {
  calculations.value = []
  calculationId.value = null
  if (!fragmentId.value || !selected.value?.uses_calculation) return
  loadingCalculations.value = true
  try {
    const res = await fastApiService.listCalculations({ file_id: fragmentId.value, limit: 50 })
    calculations.value = res.items.filter((c) => c.has_results !== false)
  } catch {
    // список расчётов — только для выбора; без него берётся последний расчёт
  } finally {
    loadingCalculations.value = false
  }
}

watch([fragmentId, () => selected.value?.uses_calculation], loadCalculations)

const download = async () => {
  const item = selected.value
  if (!item) return
  downloading.value = true
  progressText.value = ''
  error.value = ''
  try {
    let result: { blob: Blob; filename: string }
    if (item.kind === 'summary') {
      result = await fastApiService.downloadExcelReport(item.id, year.value ? { year: year.value } : undefined, { onProgress })
    } else {
      if (!fragmentId.value) return
      result = await fastApiService.downloadCatalogReport(item, {
        fragment_id: fragmentId.value,
        calculation_id: calculationId.value,
      }, { onProgress })
    }
    saveBlob(result.blob, result.filename)
    lastDownload.value = `Скачан ${result.filename}`
    useNotificationStore().showSuccess(`Отчёт «${item.title}» сформирован`)
  } catch (e: any) {
    error.value = formatApiError(e)
  } finally {
    downloading.value = false
  }
}

const loadCatalog = async () => {
  loadingCatalog.value = true
  error.value = ''
  try {
    const catalog = await fastApiService.getReportsCatalog()
    items.value = catalog.items
    notPorted.value = catalog.not_ported
  } catch (e: any) {
    error.value = formatApiError(e, 'Не удалось загрузить каталог отчётов')
  } finally {
    loadingCatalog.value = false
  }
}

const openDialog = async () => {
  visible.value = true
  if (fragmentId.value == null) {
    fragmentId.value = fragmentStore.selectedFragmentId
      ?? (fragmentStore.visibleFragments.length === 1 ? [...fragmentStore.visibleFragments][0] : null)
  }
  if (!items.value.length) await loadCatalog()
}

defineExpose({ openDialog })
</script>

<style scoped>
.er-layout { display: grid; grid-template-columns: minmax(260px, 360px) 1fr; gap: 16px; }
.er-scroll { max-height: 60vh; overflow-y: auto; }
.er-detail { min-width: 0; }
@media (max-width: 760px) {
  .er-layout { grid-template-columns: 1fr; }
  .er-scroll { max-height: 40vh; }
}
</style>
