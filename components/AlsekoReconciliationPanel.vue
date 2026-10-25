<template>
  <div class="alseko-rec pa-3">
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
      closable
      @click:close="error = ''"
    >{{ error }}</v-alert>

    <!-- Сверка -->
    <div class="d-flex flex-wrap align-center ga-2 mb-2">
      <div class="text-subtitle-1 font-weight-bold">Сверка nagruzki ↔ здания</div>
      <span
        v-if="summary"
        class="text-caption text-medium-emphasis"
      >
        договоров {{ fmtInt(summary.totals.loads) }}, зданий с адресом АЛСЕКО {{ fmtInt(summary.totals.bound_buildings) }},
        с потребителем {{ fmtInt(summary.totals.buildings_with_consumer) }}
      </span>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-refresh"
        :loading="loadingSummary"
        @click="loadSummary"
      >Обновить</v-btn>
      <v-btn
        size="small"
        color="green-darken-2"
        variant="tonal"
        prepend-icon="mdi-microsoft-excel"
        :loading="downloading"
        @click="downloadReport"
      >Отчёт Excel</v-btn>
    </div>
    <!-- Виды несоответствий — плитки-фильтры: ноль — в порядке, иначе внимание -->
    <div class="rec-kinds mb-3">
      <KpiTile
        v-for="k in summary?.kinds || []"
        :key="k.kind"
        :label="k.label"
        :value="k.count"
        :status="k.count ? 'warning' : 'good'"
        :title="k.desktop_report ? `Отчёт десктопа ${k.desktop_report}` : 'Дополнительная проверка веба'"
        selectable
        :active="k.kind === kind"
        @select="selectKind(k.kind)"
      />
    </div>
    <StateView
      v-if="kind"
      variant="table"
      :rows="6"
      :loading="loadingIssues && !issues"
      :empty="Boolean(issues && !issues.items.length)"
      empty-title="Несоответствий нет"
      :retry="false"
      class="rec-table-wrap mb-2"
    >
      <DataTable
        v-if="issues"
        :columns="issueTableColumns"
        :items="issueRows"
        item-key="__row"
        selectable
        density="compact"
        :loading="loadingIssues"
        @select="openIssue"
      />
    </StateView>
    <div
      v-if="issues && issuePages > 1"
      class="d-flex justify-center"
    >
      <v-pagination
        v-model="issuePage"
        :length="issuePages"
        density="compact"
        :total-visible="7"
        @update:model-value="loadIssues"
      />
    </div>

    <v-divider class="my-4" />

    <!-- Привязка здания к адресу (десктоп: BigDialog) -->
    <div class="text-subtitle-1 font-weight-bold mb-1">Привязка здания к адресу АЛСЕКО</div>
    <div class="text-caption text-medium-emphasis mb-2">
      В здание записываются адрес АЛСЕКО и суммы нагрузок адреса (Гкал/ч), как в десктопе. Сначала предпросмотр.
    </div>
    <v-alert
      v-if="!canEdit"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-2"
    >Привязка доступна роли «Редактор» и выше.</v-alert>
    <v-row dense>
      <v-col
        cols="12"
        md="2"
      ><v-text-field
        v-model.number="buildingId"
        type="number"
        label="ID здания"
        density="compact"
        hide-details
      /></v-col>
      <v-col
        cols="12"
        md="6"
      ><v-text-field
        v-model="addressQuery"
        label="Поиск адреса (улица, дом); пусто — по геоадресу здания"
        density="compact"
        hide-details
        clearable
        @keyup.enter="searchAddresses"
      /></v-col>
      <v-col
        cols="12"
        md="4"
        class="d-flex ga-2"
      >
        <v-btn
          :loading="searching"
          prepend-icon="mdi-magnify"
          @click="searchAddresses"
        >Найти</v-btn>
        <v-btn
          :disabled="!canEdit || !buildingId"
          variant="text"
          color="red-darken-2"
          @click="previewAddress(true)"
        >Снять привязку…</v-btn>
      </v-col>
    </v-row>
    <v-list
      v-if="candidates.length"
      density="compact"
      class="candidate-list my-2"
    >
      <v-list-item
        v-for="(c, i) in candidates"
        :key="i"
        :active="chosen === c"
        color="indigo"
        @click="chosen = c"
      >
        <v-list-item-title>{{ [c.microdistrict, c.street, c.house].filter(Boolean).join(', ') }}</v-list-item-title>
        <v-list-item-subtitle>
          договоров {{ c.load_count }}, Q сум {{ fmt(c.total_load) }} Гкал/ч (от {{ fmt(c.heating_load) }}, ГВС {{ fmt(c.hot_water_load) }});
          зданий с этим адресом: {{ c.building_count }}
        </v-list-item-subtitle>
      </v-list-item>
    </v-list>
    <div
      v-else-if="searched"
      class="text-caption text-medium-emphasis my-2"
    >Адреса не найдены.</div>
    <div class="d-flex ga-2 my-2">
      <v-btn
        :disabled="!canEdit || !buildingId || !chosen"
        :loading="binding"
        color="indigo-darken-2"
        variant="tonal"
        @click="previewAddress(false)"
      >Предпросмотр</v-btn>
      <v-btn
        v-if="addressPreview?.dry_run && addressPreview.changes.length"
        :disabled="!canEditData"
        :loading="binding"
        color="indigo-darken-2"
        @click="applyAddress"
      >Применить</v-btn>
    </div>
    <div
      v-if="addressPreview"
      class="mb-2"
    >
      <v-alert
        v-if="addressPreview.other_buildings_with_address.length"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-2"
      >
        Этот адрес уже записан в здания: {{ addressPreview.other_buildings_with_address.join(', ') }} — адрес станет неоднозначным.
      </v-alert>
      <DataTable
        v-if="addressPreview.changes.length"
        :columns="changeColumns"
        :items="changeRows"
        item-key="field"
        density="compact"
      />
      <div
        v-else
        class="text-caption text-medium-emphasis"
      >
        Изменений нет — здание уже в этом состоянии.
      </div>
      <div
        v-if="!addressPreview.dry_run"
        class="text-caption text-green-darken-2"
      >Записано, группа аудита {{ addressPreview.change_group_id || '—' }}.</div>
      <div
        v-else-if="!canEditData && canEdit"
        class="text-caption text-medium-emphasis"
      >Запись выключена на сервере (MUTATIONS_ENABLED).</div>
    </div>

    <v-divider class="my-4" />

    <!-- Здания → потребитель (десктоп: GidWidget::alseco) -->
    <div class="text-subtitle-1 font-weight-bold mb-1">Здания → потребитель</div>
    <div class="text-caption text-medium-emphasis mb-2">
      Зданиям записывается потребитель «код узел»; прежние здания этого потребителя отвязываются.
      Нагрузки в карточку потребителя переносятся вручную по сводке предпросмотра.
    </div>
    <v-row dense>
      <v-col
        cols="12"
        md="2"
      ><v-text-field
        v-model.number="consumerNodeId"
        type="number"
        label="ID узла потребителя"
        density="compact"
        hide-details
      /></v-col>
      <v-col
        cols="12"
        md="6"
      ><v-text-field
        v-model="consumerBuildings"
        label="ID зданий через запятую"
        density="compact"
        hide-details
      /></v-col>
      <v-col
        cols="12"
        md="4"
        class="d-flex ga-2"
      >
        <v-btn
          :disabled="!canEdit || !consumerNodeId"
          :loading="consumerBinding"
          color="indigo-darken-2"
          variant="tonal"
          @click="previewConsumer"
        >Предпросмотр</v-btn>
        <v-btn
          v-if="consumerPreview?.dry_run && (consumerPreview.assign.length || consumerPreview.unassign.length)"
          :disabled="!canEditData"
          :loading="consumerBinding"
          color="indigo-darken-2"
          @click="applyConsumer"
        >Применить</v-btn>
      </v-col>
    </v-row>
    <div
      v-if="consumerPreview"
      class="mt-2 text-body-2"
    >
      <div><b>{{ consumerPreview.consumer.label }}</b> (узел {{ consumerPreview.consumer.node_id }})</div>
      <div>Привязать: {{ consumerPreview.assign.map(b => b.id).join(', ') || '—' }}; отвязать: {{ consumerPreview.unassign.map(b => b.id).join(', ') || '—' }}</div>
      <div class="text-caption">
        Нагрузки, Гкал/ч: отопление зав. элев. {{ fmt(consumerPreview.loads.heating_dependent_elevator) }},
        зав. безэлев. {{ fmt(consumerPreview.loads.heating_dependent_direct) }}, незав. {{ fmt(consumerPreview.loads.heating_independent) }};
        ГВС откр. подача {{ fmt(consumerPreview.loads.hot_water_open_supply) }}, вент. {{ fmt(consumerPreview.loads.ventilation) }}, сумма {{ fmt(consumerPreview.loads.total) }}
      </div>
      <v-alert
        v-for="w in consumerPreview.warnings"
        :key="w"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-1"
      >{{ w }}</v-alert>
      <div
        v-if="!consumerPreview.dry_run"
        class="text-caption text-green-darken-2"
      >Записано, группа аудита {{ consumerPreview.change_group_id || '—' }}.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import KpiTile from '~/components/KpiTile.vue'
