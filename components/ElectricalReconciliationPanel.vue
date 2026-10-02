<template>
  <div class="pa-3 el-rec">
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      closable
      class="mb-3"
      @click:close="error = ''"
    >{{ error }}</v-alert>
    <div class="text-caption text-medium-emphasis mb-2">
      Правила десктопа (gid6 GeoFile.cpp): концы ЛЭП привязываются к источнику и приёмнику, муфты, опоры, гильзы и каналы
      получают id ЛЭП, на которой лежат. Допуск по умолчанию 8 м (D5); для площадных объектов радиус поиска ЛЭП ×10.
    </div>
    <div class="d-flex flex-wrap align-center ga-2 mb-3">
      <v-text-field
        v-model.number="tolerance"
        type="number"
        min="0.01"
        max="1000"
        step="1"
        label="Допуск, м"
        density="compact"
        hide-details
        style="max-width: 130px"
      />
      <v-select
        v-model="objectType"
        :items="typeItems"
        label="Вид объекта"
        density="compact"
        clearable
        hide-details
        style="max-width: 200px"
        @update:model-value="load"
      />
      <v-btn
        color="amber-darken-4"
        prepend-icon="mdi-magnify-scan"
        :loading="loading"
        @click="load"
      >Проверить</v-btn>
      <v-btn
        variant="tonal"
        prepend-icon="mdi-microsoft-excel"
        :loading="downloading"
        @click="downloadReport"
      >Excel несоответствий</v-btn>
      <v-spacer />
      <span
        v-if="result"
        class="text-caption text-medium-emphasis"
      >
        Проверено: {{ checkedText }}
      </span>
    </div>

    <div
      v-if="result"
      class="d-flex flex-wrap ga-2 mb-3"
    >
      <v-chip
        size="small"
        :variant="kind ? 'outlined' : 'flat'"
        color="amber-darken-4"
        @click="selectKind(null)"
      >Все объекты</v-chip>
      <v-chip
        v-for="k in result.kinds"
        :key="k.kind"
        size="small"
        :disabled="!k.count"
        :variant="kind === k.kind ? 'flat' : 'tonal'"
        :color="k.kind.startsWith('line') ? 'amber-darken-4' : 'teal'"
        @click="selectKind(k.kind)"
      >
        {{ k.label }}: {{ k.count }}
      </v-chip>
    </div>
    <v-alert
      v-if="result && !result.tables_present"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-3"
    >В этой БД нет таблиц электросети.</v-alert>

    <v-progress-linear
      v-if="loading"
      indeterminate
      color="amber-darken-4"
    />
    <div
      v-if="result && !result.items.length && !loading"
      class="text-body-2 text-medium-emphasis pa-4 text-center"
    >Несоответствий нет.</div>
    <div
      v-else-if="result"
      class="el-rec-table-wrap"
    >
      <table class="el-rec-table">
        <thead><tr><th>Вид</th><th>ID</th><th>Наименование</th><th>Несоответствия</th><th>Привязано сейчас</th><th>Найдено по геометрии</th><th /></tr></thead>
        <tbody>
          <tr
            v-for="item in result.items"
            :key="`${item.object_type}-${item.id}`"
          >
            <td>{{ typeTitle(item.object_type) }}</td>
            <td><a
              href="#"
              @click.prevent="emit('open-object', { objectType: item.object_type, id: item.id })"
            >{{ item.id }}</a></td>
            <td>{{ item.name || '—' }}</td>
            <td><div
              v-for="i in item.issues"
              :key="i"
            >{{ kindLabel(i) }}</div></td>
            <td>{{ currentText(item) }}</td>
            <td>{{ candidateText(item) }}</td>
            <td class="text-no-wrap">
              <v-btn
                v-if="hasCoords(item)"
                icon="mdi-crosshairs-gps"
                size="x-small"
                variant="text"
                title="Показать на карте"
                @click="locate(item)"
              />
              <v-btn
                v-if="canEdit"
                icon="mdi-link-variant"
                size="x-small"
                variant="text"
                title="Предпросмотр привязки"
                @click="preview([item])"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="result.total > result.items.length"
        class="text-caption text-medium-emphasis pa-2"
      >Показано {{ result.items.length }} из {{ result.total }}; полный список — в Excel.</div>
    </div>

    <v-card
      v-if="canEdit"
      variant="outlined"
      class="pa-3 mt-4"
    >
      <div class="text-subtitle-2 mb-2">Привязка по правилам десктопа</div>
      <div class="d-flex flex-wrap align-center ga-4">
        <v-checkbox
          v-model="overwrite"
          label="Заменять и неверные привязки (не только пустые)"
          density="compact"
          hide-details
        />
        <v-checkbox
          v-model="snapPoints"
          label="Проецировать муфты и опоры на ЛЭП"
          density="compact"
          hide-details
        />
        <v-btn
          variant="tonal"
          prepend-icon="mdi-magnify"
          :loading="binding"
          @click="preview(null)"
        >Предпросмотр для всех</v-btn>
      </div>
      <template v-if="plan">
        <div class="text-body-2 mt-3">
          {{ planScope }}: объектов к изменению {{ plan.counts.records }}, полей {{ plan.counts.fields }};
          без решения (нет объекта в допуске) {{ plan.counts.unresolved }}.
          <span
            v-if="!plan.dry_run"
            class="text-success"
          >Записано: {{ plan.applied }} (группа аудита {{ plan.change_group_id }}).</span>
        </div>
        <div
          v-if="plan.records.length"
          class="el-rec-table-wrap mt-2"
        >
          <table class="el-rec-table">
            <thead><tr><th>Вид</th><th>ID</th><th>Наименование</th><th>Поле</th><th>Было</th><th>Станет</th><th>Расст., м</th><th /></tr></thead>
            <tbody>
              <template
                v-for="r in plan.records"
                :key="`${r.object_type}-${r.id}`"
              >
                <tr
                  v-for="(c, idx) in r.changes"
                  :key="`${r.object_type}-${r.id}-${c.field}`"
                >
                  <td>{{ idx ? '' : typeTitle(r.object_type) }}</td><td>{{ idx ? '' : r.id }}</td><td>{{ idx ? '' : (r.name || '—') }}</td>
                  <td>{{ fieldTitle(c.field) }}</td><td>{{ cell(c.old) }}</td><td>{{ cell(c.new) }}</td><td>{{ cell(c.distance) }}</td>
                  <td><v-btn
                    v-if="!idx && hasCoords(r)"
                    icon="mdi-crosshairs-gps"
                    size="x-small"
                    variant="text"
                    @click="locate(r)"
                  /></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div
          v-if="plan.dry_run && plan.records.length"
          class="d-flex align-center ga-2 mt-3"
        >
          <v-btn
            color="amber-darken-4"
            prepend-icon="mdi-content-save"
            :disabled="!canEditData"
            :loading="binding"
            @click="apply"
          >Применить ({{ plan.counts.records }})</v-btn>
          <span
            v-if="!canEditData"
            class="text-caption text-medium-emphasis"
          >Запись отключена на сервере (MUTATIONS_ENABLED=false).</span>
        </div>
      </template>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { formatApiError } from '~/utils/apiError'
