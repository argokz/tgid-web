<template>
  <Teleport to="body">
    <v-dialog
      v-model="visible"
      :fullscreen="isMobile"
      max-width="1600"
      scrollable
    >
      <v-card
        class="electrical-journal"
        :rounded="isMobile ? 0 : 'lg'"
      >
        <v-card-title class="d-flex align-center flex-wrap ga-3 px-4 py-3">
          <v-avatar
            color="amber-lighten-5"
            size="40"
          >
            <v-icon color="amber-darken-4">mdi-transmission-tower</v-icon>
          </v-avatar>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold">Электрическая сеть</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ scopeTitle }} · найдено {{ total.toLocaleString('ru-RU') }} объектов
            </div>
          </div>
          <SegmentedToggle
            v-model="tab"
            :items="tabItems"
            aria-label="Раздел журнала электросети"
            class="mr-2"
          />
          <HintTip
            text="Закрыть журнал"
            hotkey="Esc"
            location="bottom"
          >
            <template #default="{ props: tip }">
              <v-btn
                v-bind="tip"
                icon
                variant="text"
                aria-label="Закрыть журнал"
                @click="visible = false"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </HintTip>
        </v-card-title>

        <v-divider />

        <v-card-text
          v-if="tab === 'reconciliation'"
          class="pa-0"
        >
          <ElectricalReconciliationPanel
            @locate="locateReconciliation"
            @open-object="openReconciliationObject"
          />
        </v-card-text>
        <template v-else>
          <!-- Плитки — число объектов вида на всю базу; плитка — фильтр по виду -->
          <div class="electrical-kpi px-3 px-md-4 pt-3">
            <KpiTile
              v-for="type in objectTypes"
              :key="type.value"
              :label="type.title"
              :value="lookupCount(type.value)"
              :compact="false"
              selectable
              :active="objectType === type.value"
              @select="toggleObjectType(type.value)"
            />
          </div>

          <div class="pa-3 pa-md-4 electrical-filters">
            <v-row dense>
              <v-col
                cols="12"
                md="4"
              >
                <SearchField
                  :model-value="search"
                  label="Наименование, тип, владелец"
                  :debounce="350"
                  :loading="loading"
                  @update:model-value="search = $event"
                  @search="onSearch"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="objectType"
                  :items="objectTypes"
                  item-title="title"
                  item-value="value"
                  label="Вид объекта"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="ownerId"
                  :items="lookups.owners"
                  item-title="name"
                  item-value="id"
                  label="Владелец"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <AppSelect
                  v-model="voltageKv"
                  :items="lookups.voltages"
                  item-title="value"
                  item-value="value"
                  label="Напряжение, кВ"
                />
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="2"
              >
                <v-text-field
                  v-model.number="parentLineId"
                  type="number"
                  label="ID ЛЭП"
                  density="compact"
                  variant="outlined"
                  clearable
                  hide-details
                />
              </v-col>
            </v-row>

            <div class="d-flex align-center flex-wrap ga-2 mt-3">
              <v-spacer />
              <v-btn
                variant="text"
                prepend-icon="mdi-filter-remove-outline"
                :disabled="!filtersActive"
                @click="resetFilters"
              >
                Сбросить
              </v-btn>
              <v-btn
                color="primary"
                prepend-icon="mdi-refresh"
                :loading="loading"
                @click="loadPage"
              >
                Обновить
              </v-btn>
            </div>
          </div>

          <v-divider />

          <v-card-text class="pa-0 electrical-table-wrap">
            <StateView
              variant="table"
              :rows="10"
              :loading="loading && !items.length"
              :error="error"
              :empty="!loading && !items.length"
              empty-title="Объекты электросети не найдены"
              :empty-text="filtersActive ? 'Измените фильтры: по выбранным условиям объектов нет' : 'В текущей БД таблицы источников, ЛЭП, приёмников и оборудования пусты'"
              empty-icon="mdi-transmission-tower-off"
              :action-label="filtersActive ? 'Сбросить фильтры' : undefined"
              error-title="Не удалось загрузить электросеть"
              :retrying="loading"
              @retry="loadPage"
              @action="resetFilters"
            >
              <v-progress-linear
                v-if="loading"
                indeterminate
                color="primary"
              />
              <DataTable
                :columns="tableColumns"
                :items="rows"
                item-key="row_key"
                selectable
                :selected-key="flashKey"
                density="compact"
                class="electrical-table"
                @select="openDetails($event.object_type as ElectricalObjectType, Number($event.id))"
              >
                <template #[`item.object_type`]="{ item }">
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="typeMeta(item.object_type as ElectricalObjectType).color"
                  >
                    {{ typeMeta(item.object_type as ElectricalObjectType).title }}
                  </v-chip>
                </template>
                <template #[`item.name`]="{ item }">
                  <div class="text-truncate">
                    {{ item.name || '—' }}
                  </div>
                </template>
                <template #[`item.type_name`]="{ item }">
                  {{ item.type_name || '—' }}
                </template>
                <template #[`item.owner_name`]="{ item }">
                  <div class="text-truncate">
                    {{ item.owner_name || '—' }}
                  </div>
                </template>
                <template #[`item.parent_line_id`]="{ item }">
                  <span class="num">{{ item.parent_line_id || '—' }}</span>
                </template>
                <template #[`item.voltage_kv`]="{ item }">
                  {{ numeric(item.voltage_kv, ' кВ') }}
                </template>
                <template #[`item.capacity_kw`]="{ item }">
                  {{ numeric(item.capacity_kw, ' кВт') }}
                </template>
                <template #[`item.length_m`]="{ item }">
                  {{ numeric(item.length_m, ' м') }}
                </template>
                <template #[`item.installed_on`]="{ item }">
                  {{ formatDate(item.installed_on) }}
                </template>
                <template #[`item.actions`]="{ item }">
                  <HintTip
                    v-if="hasCoordinates(item)"
                    text="Показать объект на карте"
                    hint="Журнал закроется, маркер останется"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-crosshairs-gps"
                        size="x-small"
                        variant="text"
                        color="primary"
                        aria-label="Показать объект на карте"
                        @click.stop="locate(item)"
                      />
                    </template>
                  </HintTip>
                  <HintTip
                    v-else
                    text="Карта недоступна"
                    hint="У объекта нет координат"
                  >
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-map-marker-off"
                        size="x-small"
                        variant="text"
                        aria-disabled="true"
                        aria-label="Нет координат у объекта"
                        @click.stop
                      />
                    </template>
                  </HintTip>
                  <HintTip text="Открыть паспорт">
                    <template #default="{ props: tip }">
                      <v-btn
                        v-bind="tip"
                        icon="mdi-chevron-right"
                        size="x-small"
                        variant="text"
                        aria-label="Открыть паспорт объекта"
                        @click.stop="openDetails(item.object_type as ElectricalObjectType, Number(item.id))"
                      />
                    </template>
                  </HintTip>
                </template>
              </DataTable>
            </StateView>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-2">
            <span class="text-caption text-medium-emphasis">Страница {{ page }}{{ pages ? ` из ${pages}` : '' }}</span>
            <v-spacer />
            <v-pagination
              v-if="pages > 1"
              v-model="page"
              :length="pages"
              :total-visible="isMobile ? 3 : 7"
              density="compact"
            />
          </v-card-actions>
        </template>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="detailsVisible"
      :persistent="saving"
      :fullscreen="isMobile"
      max-width="1050"
      scrollable
    >
      <v-card :rounded="isMobile ? 0 : 'lg'">
        <v-card-title class="d-flex align-center ga-3 px-4 py-3">
          <v-icon :color="selected ? typeMeta(selected.object_type).color : 'amber-darken-4'">
            {{ selected ? typeMeta(selected.object_type).icon : 'mdi-transmission-tower' }}
          </v-icon>
          <div
            class="flex-grow-1"
            style="min-width: 0"
          >
            <div class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <span class="text-truncate">{{ selected ? `${typeMeta(selected.object_type).title}: ${selected.name || selected.id}` : 'Паспорт объекта электросети' }}</span>
              <v-chip
                v-if="isEditing && isDirty"
                size="x-small"
                color="accent"
                variant="tonal"
              >
                Не сохранено
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ selected ? `ID ${selected.id} · ${selected.owner_name || 'владелец не указан'}` : '' }}
            </div>
          </div>
          <v-btn
            icon
            variant="text"
            aria-label="Закрыть паспорт"
            @click="detailsVisible = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />

        <v-card-text class="pa-4">
          <StateView
            variant="form"
            :rows="8"
            :loading="detailsLoading"
            :error="detailsError"
            :empty="!detailsLoading && !detailsError && !selected"
            empty-title="Объект не выбран"
            :retry="false"
          >
            <template v-if="selected">
              <JournalDetailFields
                :groups="detailGroups"
                :model="editFields"
                :editable="editable"
                :is-field-dirty="isFieldDirty"
                :open-panels="[0, 1]"
                @update:field="setEditField"
              />
              <v-alert
                v-if="isEditing && saveError"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-3"
                data-testid="equipment-save-error"
              >
                {{ saveError }}
              </v-alert>
              <section
                v-for="relation in relationGroups"
                :key="relation.key"
                class="mt-4"
              >
                <div class="text-subtitle-2 font-weight-bold mb-2">
                  {{ relation.title }} <span class="text-medium-emphasis num">({{ relation.rows.length }})</span>
                </div>
                <div class="relation-list">
                  <button
                    v-for="(row, index) in relation.rows"
                    :key="String(row.id || index)"
                    type="button"
                    class="relation-row"
                    @click="openRelation(row)"
                  >
                    <strong class="num">{{ row.id ? `ID ${row.id}` : '—' }}</strong><span>{{ relationText(row) }}</span>
                  </button>
                </div>
              </section>
            </template>
          </StateView>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <template v-if="isEditing">
            <v-btn
              variant="text"
              :disabled="saving"
              @click="cancelEdit"
            >
              Отмена
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :loading="saving"
              :disabled="!isDirty"
              @click="saveChanges"
            >
              Сохранить
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              v-if="selected && hasCoordinates(selected)"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-crosshairs-gps"
              @click="locate(selected)"
            >
              На карте
            </v-btn>
            <v-btn
              v-if="mutationsEnabled && selected && editableKeys.length"
              color="primary"
              variant="tonal"
              @click="startEdit"
            >
              Редактировать
            </v-btn>
            <v-btn
              variant="text"
              @click="detailsVisible = false"
            >
              Закрыть
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import AppSelect from '~/components/AppSelect.vue'
import DataTable, { type DataTableColumn } from '~/components/DataTable.vue'
import ElectricalReconciliationPanel from '~/components/ElectricalReconciliationPanel.vue'
import HintTip from '~/components/HintTip.vue'
import JournalDetailFields, { type JournalDetailField, type JournalDetailGroup } from '~/components/JournalDetailFields.vue'
import KpiTile from '~/components/KpiTile.vue'
import SearchField from '~/components/SearchField.vue'
import SegmentedToggle, { type SegmentedToggleItem } from '~/components/SegmentedToggle.vue'
import StateView from '~/components/StateView.vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useEquipmentSaveError } from '~/composables/useEquipmentSaveError'
import { useJournalEdit, type JournalEditSource } from '~/composables/useJournalEdit'
import { useMobile } from '~/composables/useMobile'
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'
import { useNotificationStore } from '~/stores/notificationStore'
import { apiErrorStatus, formatApiError } from '~/utils/apiError'
import { hasLonLat } from '~/utils/journalFields'
import {
  fastApiService,
  type ElectricalNetworkLookups,
  type ElectricalObjectDetails,
  type ElectricalObjectSummary,
  type ElectricalObjectType
} from '~/services/fastApiService'