import StateView from '~/components/StateView.vue'
import { formatApiError } from '~/utils/apiError'
import { computed, onMounted, ref, watch } from 'vue'
import {
  fastApiService,
  type AlsekoAddressBindResult,
  type AlsekoAddressCandidate,
  type AlsekoConsumerBindResult,
  type AlsekoFieldChange,
  type AlsekoReconciliationIssues,
  type AlsekoReconciliationSummary
} from '~/services/fastApiService'
import { useAuthStore } from '~/stores/authStore'
import { parseIdList, alsekoColumnTitle, ALSEKO_BUILDING_KINDS, ALSEKO_LOAD_KINDS } from '~/utils/alsekoReconciliation'

const props = defineProps<{ buildingId?: number | null }>()
const emit = defineEmits<{ 'open-building': [id: number]; 'open-load': [id: number] }>()

const authStore = useAuthStore()
const canEdit = computed(() => authStore.canEdit)
const canEditData = computed(() => authStore.canEditData)

const error = ref('')
const summary = ref<AlsekoReconciliationSummary | null>(null)
const loadingSummary = ref(false), downloading = ref(false)
const kind = ref(''), issues = ref<AlsekoReconciliationIssues | null>(null), issuePage = ref(1)
const PAGE = 50
const issuePages = computed(() => issues.value ? Math.ceil(issues.value.total / PAGE) : 0)
const loadingIssues = ref(false)
const issueColumns = computed(() => Object.keys(issues.value?.items[0] || {}))
const issueTableColumns = computed((): DataTableColumn[] => issueColumns.value.map((c) => ({ key: c, title: columnTitle(c), sortable: false })))
/** Строки таблицы: значения уже в текстовом виде, ключ — номер строки (у несоответствий нет своего id) */
const issueRows = computed(() => (issues.value?.items || []).map((row, i) => ({
  ...Object.fromEntries(issueColumns.value.map((c) => [c, cell(row[c])])), __row: i, __source: row,
})))
const changeColumns: DataTableColumn[] = [
  { key: 'field', title: 'Поле', sortable: false },
  { key: 'old', title: 'Было', sortable: false },
  { key: 'new', title: 'Станет', sortable: false },
]
const changeRows = computed(() => (addressPreview.value?.changes || []).map((c: AlsekoFieldChange) => ({ field: c.field, old: cell(c.old), new: cell(c.new) })))