import { pluralRu } from '~/utils/pluralRu'
import { confirmAction } from '~/composables/useConfirm'
import { computed, onMounted, ref } from 'vue'
import {
  fastApiService,
  type ElectricalBindObjectType,
  type ElectricalBindResult,
  type ElectricalReconciliation,
  type ElectricalReconciliationItem
} from '~/services/fastApiService'
import { useAuthStore } from '~/stores/authStore'
import { electricalCandidateText, electricalCurrentText, ELECTRICAL_FIELD_TITLES, ELECTRICAL_TYPE_TITLES } from '~/utils/electricalReconciliation'

type Located = { object_type: ElectricalBindObjectType; id: number; name: string | null; longitude: number | null; latitude: number | null }
const emit = defineEmits<{
  locate: [payload: { longitude: number; latitude: number; id: number; objectType: ElectricalBindObjectType; label: string }]
  'open-object': [payload: { objectType: ElectricalBindObjectType; id: number }]
}>()

const authStore = useAuthStore()
const canEdit = computed(() => authStore.canEdit)
const canEditData = computed(() => authStore.canEditData)

const tolerance = ref(8), objectType = ref<ElectricalBindObjectType | null>(null), kind = ref<string | null>(null)
const result = ref<ElectricalReconciliation | null>(null), loading = ref(false), downloading = ref(false), error = ref('')
const overwrite = ref(false), snapPoints = ref(false), binding = ref(false)
const plan = ref<ElectricalBindResult | null>(null), planItems = ref<{ object_type: ElectricalBindObjectType; id: number }[] | null>(null)