/**
 * Электрическая сеть — журнал (docs/ui-modernization-progress.md, этап 5): источники, ЛЭП, приёмники и
 * оборудование ЛЭП одним списком (`DataTable`, серверная пагинация), плитки видов (плитка — фильтр),
 * `SearchField` / `AppSelect`, `StateView`; раздел «Сверка и привязка» — `ElectricalReconciliationPanel`.
 * Паспорт — `JournalDetailFields`; правка паспортных полей таблицы вида через `updateObjectAttributes`
 * (только изменённые поля) на общем `useJournalEdit` (черновик, «изменено», отмена с подтверждением).
 */
export interface ElectricalNetworkJournalScope { objectType?: ElectricalObjectType; objectId?: number; parentLineId?: number }
type ElectricalTab = 'journal' | 'reconciliation'
type LocatePayload = { longitude: number; latitude: number; id: number; objectType: ElectricalObjectType; label: string }

const emit = defineEmits<{ 'locate-electrical-object': [payload: LocatePayload] }>()
const { isMobile } = useMobile()
const mutationsEnabled = useMutationsEnabled()
const notifications = useNotificationStore()
const { saveError, clearSaveError, reportSaveError } = useEquipmentSaveError()

const visible = ref(false)
const tab = ref<ElectricalTab>('journal')
const tabItems: SegmentedToggleItem<ElectricalTab>[] = [
  { value: 'journal', label: 'Журнал', icon: 'mdi-format-list-bulleted' },
  { value: 'reconciliation', label: 'Сверка и привязка', icon: 'mdi-link-variant' }
]
const loading = ref(false)
const error = ref('')
const page = ref(1)
const pages = ref(0)
const total = ref(0)
const pageSize = 50
const items = ref<ElectricalObjectSummary[]>([])
const search = ref('')
const objectType = ref<ElectricalObjectType | undefined>()
const ownerId = ref<number | undefined>()
const voltageKv = ref<number | undefined>()
const parentLineId = ref<number | '' | null | undefined>()
const lookups = reactive<ElectricalNetworkLookups>({ owners: [], source_types: [], receiver_types: [], line_types: [], cable_marks: [], voltages: [], counts: {} })
const lookupsLoaded = ref(false)

