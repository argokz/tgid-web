<template>
  <v-dialog
    v-model="dialog"
    max-width="1200"
    scrollable
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-3 px-4 py-3">
        <v-avatar
          color="primary"
          variant="tonal"
          size="40"
        >
          <v-icon>mdi-source-branch</v-icon>
        </v-avatar>
        <div
          class="flex-grow-1"
          style="min-width: 0"
        >
          <div class="text-subtitle-1 font-weight-bold">
            Сценарии «что если»
          </div>
          <div class="text-caption text-medium-emphasis text-truncate">
            Копия фрагмента для варианта сети: правьте и считайте её, затем сравните с основой
          </div>
        </div>
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

      <v-card-text class="pa-0 scen-body">
        <!-- Список сценариев и создание нового -->
        <aside class="scen-list pa-3">
          <v-btn
            v-if="canCreate && !createOpen"
            block
            color="primary"
            variant="tonal"
            prepend-icon="mdi-source-fork"
            class="mb-3"
            @click="openCreate"
          >
            Новый сценарий
          </v-btn>
          <v-form
            v-if="createOpen"
            class="scen-create mb-3"
            @submit.prevent="createScenario"
          >
            <AppSelect
              v-model="createBase"
              :items="fragmentItems"
              item-title="title"
              item-value="value"
              label="Основа — фрагмент"
              searchable
              :clearable="false"
              density="compact"
              class="mb-2"
            />
            <v-text-field
              v-model="createName"
              label="Название сценария"
              density="compact"
              variant="outlined"
              maxlength="60"
              counter
              class="mb-1"
            />
            <v-textarea
              v-model="createNote"
              label="Что проверяем (необязательно)"
              density="compact"
              variant="outlined"
              rows="2"
              auto-grow
              maxlength="2000"
            />
            <div class="text-caption text-medium-emphasis mb-2">
              Копия фрагмента видна в десктопе как обычный фрагмент. Крупный фрагмент копируется до минуты.
            </div>
            <div class="d-flex ga-2">
              <v-btn
                type="submit"
                color="primary"
                :loading="creating"
                :disabled="!createBase || !createName.trim()"
              >
                Создать
              </v-btn>
              <v-btn
                variant="text"
                :disabled="creating"
                @click="createOpen = false"
              >
                Отмена
              </v-btn>
            </div>
          </v-form>

          <div class="d-flex align-center mb-1">
            <span class="text-overline">Сценарии</span>
            <v-spacer />
            <v-checkbox-btn
              v-model="showArchived"
              density="compact"
              label="Архив"
              class="flex-grow-0"
            />
          </div>
          <StateView
            variant="list"
            :rows="4"
            :loading="listLoading"
            :error="listError"
            :empty="!listLoading && scenarios.length === 0"
            empty-title="Сценариев пока нет"
            empty-text="Создайте копию фрагмента и правьте её, не трогая основу"
            empty-icon="mdi-source-branch"
            error-title="Не удалось загрузить сценарии"
            @retry="loadScenarios"
          >
            <v-list
              density="compact"
              nav
              class="pa-0"
            >
              <v-list-item
                v-for="s in scenarios"
                :key="s.id"
                :active="s.id === selectedId"
                :subtitle="scenarioSubtitle(s)"
                @click="selectScenario(s.id)"
              >
                <template #title>
                  <span :class="{ 'text-medium-emphasis': s.status === 'archived' || !s.exists }">{{ s.name }}</span>
                </template>
                <template #append>
                  <v-icon
                    v-if="!s.exists"
                    size="16"
                    color="warning"
                    title="Фрагмент-копия удалён"
                  >
                    mdi-alert-outline
                  </v-icon>
                </template>
              </v-list-item>
            </v-list>
          </StateView>
        </aside>

        <!-- Сравнение выбранного сценария с основой -->
        <section class="scen-diff pa-3">
          <div
            v-if="!selected"
            class="scen-placeholder text-medium-emphasis"
          >
            Выберите сценарий слева — здесь появится его сравнение с основой
          </div>
          <template v-else>
            <div class="d-flex flex-wrap align-center ga-2 mb-2">
              <div
                class="flex-grow-1"
                style="min-width: 0"
              >
                <div class="text-subtitle-2 font-weight-bold text-truncate">
                  {{ selected.name }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  Основа: {{ fragmentLabel(selected.base_fileid, selected.base_name) }} ·
                  копия: {{ fragmentLabel(selected.fileid, selected.fragment_name) }}
                </div>
                <div
                  v-if="selected.note"
                  class="text-caption mt-1"
                >
                  {{ selected.note }}
                </div>
              </div>
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-pencil"
                :disabled="!selected.exists"
                @click="workInScenario"
              >
                Работать в сценарии
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-layers-outline"
                @click="showBase"
              >
                Показать основу
              </v-btn>
              <v-btn
                v-if="canCreate"
                size="small"
                variant="tonal"
                prepend-icon="mdi-source-merge"
                :disabled="!selected.exists || scenarioEdits === 0"
                :title="scenarioEdits === 0 ? 'В сценарии нет правок для переноса' : 'Перенести правки сценария в основу'"
                @click="mergeOpen = true"
              >
                Перенести в основу
              </v-btn>
              <HintTip text="Сравнить заново">
                <template #default="{ props: tip }">
                  <v-btn
                    v-bind="tip"
                    size="small"
                    icon="mdi-refresh"
                    variant="text"
                    aria-label="Сравнить заново"
                    :loading="diffLoading"
                    @click="loadDiff"
                  />
                </template>
              </HintTip>
              <HintTip :text="selected.status === 'archived' ? 'Вернуть из архива' : 'В архив (копия фрагмента останется)'">
                <template #default="{ props: tip }">
                  <v-btn
                    v-if="canCreate"
                    v-bind="tip"
                    size="small"
                    :icon="selected.status === 'archived' ? 'mdi-archive-arrow-up-outline' : 'mdi-archive-arrow-down-outline'"
                    variant="text"
                    :aria-label="selected.status === 'archived' ? 'Вернуть из архива' : 'В архив'"
                    @click="toggleArchive"
                  />
                </template>
              </HintTip>
            </div>

            <v-tabs
              v-model="tab"
              density="compact"
              class="mb-2"
            >
              <v-tab value="net">
                Отличия сети
              </v-tab>
              <v-tab value="regime">
                Режим по расчётам
              </v-tab>
            </v-tabs>

            <StateView
              v-if="tab === 'net'"
              variant="table"
              :rows="8"
              :loading="diffLoading"
              :error="diffError"
              :empty="!!diff && diff.total === 0"
              empty-title="Сценарий совпадает с основой"
              empty-text="Правьте копию в редакторе сети («Работать в сценарии») — отличия появятся здесь"
              empty-icon="mdi-check-circle-outline"
              error-title="Не удалось сравнить сценарий с основой"
              :retrying="diffLoading"
              @retry="loadDiff"
            >
              <template v-if="diff">
                <div class="scen-tiles mb-2">
                  <KpiTile
                    v-for="row in kindRows"
                    :key="row.kind"
                    :label="row.label"
                    :value="row.count"
                    :title="diff.kinds[row.kind]"
                    :compact="false"
                    selectable
                    :active="kindFilter === row.kind"
                    @select="kindFilter = kindFilter === row.kind ? null : row.kind"
                  />
                </div>
                <v-alert
                  v-if="(diff.by_kind.conflict ?? 0) > 0"
                  type="warning"
                  variant="tonal"
                  density="compact"
                  class="mb-2"
                >
                  Конфликты: объект правили и в сценарии, и в основе после создания сценария.
                  При переносе правок в основу их придётся решать вручную.
                </v-alert>
                <div
                  v-if="diff.truncated"
                  class="text-caption text-medium-emphasis mb-1"
                >
                  В списке — первые {{ diff.items.length }} из {{ diff.total }}; числа на плитках — полные
                </div>
                <DataTable
                  :columns="columns"
                  :items="tableRows"
                  item-key="key"
                  selectable
                  :height="380"
                  no-data-text="Нет отличий по фильтру"
                  @select="(row) => locateItem(row as unknown as DiffRow)"
                >
                  <template #[`item.kind`]="{ item }">
                    <span class="scen-kind">
                      <v-icon
                        :color="SCENARIO_KIND_META[item.kind as ScenarioChangeKind].color"
                        size="16"
                      >{{ SCENARIO_KIND_META[item.kind as ScenarioChangeKind].icon }}</v-icon>
                      {{ SCENARIO_KIND_META[item.kind as ScenarioChangeKind].label }}
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

            <!-- Режим: расчёт сценария против расчёта основы -->
            <template v-else>
              <div class="scen-calcs mb-2">
                <AppSelect
                  v-model="baseCalcId"
                  :items="baseCalcItems"
                  item-title="title"
                  item-value="value"
                  label="Расчёт основы"
                  density="compact"
                  :clearable="false"
                />
                <AppSelect
                  v-model="scenarioCalcId"
                  :items="scenarioCalcItems"
                  item-title="title"
                  item-value="value"
                  label="Расчёт сценария"
                  density="compact"
                  :clearable="false"
                />
              </div>
              <v-alert
                v-if="!calcsLoading && !regimeError && missingCalcText"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-2"
              >
                {{ missingCalcText }}
              </v-alert>
              <StateView
                v-else
                variant="table"
                :rows="8"
                :loading="calcsLoading || regimeLoading"
                :error="regimeError"
                :empty="!!regime && regime.total === 0"
                empty-title="Режим сценария не отличается от основы"
                :empty-text="regimeThresholdsText"
                empty-icon="mdi-check-circle-outline"
                error-title="Не удалось сравнить расчёты"
                :retrying="regimeLoading"
                @retry="loadRegime"
              >
                <template v-if="regime">
                  <v-alert
                    v-for="w in regime.warnings"
                    :key="w"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mb-2"
                  >
                    {{ w }} — сравнение может быть некорректным
                  </v-alert>
                  <div class="scen-tiles mb-2">
                    <KpiTile
                      label="Недотоп, потребителей"
                      :value="regime.consumers.underheated_scenario"
                      :delta="regime.consumers.underheated_scenario - regime.consumers.underheated_base"
                      delta-label="к основе"
                      :up-is-good="false"
                      :compact="false"
                    />
                    <KpiTile
                      label="Стали недотоп"
                      :value="regime.consumers.became_underheated"
                      :status="regime.consumers.became_underheated > 0 ? 'serious' : undefined"
                      :compact="false"
                    />
                    <KpiTile
                      label="Отключены (без расчёта)"
                      :value="regime.consumers.lost"
                      :status="regime.consumers.lost > 0 ? 'serious' : undefined"
                      :compact="false"
                    />
                    <KpiTile
                      label="Перегруженные участки"
                      :value="regime.lines.overloaded_scenario"
                      :delta="regime.lines.overloaded_scenario - regime.lines.overloaded_base"
                      delta-label="к основе"
                      :up-is-good="false"
                      :compact="false"
                    />
                    <KpiTile
                      label="Расход потребителей"
                      units="т/ч"
                      :value="regime.consumers.flow_scenario"
                      :delta="Math.round(regime.consumers.flow_scenario - regime.consumers.flow_base)"
                      delta-label="к основе"
                    />
                  </div>
                  <div
                    v-if="regime.truncated"
                    class="text-caption text-medium-emphasis mb-1"
                  >
                    В списке — первые {{ regime.items.length }} из {{ regime.total }} изменений
                  </div>
                  <DataTable
                    :columns="regimeColumns"
                    :items="regimeRows"
                    item-key="key"
                    selectable
                    :height="340"
                    no-data-text="Нет изменений"
                    @select="(row) => locateItem(row as unknown as RegimeRow)"
                  >
                    <template #[`item.kind`]="{ item }">
                      <span class="scen-kind">
                        <v-icon
                          :color="SCENARIO_REGIME_META[item.kind as ScenarioRegimeKind].color"
                          size="16"
                        >{{ SCENARIO_REGIME_META[item.kind as ScenarioRegimeKind].icon }}</v-icon>
                        {{ SCENARIO_REGIME_META[item.kind as ScenarioRegimeKind].label }}
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
            </template>
          </template>
        </section>
      </v-card-text>
    </v-card>
    <ScenarioMergeDialog
      v-if="mergeOpen && selected"
      v-model="mergeOpen"
      :scenario="selected"
      @merged="onMerged"
    />
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import HintTip from '~/components/HintTip.vue'
import KpiTile from '~/components/KpiTile.vue'
import ScenarioMergeDialog from '~/components/ScenarioMergeDialog.vue'
import StateView from '~/components/StateView.vue'
import {
  fastApiService,
  type CalculationListItem,
  type Scenario,
  type ScenarioChangeKind,
  type ScenarioDiff,
  type ScenarioDiffItem,
  type ScenarioMergeReport,
  type ScenarioRegimeCompare,
  type ScenarioRegimeItem,
  type ScenarioRegimeKind,
} from '~/services/fastApiService'
import { useAuthStore } from '~/stores/authStore'
import { useFragmentStore } from '~/stores/fragmentStore'
import { useLayerStore } from '~/stores/layerStore'
import { useNotificationStore } from '~/stores/notificationStore'
import { formatApiErrorWith } from '~/utils/apiError'
import {
  SCENARIO_KIND_META,
  SCENARIO_REGIME_META,
  scenarioFieldsText,
  scenarioKindCounts,
  scenarioObjectTitle,
  scenarioRegimeText,
  scenarioRegimeTitle,
} from '~/utils/scenarios'

/**
 * Сценарии «что если» (api/v1/scenarios): копия фрагмента-основы, которую правят в редакторе сети и
 * считают как любой фрагмент. Сравнение с основой — трёхстороннее: правки сценария, конфликты и
 * изменения основы после создания сценария. Щелчок по строке — объект на карте (`locate`).
 */
type DiffRow = ScenarioDiffItem & { key: string; object: string; change: string; [field: string]: unknown }
type RegimeRow = ScenarioRegimeItem & { key: string; title: string; change: string; [field: string]: unknown }

/** Расчётов фрагмента в выпадающем списке */
const CALCS_SHOWN = 30

const emit = defineEmits<{
  locate: [point: { lat: number; lng: number }]
}>()

const dialog = ref(false)
const scenarios = ref<Scenario[]>([])
const listLoading = ref(false)
const listError = ref('')
const showArchived = ref(false)
const selectedId = ref<number | null>(null)
const diff = ref<ScenarioDiff | null>(null)
const diffLoading = ref(false)
const diffError = ref('')
const kindFilter = ref<ScenarioChangeKind | null>(null)
const createOpen = ref(false)
const createBase = ref<number | null>(null)
const createName = ref('')
const createNote = ref('')
const creating = ref(false)
const notificationStore = useNotificationStore()
const fragmentStore = useFragmentStore()
const authStore = useAuthStore()
const mergeOpen = ref(false)
const tab = ref<'net' | 'regime'>('net')
const baseCalcs = ref<CalculationListItem[]>([])
const scenarioCalcs = ref<CalculationListItem[]>([])
const calcsLoaded = ref(false)
const calcsLoading = ref(false)
const baseCalcId = ref<number | null>(null)
const scenarioCalcId = ref<number | null>(null)
const regime = ref<ScenarioRegimeCompare | null>(null)
const regimeLoading = ref(false)
const regimeError = ref('')
let diffSeq = 0
let regimeSeq = 0

const canCreate = computed(() => authStore.canEditNetworkStruct)
const scenarioFileids = computed(() => new Set(scenarios.value.map((s) => s.fileid)))
// основой служит обычный фрагмент, не копия-сценарий
const fragmentItems = computed(() =>
  fragmentStore.fragments
    .filter((f: { id: number }) => !scenarioFileids.value.has(f.id))
    .map((f: { id: number; name?: string }) => ({ value: f.id, title: fragmentLabel(f.id, f.name) })),
)
const selected = computed(() => scenarios.value.find((s) => s.id === selectedId.value) ?? null)
const kindRows = computed(() => scenarioKindCounts(diff.value?.by_kind))
/** Правок сценария (переносимых в основу), включая конфликты */
const scenarioEdits = computed(() => {
  const k = diff.value?.by_kind ?? {}
  return (k.changed ?? 0) + (k.added ?? 0) + (k.removed ?? 0) + (k.conflict ?? 0)
})
const tableRows = computed<DiffRow[]>(() =>
  (diff.value?.items ?? [])
    .filter((item) => !kindFilter.value || item.kind === kindFilter.value)
    .map((item) => ({
      ...item,
      key: `${item.table}-${item.kind}-${item.copy_id ?? ''}-${item.base_id ?? ''}`,
      object: scenarioObjectTitle(item),
      change: scenarioFieldsText(item.fields),
    })),
)

const calcTitle = (c: CalculationListItem): string => {
  const date = c.calculated_at ? new Date(c.calculated_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : ''
  const mode = c.mode === 'emergency' ? 'аварийный' : c.mode === 'plan' ? 'плановый' : ''
  return [`№${c.id}`, date, c.tn != null ? `Tн ${c.tn}` : '', mode, c.name ?? ''].filter(Boolean).join(' · ')
}
const baseCalcItems = computed(() => baseCalcs.value.map((c) => ({ value: c.id, title: calcTitle(c) })))
const scenarioCalcItems = computed(() => scenarioCalcs.value.map((c) => ({ value: c.id, title: calcTitle(c) })))
/** Чего не хватает для сравнения режимов; пусто — оба расчёта есть */
const missingCalcText = computed(() => {
  const s = selected.value
  if (!s || !calcsLoaded.value) return ''
  if (!scenarioCalcs.value.length) {
    return `Сценарий ещё не рассчитан: посчитайте фрагмент «${s.fragment_name ?? s.name}» (#${s.fileid}) в окне «Расчёт» `
      + 'с теми же параметрами, что и основу, — здесь появится сравнение режимов.'
  }
  if (!baseCalcs.value.length) return `Основа (фрагмент #${s.base_fileid}) не рассчитана — посчитайте её с теми же параметрами.`
  return ''
})
const regimeThresholdsText = computed(() => {
  const t = regime.value?.thresholds
  return t ? `Пороги: напор ±${t.head_delta_m} м, обеспеченность ${t.underheat_pct} %, удельные потери ${t.spec_loss_pa_m} Па/м` : ''
})
const regimeRows = computed<RegimeRow[]>(() =>
  (regime.value?.items ?? []).map((item) => ({
    ...item,
    key: `${item.object}-${item.base_id ?? ''}-${item.copy_id ?? ''}`,
    title: scenarioRegimeTitle(item),
    change: scenarioRegimeText(item),
  })),
)
const regimeColumns: DataTableColumn[] = [
  { key: 'kind', title: 'Изменение', width: 200 },
  { key: 'title', title: 'Объект', width: 260 },
  { key: 'change', title: 'Основа → сценарий' },
  { key: 'locate', title: '', width: 36, sortable: false },
]

const columns: DataTableColumn[] = [
  { key: 'kind', title: 'Отличие', width: 190 },
  { key: 'object', title: 'Объект', width: 280 },
  { key: 'change', title: 'Было → стало' },
  { key: 'locate', title: '', width: 36, sortable: false },
]

function fragmentLabel(id: number, name?: string | null): string {
  return name ? `${name} (#${id})` : `фрагмент #${id}`
}

const scenarioSubtitle = (s: Scenario): string => {
  const date = new Date(s.created_at).toLocaleDateString('ru-RU')
  const parts = [`от «${s.base_name ?? `#${s.base_fileid}`}»`, date]
  if (s.created_by) parts.push(s.created_by)
  if (s.status === 'archived') parts.push('в архиве')
  if (!s.exists) parts.push('копия удалена')
  return parts.join(' · ')
}

const loadScenarios = async () => {
  listLoading.value = true
  listError.value = ''
  try {
    scenarios.value = await fastApiService.getScenarios(showArchived.value)
  } catch (err: unknown) {
    listError.value = formatApiErrorWith('Не удалось загрузить сценарии', err)
  } finally {
    listLoading.value = false
  }
}

const loadDiff = async () => {
  const id = selectedId.value
  const seq = ++diffSeq
  diff.value = null
  diffError.value = ''
  kindFilter.value = null
  if (id === null) return
  diffLoading.value = true
  try {
    const res = await fastApiService.getScenarioDiff(id)
    if (seq === diffSeq) diff.value = res
  } catch (err: unknown) {
    if (seq === diffSeq) diffError.value = formatApiErrorWith('Не удалось сравнить сценарий с основой', err)
  } finally {
    if (seq === diffSeq) diffLoading.value = false
  }
}

const resetRegime = () => {
  baseCalcs.value = []
  scenarioCalcs.value = []
  calcsLoaded.value = false
  baseCalcId.value = null
  scenarioCalcId.value = null
  regime.value = null
  regimeError.value = ''
}

/** Расчёты основы и сценария; по умолчанию — последние (сравнение запускает watch) */
const loadCalcs = async () => {
  const s = selected.value
  resetRegime()
  if (!s) return
  calcsLoading.value = true
  try {
    const [baseList, scenarioList] = await Promise.all([
      fastApiService.listCalculations({ file_id: s.base_fileid, limit: CALCS_SHOWN }),
      fastApiService.listCalculations({ file_id: s.fileid, limit: CALCS_SHOWN }),
    ])
    if (selected.value?.id !== s.id) return
    baseCalcs.value = baseList.items.filter((c) => c.has_results)
    scenarioCalcs.value = scenarioList.items.filter((c) => c.has_results)
    calcsLoaded.value = true
    // сценарий — последний расчёт; основа — последний с теми же Tн и режимом (иначе сравнение некорректно)
    const scen = scenarioCalcs.value[0] ?? null
    const twin = scen && baseCalcs.value.find((c) => c.tn === scen.tn && c.mode === scen.mode)
    baseCalcId.value = (twin || baseCalcs.value[0])?.id ?? null
    scenarioCalcId.value = scen?.id ?? null
  } catch (err: unknown) {
    regimeError.value = formatApiErrorWith('Не удалось загрузить расчёты', err)
  } finally {
    calcsLoading.value = false
  }
}

const loadRegime = async () => {
  const s = selected.value
  const seq = ++regimeSeq
  regime.value = null
  regimeError.value = ''
  if (!s || baseCalcId.value === null || scenarioCalcId.value === null) return
  regimeLoading.value = true
  try {
    const res = await fastApiService.compareScenarioCalculations(s.id, baseCalcId.value, scenarioCalcId.value)
    if (seq === regimeSeq) regime.value = res
  } catch (err: unknown) {
    if (seq === regimeSeq) regimeError.value = formatApiErrorWith('Не удалось сравнить расчёты', err)
  } finally {
    if (seq === regimeSeq) regimeLoading.value = false
  }
}

// выбор расчётов (и выбор по умолчанию после загрузки) — сравнить заново
watch([baseCalcId, scenarioCalcId], () => {
  if (tab.value === 'regime') void loadRegime()
})
watch(tab, (value) => {
  if (value === 'regime' && !calcsLoaded.value && !calcsLoading.value) void loadCalcs()
})

const selectScenario = (id: number) => {
  if (selectedId.value === id) return
  selectedId.value = id
  void loadDiff()
  if (tab.value === 'regime') void loadCalcs()
  else resetRegime()
}

watch(showArchived, () => void loadScenarios())

const openCreate = () => {
  createBase.value = fragmentStore.selectedFragmentId
    ?? (fragmentStore.visibleFragments.length === 1 ? fragmentStore.visibleFragments[0] : null)
  createName.value = ''
  createNote.value = ''
  createOpen.value = true
}

const createScenario = async () => {
  const base = createBase.value
  const name = createName.value.trim()
  if (!base || !name || creating.value) return
  creating.value = true
  try {
    const res = await fastApiService.createScenario({ base_fileid: base, name, note: createNote.value.trim() || undefined })
    notificationStore.showSuccess(`Сценарий «${res.name}» создан: фрагмент #${res.fileid}, узлов ${res.created_nodes}, участков ${res.created_lines}`)
    createOpen.value = false
    await Promise.all([loadScenarios(), fragmentStore.loadFragments()])
    selectedId.value = res.scenario_id
    void loadDiff()
  } catch (err: unknown) {
    notificationStore.showError(formatApiErrorWith('Не удалось создать сценарий', err))
  } finally {
    creating.value = false
  }
}

/** Показать на карте только копию: редактор создаёт объекты в единственном видимом фрагменте */
const workInScenario = () => {
  const s = selected.value
  if (!s) return
  fragmentStore.applyVisibleFragmentsSelection([s.fileid])
  notificationStore.showInfo(`На карте — сценарий «${s.name}». Правки в редакторе сети идут в его копию.`)
  dialog.value = false
}

const showBase = () => {
  const s = selected.value
  if (!s) return
  fragmentStore.applyVisibleFragmentsSelection([s.base_fileid])
}

const toggleArchive = async () => {
  const s = selected.value
  if (!s) return
  const status = s.status === 'archived' ? 'active' : 'archived'
  try {
    await fastApiService.setScenarioStatus(s.id, status)
    await loadScenarios()
    if (!scenarios.value.some((x) => x.id === s.id)) {
      selectedId.value = null
      diff.value = null
    }
  } catch (err: unknown) {
    notificationStore.showError(formatApiErrorWith('Не удалось изменить сценарий', err))
  }
}

/** После переноса и после его отмены: сравнить заново и обновить слои сети */
const refreshAfterMerge = () => {
  void loadDiff()
  useLayerStore().refreshVisibleDataLayers()
}

/** Перенос выполнен: уведомление с «Отменить» (отмена именно этой операции журнала) */
const onMerged = (res: ScenarioMergeReport) => {
  const name = selected.value?.name ?? ''
  const text = `Сценарий «${name}» перенесён в основу: изменено ${res.updated}, добавлено ${res.inserted}, снято ${res.removed}`
  refreshAfterMerge()
  const operationId = res.operation_id
  if (!operationId) {
    notificationStore.showSuccess(text)
    return
  }
  notificationStore.showUndo(text, async () => {
    try {
      await fastApiService.undoTopologyOperation(operationId)
      notificationStore.showSuccess('Перенос сценария отменён')
    } catch (err: unknown) {
      notificationStore.showError(formatApiErrorWith('Отменить перенос нельзя', err))
    } finally {
      refreshAfterMerge()
    }
  })
}

const locateItem = (row: { lat: number | null; lng: number | null }) => {
  if (row.lat != null && row.lng != null) {
    emit('locate', { lat: row.lat, lng: row.lng })
  } else {
    notificationStore.showWarning('Координаты объекта неизвестны')
  }
}

const openDialog = () => {
  dialog.value = true
  void loadScenarios()
  if (!fragmentStore.fragments.length) void fragmentStore.loadFragments()
  if (selectedId.value !== null) void loadDiff()
}

defineExpose({
  openDialog,
})
</script>

<style scoped>
.scen-body { display: grid; grid-template-columns: 320px 1fr; min-height: 520px; }
.scen-list { border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08); overflow-y: auto; max-height: 72vh; }
.scen-diff { min-width: 0; }
.scen-create { padding: var(--space-2); border-radius: var(--radius-2, 8px); background: rgba(var(--v-theme-on-surface), 0.03); }
.scen-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; min-height: 300px; text-align: center; }
.scen-tiles { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.scen-kind { display: inline-flex; align-items: center; gap: var(--space-1); }
.scen-calcs { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
@media (max-width: 599.98px) { .scen-calcs { grid-template-columns: 1fr; } }
@media (max-width: 959.98px) {
  .scen-body { grid-template-columns: 1fr; }
  .scen-list { border-right: none; border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08); max-height: none; }
}
</style>