const typeItems = Object.entries(ELECTRICAL_TYPE_TITLES).map(([value, title]) => ({ value, title }))
const kindLabels = computed(() => Object.fromEntries((result.value?.kinds || []).map((k) => [k.kind, k.label])))
const checkedText = computed(() => Object.entries(result.value?.checked || {}).map(([t, n]) => `${typeTitle(t)} ${n}`).join(', '))
const planScope = computed(() => planItems.value ? `Объект ${typeTitle(planItems.value[0]!.object_type)} ${planItems.value[0]!.id}` : 'Все объекты')

function typeTitle(t: string) { return ELECTRICAL_TYPE_TITLES[t] || t }
function kindLabel(k: string) { return kindLabels.value[k] || k }
function fieldTitle(f: string) { return ELECTRICAL_FIELD_TITLES[f] || f }
function cell(v: unknown) { return v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('ru-RU', { maximumFractionDigits: 3 }) : String(v) }
const currentText = (item: ElectricalReconciliationItem) => electricalCurrentText(item)
const candidateText = (item: ElectricalReconciliationItem) => electricalCandidateText(item)
function hasCoords(item: Located) { return Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)) && item.longitude !== null }
function locate(item: Located) {
  if (!hasCoords(item)) return
  emit('locate', { longitude: Number(item.longitude), latitude: Number(item.latitude), id: item.id, objectType: item.object_type, label: `${typeTitle(item.object_type)}: ${item.name || item.id}` })
}
function fail(cause: unknown, fallback: string) {
  const anyCause = cause as { data?: { detail?: { message?: string } | string }, message?: string }
  const detail = anyCause?.data?.detail
  error.value = (typeof detail === 'object' ? detail?.message : detail) || formatApiError(cause, fallback)
}

async function load() {
  loading.value = true
  try {
    result.value = await fastApiService.getElectricalReconciliation({
      tolerance: tolerance.value || 8, kind: kind.value || undefined, object_type: objectType.value || undefined, limit: 1000
    })
  } catch (cause) { fail(cause, 'Не удалось выполнить сверку') } finally { loading.value = false }
}
async function selectKind(k: string | null) { kind.value = k; await load() }
async function downloadReport() {
  downloading.value = true
  try {
    const blob = await fastApiService.downloadElectricalReconciliationReport(tolerance.value || 8)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `electrical_reconciliation_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) { fail(cause, 'Не удалось сформировать отчёт') } finally { downloading.value = false }
}
async function preview(items: ElectricalReconciliationItem[] | null) {
  binding.value = true
  planItems.value = items ? items.map((i) => ({ object_type: i.object_type, id: i.id })) : null
  try {
    plan.value = await fastApiService.bindElectricalNetwork({
      tolerance: tolerance.value || 8, overwrite: overwrite.value, snap_points: snapPoints.value, items: planItems.value, dry_run: true
    })
  } catch (cause) { fail(cause, 'Предпросмотр не удался') } finally { binding.value = false }
}
async function apply() {
  if (!plan.value) return
  const records = plan.value.counts.records
  if (!(await confirmAction({ text: `Записать привязку для ${records} ${pluralRu(records, ['объекта', 'объектов', 'объектов'])}?`, action: 'Записать' }))) return
  binding.value = true
  try {
    plan.value = await fastApiService.bindElectricalNetwork({
      tolerance: tolerance.value || 8, overwrite: overwrite.value, snap_points: snapPoints.value, items: planItems.value, dry_run: false
    })
    await load()
  } catch (cause) { fail(cause, 'Привязка не выполнена') } finally { binding.value = false }
}

onMounted(load)
defineExpose({ load })
</script>

<style scoped>
.el-rec-table-wrap { overflow: auto; max-height: 52vh; }
.el-rec-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.el-rec-table th, .el-rec-table td { border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); padding: 4px 8px; text-align: left; vertical-align: top; }
.el-rec-table th { position: sticky; top: 0; background: rgb(var(--v-theme-surface)); z-index: 1; }
</style>