const detailsVisible = ref(false)
const detailsLoading = ref(false)
const detailsError = ref('')
const selected = ref<ElectricalObjectDetails | null>(null)

const objectTypes = [
  { title: 'Источники', value: 'source' as const, color: 'red-darken-2', icon: 'mdi-power-plug-battery' },
  { title: 'ЛЭП', value: 'line' as const, color: 'amber-darken-4', icon: 'mdi-transmission-tower' },
  { title: 'Приёмники', value: 'receiver' as const, color: 'blue-darken-2', icon: 'mdi-power-socket-eu' },
  { title: 'Каналы', value: 'channel' as const, color: 'brown', icon: 'mdi-pipe' },
  { title: 'Муфты', value: 'coupling' as const, color: 'deep-purple', icon: 'mdi-connection' },
  { title: 'Опоры', value: 'support' as const, color: 'teal', icon: 'mdi-pillar' },
  { title: 'Гильзы', value: 'sleeve' as const, color: 'blue-grey', icon: 'mdi-cylinder' }
]
const countKeys: Record<ElectricalObjectType, string> = { source: 'sources', line: 'lines', receiver: 'receivers', channel: 'channels', coupling: 'couplings', support: 'supports', sleeve: 'sleeves' }
const TABLE_MAP: Record<ElectricalObjectType, string> = { source: 'istochnik_elektrosnabzheniya', line: 'liniya_elektroperedach', receiver: 'priemnik_elektrosnabzheniya', channel: 'kabelnyy_kanal_es', coupling: 'mufta', support: 'opora_es', sleeve: 'gilza_es' }
const labels: Record<string, string> = { naimenovanie_lep: 'ЛЭП', naimenovanie_istochnika_es: 'Наименование источника', naimenovanie_priemnika_es: 'Наименование приёмника', napryazhenie__kv: 'Напряжение, кВ', maksimalno_dopustimaya_nagruzka_vneshnego_vvoda_rp__kvt: 'Максимальная нагрузка, кВт', mestopolozhenie: 'Местоположение', tip_prokladki_lep: 'Тип прокладки', cable_mark_name: 'Марка кабеля', fidera: 'Рабочие фидеры', fidera_rez: 'Резервные фидеры', protyazhennost__linii_m: 'Длина линии, м', protyazhennost__m: 'Длина кабеля, м', data_vvoda_v_ekspluatatsiyu: 'Дата ввода', data_ustanovki: 'Дата установки', primechanie: 'Примечание', trans_pro_kol: 'Производственные трансформаторы', trans_sob_kol: 'Трансформаторы собственных нужд', edv_pod_kol: 'Двигатели подачи', edv_obr_kol: 'Двигатели обратки', edv_dren_kol: 'Дренажные двигатели', edv_opr_kol: 'Опрессовочные двигатели', diz_kol: 'ДГУ', chast_reg_reg: 'Частотно-регулируемый привод', tip_istochnika: 'Тип источника', naimenovanie_istochnika: 'Источник, ID', tip_priemnika: 'Тип приёмника', naimenovanie_priemnika: 'Приёмник, ID', vladelets_lep: 'Владелец ЛЭП', vladeltsy_es_id: 'Владелец', vladelets_istochnika_es: 'Владелец источника', vladelets_priemnika_es: 'Владелец приёмника', marka_kabelya_linii: 'Марка кабеля', typid: 'Тип', source_name: 'Источник', receiver_name: 'Приёмник', nomer_akta_razdela_es: 'Номер акта раздела', data_vydachi_akta_razdela_es: 'Дата выдачи акта раздела', marka_transformatora_rp: 'Марка трансформатора', nomer_opory_es: 'Номер опоры', angle: 'Угол поворота' }
/** Подписи справочников, которые уже показаны в поле-справочнике (владелец, тип, прокладка, марка) */
const DUPLICATE_NAME_OF: Record<string, string[]> = {
  owner_name: ['vladelets_lep', 'vladeltsy_es_id'], installation_type_name: ['tip_prokladki_lep'], cable_mark_name: ['marka_kabelya_linii'],
  source_type_name: ['typid'], receiver_type_name: ['typid']
}
/** Служебные колонки не правятся; `*_name` — подписи справочников из запроса, не колонки таблицы */
const READONLY_KEYS = new Set(['id', 'shape', 'fileid', 'uuid'])