const buildingId = ref<number | null>(props.buildingId ?? null)
const addressQuery = ref(''), searching = ref(false), searched = ref(false)
const candidates = ref<AlsekoAddressCandidate[]>([]), chosen = ref<AlsekoAddressCandidate | null>(null)
const addressPreview = ref<AlsekoAddressBindResult | null>(null), binding = ref(false)
const consumerNodeId = ref<number | null>(null), consumerBuildings = ref('')
const consumerPreview = ref<AlsekoConsumerBindResult | null>(null), consumerBinding = ref(false)

watch(() => props.buildingId, (id) => {
  if (id) { buildingId.value = id; addressPreview.value = null; void searchAddresses() }
})

function fmtInt(v: unknown) { return Number(v || 0).toLocaleString('ru-RU') }
function fmt(v: unknown) { return v === null || v === undefined ? '—' : Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 6 }) }
function cell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'number') return fmt(v)
  return String(v)
}
const columnTitle = alsekoColumnTitle
function fail(cause: unknown, fallback: string) {
  const anyCause = cause as { data?: { detail?: { message?: string } | string }, message?: string }
  const detail = anyCause?.data?.detail
  error.value = (typeof detail === 'object' ? detail?.message : detail) || formatApiError(cause, fallback)
}

async function loadSummary() {
  loadingSummary.value = true
  try {
    summary.value = await fastApiService.getAlsekoReconciliation()
    if (!kind.value) {
      const first = summary.value.kinds.find((k) => k.count > 0)
      if (first) await selectKind(first.kind)
    } else await loadIssues()
  } catch (cause) { fail(cause, 'Не удалось выполнить сверку') } finally { loadingSummary.value = false }
}
async function selectKind(k: string) { kind.value = k; issuePage.value = 1; await loadIssues() }
async function loadIssues() {
  if (!kind.value) return
  loadingIssues.value = true
  try { issues.value = await fastApiService.getAlsekoReconciliationIssues(kind.value, PAGE, (issuePage.value - 1) * PAGE) }
  catch (cause) { fail(cause, 'Не удалось загрузить несоответствия') }
  finally { loadingIssues.value = false }
}
function openIssue(selectedRow: Record<string, unknown>) {
  const row = (selectedRow.__source as Record<string, unknown> | undefined) || selectedRow
  const id = Number(row.id)
  if (!id) return
  if (ALSEKO_BUILDING_KINDS.has(kind.value)) { buildingId.value = id; emit('open-building', id) } else if (ALSEKO_LOAD_KINDS.has(kind.value)) emit('open-load', id)
}
async function downloadReport() {
  downloading.value = true
  try {
    const blob = await fastApiService.downloadAlsekoReconciliationReport()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `alseko_reconciliation_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) { fail(cause, 'Не удалось сформировать отчёт') } finally { downloading.value = false }
}

async function searchAddresses() {
  searching.value = true; chosen.value = null
  try {
    const res = await fastApiService.getAlsekoAddresses({ q: addressQuery.value || undefined, building_id: buildingId.value || undefined, limit: 30 })
    candidates.value = res.items; searched.value = true
    if (!addressQuery.value && res.query) addressQuery.value = res.query
  } catch (cause) { fail(cause, 'Не удалось найти адреса') } finally { searching.value = false }
}
async function previewAddress(clear: boolean) {
  if (!buildingId.value) return
  binding.value = true
  try {
    const c = chosen.value
    addressPreview.value = await fastApiService.bindAlsekoBuildingAddress(buildingId.value, clear || !c
      ? { house: null, dry_run: true }
      : { microdistrict: c.microdistrict, street: c.street, house: c.house, dry_run: true })
  } catch (cause) { fail(cause, 'Предпросмотр не удался') } finally { binding.value = false }
}
async function applyAddress() {
  const p = addressPreview.value
  if (!p || !buildingId.value) return
  binding.value = true
  try {
    const c = chosen.value
    addressPreview.value = await fastApiService.bindAlsekoBuildingAddress(buildingId.value, p.action === 'clear' || !c
      ? { house: null, dry_run: false }
      : { microdistrict: c.microdistrict, street: c.street, house: c.house, dry_run: false })
    await loadSummary()
  } catch (cause) { fail(cause, 'Привязка не записана') } finally { binding.value = false }
}
async function previewConsumer() {
  if (!consumerNodeId.value) return
  consumerBinding.value = true
  try {
    consumerPreview.value = await fastApiService.bindAlsekoConsumerBuildings(consumerNodeId.value, { building_ids: parseIdList(consumerBuildings.value), dry_run: true })
  } catch (cause) { fail(cause, 'Предпросмотр не удался') } finally { consumerBinding.value = false }
}
async function applyConsumer() {
  if (!consumerNodeId.value) return
  consumerBinding.value = true
  try {
    consumerPreview.value = await fastApiService.bindAlsekoConsumerBuildings(consumerNodeId.value, { building_ids: parseIdList(consumerBuildings.value), dry_run: false })
    await loadSummary()
  } catch (cause) { fail(cause, 'Привязка не записана') } finally { consumerBinding.value = false }
}

onMounted(() => {
  void loadSummary()
  if (buildingId.value) void searchAddresses()
})
</script>

<style scoped>
.rec-kinds { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.rec-table-wrap { max-height: 360px; overflow: auto; border: 1px solid rgba(var(--v-theme-on-surface), 0.12); border-radius: var(--radius-sm); }
.candidate-list { max-height: 240px; overflow: auto; border: 1px solid rgba(var(--v-theme-on-surface), 0.12); border-radius: var(--radius-sm); }
</style>