const tableColumns: DataTableColumn[] = [
  { key: 'id', title: 'ID', type: 'number', width: 80, sortable: false },
  { key: 'object_type', title: 'Вид', width: 110, sortable: false },
  { key: 'name', title: 'Наименование', sortable: false },
  { key: 'type_name', title: 'Тип', width: 160, sortable: false },
  { key: 'owner_name', title: 'Владелец', width: 200, sortable: false },
  { key: 'parent_line_id', title: 'ЛЭП', type: 'number', width: 80, sortable: false },
  { key: 'voltage_kv', title: 'Напряжение', type: 'number', width: 110, sortable: false },
  { key: 'capacity_kw', title: 'Мощность', type: 'number', width: 110, sortable: false },
  { key: 'length_m', title: 'Длина', type: 'number', width: 100, sortable: false },
  { key: 'installed_on', title: 'Дата', width: 100, sortable: false },
  { key: 'actions', title: '', type: 'actions', width: 88, sortable: false }
]
/** id разных видов пересекаются — ключ строки по виду и id */
const rowKey = (type: unknown, id: unknown) => `${String(type)}-${String(id)}`
const rows = computed(() => items.value.map(item => ({ ...item, row_key: rowKey(item.object_type, item.id) }) as Record<string, unknown>))

const scopeTitle = computed(() => {
  const type = objectType.value ? typeMeta(objectType.value).title : 'все объекты'
  return parentLineId.value ? `${type} ЛЭП ${parentLineId.value}` : type
})
const filtersActive = computed(() => Boolean(search.value.trim() || objectType.value || ownerId.value || voltageKv.value || parentLineId.value))

function typeMeta(type: ElectricalObjectType) { return objectTypes.find(item => item.value === type) || objectTypes[1] }
const lookupCount = (type: ElectricalObjectType) => Number(lookups.counts?.[countKeys[type]] || 0)
const formatValue = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value))
const numeric = (value: unknown, suffix = '') => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
  ? '—'
  : `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 })}${suffix}`)
const formatDate = (value: unknown) => {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('ru-RU')
}
const hasCoordinates = (item: object) => hasLonLat(item as Record<string, unknown>)
const attributeLabel = (key: string) => labels[key] || key.replaceAll('_', ' ')
const relationTitle = (key: string) => ({ lines: 'Связанные ЛЭП', children: 'Объекты ЛЭП', transformers: 'Трансформаторы', engines: 'Электродвигатели', diesel_generators: 'Дизель-генераторы', lifting_equipment: 'Грузоподъёмное оборудование', documents: 'Документы' } as Record<string, string>)[key] || key
const relationText = (row: Record<string, unknown>) => String(row.name || row.description || row.document_type_name || row.path || row.object_type || 'Связанная запись')

/** Справочник поля по ключу колонки (как в десктопе: владелец, тип источника / приёмника, прокладка, марка кабеля) */
const lookupItemsFor = (key: string, type: ElectricalObjectType): unknown[] | null => {
  if (key === 'vladeltsy_es_id' || key === 'vladelets_lep') return lookups.owners
  if (key === 'typid' && type === 'source') return lookups.source_types
  if (key === 'typid' && type === 'receiver') return lookups.receiver_types
  if (key === 'tip_prokladki_lep') return lookups.line_types
  if (key === 'marka_kabelya_linii') return lookups.cable_marks
  return null
}
const lookupName = (items: unknown[], value: unknown) =>
  (items as Array<{ id: unknown; name?: unknown }>).find(item => String(item.id) === String(value))?.name

/** Записываемые колонки паспорта текущего объекта */
const editableKeys = computed(() => Object.keys(selected.value?.attributes || {})
  .filter(key => !READONLY_KEYS.has(key) && !key.endsWith('_name')))
const editSource: JournalEditSource = {
  schema: computed(() => ({ fields: Object.fromEntries(editableKeys.value.map(key => [key, true])) })),
  isWritable: (key?: string | null) => Boolean(key && editableKeys.value.includes(key)),
  // колонки известны из паспорта — загрузки нет, но useJournalEdit ждёт признак «есть»
  loadSchema: async () => true
}
const {
  isEditing, saving, editFields, flashId, isDirty, isFieldDirty, editable, setEditField,
  beginEdit, resetEdit, cancel, closeKeepingDraft, markSaved
} = useJournalEdit(() => `electrical-${selected.value?.object_type ?? 'line'}`, editSource, selected, {
  toForm: record => Object.fromEntries(editableKeys.value.map(key => [key, record.attributes?.[key] ?? null]))
})
/** Подсветка сохранённой строки: id сохранённого объекта и его вид */
const flashType = ref<ElectricalObjectType | null>(null)
const flashKey = computed(() => (flashId.value != null && flashType.value ? rowKey(flashType.value, flashId.value) : null))

const detailGroups = computed((): JournalDetailGroup[] => {
  const item = selected.value
  if (!item) return []
  const summary: Array<[string, unknown]> = [
    ['ID', item.id], ['Вид', typeMeta(item.object_type).title], ['Наименование', item.name], ['Тип', item.type_name],
    ['Владелец', item.owner_name], ['Родительская ЛЭП', item.parent_line_id], ['Источник', item.source_id],
    ['Приёмник', item.receiver_id], ['Напряжение', numeric(item.voltage_kv, ' кВ')], ['Мощность', numeric(item.capacity_kw, ' кВт')],
    ['Длина', numeric(item.length_m, ' м')], ['Дата', formatDate(item.installed_on)], ['Примечание', item.note]
  ]
  const summaryFields: JournalDetailField[] = summary
    .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== '—')
    .map(([label, value]) => ({ label, value: String(value), rawValue: value, type: 'text' }))
  const passportFields: JournalDetailField[] = Object.entries(item.attributes || {})
    .filter(([key]) => key !== 'id' && !(DUPLICATE_NAME_OF[key] || []).some(source => source in item.attributes))
    .filter(([key, value]) => (isEditing.value && editableKeys.value.includes(key)) || (value !== null && value !== ''))
    .map(([key, value]) => {
      const lookupItems = lookupItemsFor(key, item.object_type)
      const writable = editableKeys.value.includes(key)
      const shown = lookupItems ? (lookupName(lookupItems, value) ?? value) : value
      return {
        label: attributeLabel(key),
        value: formatValue(shown),
        rawValue: value,
        key: writable ? key : undefined,
        type: lookupItems ? 'select' : typeof value === 'number' ? 'number' : 'text',
        items: lookupItems ?? undefined
      }
    })
  return [
    { title: 'Основные данные', fields: summaryFields },
    { title: 'Паспортные поля', fields: passportFields }
  ].filter(group => group.fields.length)
})
const relationGroups = computed(() => (selected.value
  ? Object.entries(selected.value.relations || {}).filter(([, list]) => list.length).map(([key, list]) => ({ key, title: relationTitle(key), rows: list }))
  : []))

const loadLookups = async () => {
  if (lookupsLoaded.value) return
  Object.assign(lookups, await fastApiService.getElectricalNetworkLookups())
  lookupsLoaded.value = true
}

/** Номер последнего запроса списка: ответ более раннего запроса не перекрывает поздний */
let listRequest = 0
const loadPage = async () => {
  const request = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const response = await fastApiService.getElectricalObjects({
      page: page.value, page_size: pageSize, search: search.value.trim() || undefined, object_type: objectType.value,
      owner_id: ownerId.value, voltage_kv: voltageKv.value, parent_line_id: Number(parentLineId.value) || undefined
    })
    if (request !== listRequest) return
    items.value = response.items
    total.value = response.total
    pages.value = response.pages
  } catch (cause) {
    if (request !== listRequest) return
    error.value = formatApiError(cause, 'Не удалось загрузить электросеть')
  } finally {
    if (request === listRequest) loading.value = false
  }
}

/** openDialog ставит фильтры области сам и грузит список один раз — наблюдатели в это время молчат */
let applyingScope = false
watch([objectType, ownerId, voltageKv, parentLineId], () => {
  if (!visible.value || applyingScope) return
  page.value = 1
  void loadPage()
})
watch(page, () => { if (visible.value && !applyingScope) void loadPage() })

const onSearch = () => {
  if (!visible.value) return
  page.value = 1
  void loadPage()
}
const toggleObjectType = (type: ElectricalObjectType) => {
  objectType.value = objectType.value === type ? undefined : type
}
const resetFilters = () => {
  search.value = ''
  objectType.value = undefined
  ownerId.value = undefined
  voltageKv.value = undefined
  parentLineId.value = undefined
  page.value = 1
  void loadPage()
}

/** Номер последнего запроса паспорта: ответ более раннего запроса не перекрывает поздний */
let detailRequest = 0
const openDetails = async (type: ElectricalObjectType, objectId: number) => {
  // открытие другого объекта во время правки — черновик текущего остаётся, паспорт на просмотр
  closeKeepingDraft()
  resetEdit()
  clearSaveError()
  const request = ++detailRequest
  detailsVisible.value = true
  detailsLoading.value = true
  detailsError.value = ''
  selected.value = null
  try {
    const record = await fastApiService.getElectricalObject(type, objectId)
    if (request !== detailRequest) return
    selected.value = record
  } catch (cause) {
    if (request !== detailRequest) return
    // 404 — объекта нет в данных электросети: это «нет данных», а не сбой (QA F25)
    if (apiErrorStatus(cause) === 404) {
      detailsVisible.value = false
      notifications.showInfo(`Нет данных электросети по объекту №${objectId}`)
    } else {
      detailsError.value = formatApiError(cause, 'Не удалось открыть объект электросети')
    }
  } finally {
    if (request === detailRequest) detailsLoading.value = false
  }
}

const openRelation = (row: Record<string, unknown>) => {
  const type = row.object_type as ElectricalObjectType | undefined
  const id = Number(row.id)
  if (!id) return
  if (type) void openDetails(type, id)
  // у источника и приёмника связи — ЛЭП без вида в строке
  else if (selected.value?.object_type === 'source' || selected.value?.object_type === 'receiver') void openDetails('line', id)
}

let openDialogSeq = 0
const openDialog = async (nextScope: ElectricalNetworkJournalScope = {}) => {
  const seq = ++openDialogSeq
  tab.value = 'journal'
  applyingScope = true
  search.value = ''
  ownerId.value = undefined
  voltageKv.value = undefined
  objectType.value = nextScope.objectType
  parentLineId.value = nextScope.parentLineId
  page.value = 1
  visible.value = true
  await nextTick()
  applyingScope = false
  // список сам показывает свою ошибку; сбой справочника не должен прятать список
  const [lookupsResult] = await Promise.allSettled([loadLookups(), loadPage()])
  if (lookupsResult.status === 'rejected') notifications.showWarning(formatApiError(lookupsResult.reason, 'Справочники не загрузились — плитки и выбор значений могут быть неполными'))
  // журнал открыли снова, пока грузились списки — объект открывает последний вызов
  if (seq !== openDialogSeq) return
  if (nextScope.objectType && nextScope.objectId) await openDetails(nextScope.objectType, nextScope.objectId)
}

const startEdit = async () => {
  clearSaveError()
  await beginEdit()
}

const cancelEdit = async () => {
  const { closed } = await cancel()
  if (closed) clearSaveError()
}

// Паспорт закрыт крестиком или Esc во время правки — черновик остаётся до следующего открытия
watch(detailsVisible, (open) => {
  if (!open) closeKeepingDraft()
})

const saveChanges = async () => {
  const item = selected.value
  if (!item) return
  // только изменённые поля; пустая строка — NULL, как в десктопе
  const changed = Object.fromEntries(Object.entries(editFields.value)
    .filter(([key]) => isFieldDirty(key))
    .map(([key, value]) => [key, value === '' ? null : value]))
  if (!Object.keys(changed).length) return
  saving.value = true
  clearSaveError()
  try {
    await fastApiService.updateObjectAttributes(TABLE_MAP[item.object_type], item.id, changed)
    flashType.value = item.object_type
    markSaved(item.id)
    notifications.showSuccess('Изменения сохранены')
    await Promise.all([loadPage(), openDetails(item.object_type, item.id)])
  } catch (cause) {
    reportSaveError(cause, () => openDetails(item.object_type, item.id))
  } finally {
    saving.value = false
  }
}

const locate = (item: Record<string, unknown>) => {
  if (!hasCoordinates(item)) return
  const type = item.object_type as ElectricalObjectType
  emit('locate-electrical-object', {
    longitude: Number(item.longitude), latitude: Number(item.latitude), id: Number(item.id), objectType: type,
    label: `${typeMeta(type).title}: ${item.name || item.id}`
  })
  detailsVisible.value = false
  visible.value = false
}
const locateReconciliation = (payload: LocatePayload) => {
  emit('locate-electrical-object', payload)
  visible.value = false
}
const openReconciliationObject = (payload: { objectType: ElectricalObjectType; id: number }) => {
  void openDetails(payload.objectType, payload.id)
}

defineExpose({ openDialog })
</script>

<style scoped>
.electrical-journal { height: min(92vh, 930px); display: flex; flex-direction: column; }
.electrical-kpi { display: flex; flex-wrap: wrap; flex-shrink: 0; gap: var(--space-2); }
.electrical-filters { flex-shrink: 0; background: rgba(var(--v-theme-on-surface), 0.02); }
.electrical-table-wrap { min-height: 280px; overflow: auto; flex: 1; }
.electrical-table { min-width: 1300px; }
.relation-list { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: var(--radius-2, 6px); overflow: hidden; }
.relation-row {
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  text-align: left;
  cursor: pointer;
}
.relation-row:last-child { border-bottom: 0; }
.relation-row:hover,
.relation-row:focus-visible { background: rgba(var(--v-theme-primary), 0.06); }
/* телефон: плитки одной прокручиваемой строкой — таблица не уезжает за экран */
@media (max-width: 600px) {
  .electrical-journal { height: 100dvh; }
  .electrical-kpi { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .electrical-kpi > * { flex-shrink: 0; }
}
</style>
