<template>
  <v-dialog v-model="visible" :fullscreen="isMobile" max-width="1600" scrollable>
    <v-card class="electrical-journal" :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="amber-darken-4" density="comfortable">
        <v-icon class="ml-3">mdi-transmission-tower</v-icon>
        <v-toolbar-title>Электрическая сеть</v-toolbar-title>
        <v-chip class="mr-2" size="small">{{ total.toLocaleString('ru-RU') }} объектов</v-chip>
        <v-btn icon="mdi-close" @click="visible = false" />
      </v-toolbar>

      <div class="pa-3 electrical-filters">
        <v-row dense>
          <v-col cols="12" md="3">
            <v-text-field v-model="filters.search" label="Наименование, тип, владелец" density="compact" clearable hide-details prepend-inner-icon="mdi-magnify" @keyup.enter="reload" />
          </v-col>
          <v-col cols="6" md="2"><v-select v-model="filters.object_type" :items="objectTypes" label="Вид объекта" density="compact" clearable hide-details /></v-col>
          <v-col cols="6" md="2"><v-select v-model="filters.owner_id" :items="lookups.owners" item-title="name" item-value="id" label="Владелец" density="compact" clearable hide-details /></v-col>
          <v-col cols="6" md="2"><v-select v-model="filters.voltage_kv" :items="lookups.voltages" item-title="value" item-value="value" label="Напряжение, кВ" density="compact" clearable hide-details /></v-col>
          <v-col cols="6" md="2"><v-text-field v-model.number="filters.parent_line_id" type="number" label="ID ЛЭП" density="compact" clearable hide-details /></v-col>
          <v-col cols="12" md="2" class="d-flex ga-2"><v-btn color="amber-darken-4" prepend-icon="mdi-filter" @click="reload">Применить</v-btn><v-btn variant="text" icon="mdi-filter-remove" @click="resetFilters" /></v-col>
        </v-row>
        <div class="d-flex flex-wrap ga-2 mt-3">
          <v-chip v-for="type in objectTypes" :key="type.value" size="small" :color="type.color" variant="tonal">{{ type.title }}: {{ lookupCount(type.value) }}</v-chip>
        </div>
      </div>

      <v-progress-linear v-if="loading" indeterminate color="amber-darken-4" />
      <v-alert v-if="error" type="error" variant="tonal" class="ma-3">{{ error }}</v-alert>
      <v-card-text class="pa-0 electrical-table-wrap">
        <div v-if="!loading && !items.length" class="electrical-empty">
          <v-icon size="64" color="grey-lighten-1">mdi-transmission-tower-off</v-icon>
          <div class="text-h6 mt-3">Объекты электросети отсутствуют</div>
          <div class="text-body-2 text-medium-emphasis mt-1">В текущей БД таблицы источников, ЛЭП, приёмников и оборудования пусты.</div>
        </div>
        <table v-else class="electrical-table">
          <thead><tr><th>ID</th><th>Вид</th><th>Наименование</th><th>Тип</th><th>Владелец</th><th>ЛЭП</th><th>Напряжение</th><th>Мощность</th><th>Длина</th><th>Дата</th><th>Карта</th></tr></thead>
          <tbody>
            <tr v-for="item in items" :key="`${item.object_type}-${item.id}`" @click="openDetails(item.object_type, item.id)">
              <td>{{ item.id }}</td><td><v-chip size="x-small" :color="typeMeta(item.object_type).color">{{ typeMeta(item.object_type).title }}</v-chip></td><td>{{ item.name || '—' }}</td><td>{{ item.type_name || '—' }}</td><td>{{ item.owner_name || '—' }}</td><td>{{ item.parent_line_id || '—' }}</td><td>{{ numeric(item.voltage_kv, ' кВ') }}</td><td>{{ numeric(item.capacity_kw, ' кВт') }}</td><td>{{ numeric(item.length_m, ' м') }}</td><td>{{ formatDate(item.installed_on) }}</td><td><v-icon :color="hasCoordinates(item) ? 'amber-darken-4' : 'grey'">mdi-map-marker</v-icon></td>
            </tr>
          </tbody>
        </table>
      </v-card-text>
      <v-card-actions class="justify-center border-t-sm"><v-pagination v-model="page" :length="pages || 1" :total-visible="isMobile ? 4 : 8" density="comfortable" @update:model-value="loadPage" /></v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="detailsVisible" :fullscreen="isMobile" max-width="1050" scrollable>
    <v-card v-if="selected" :rounded="isMobile ? 0 : 'lg'">
      <v-toolbar color="amber-darken-4" density="comfortable">
        <v-icon class="ml-3">{{ typeMeta(selected.object_type).icon }}</v-icon>
        <v-toolbar-title>{{ typeMeta(selected.object_type).title }} {{ selected.name || selected.id }}</v-toolbar-title>
        <v-btn v-if="hasCoordinates(selected)" icon="mdi-crosshairs-gps" title="Показать на карте" @click="locateSelected" />
        <v-btn icon="mdi-close" @click="detailsVisible = false" />
      </v-toolbar>
      <v-progress-linear v-if="detailsLoading" indeterminate />
      <v-card-text>
        <section class="mb-5">
          <div class="text-subtitle-1 font-weight-bold mb-2">Основные данные</div>
          <div class="detail-grid">
            <div v-for="entry in summaryDetails" :key="entry[0]" class="detail-cell"><div class="detail-label">{{ entry[0] }}</div><div>{{ formatValue(entry[1]) }}</div></div>
          </div>
        </section>
        <section v-if="attributeDetails.length || isEditing" class="mb-5">
          <div class="d-flex justify-space-between align-center mb-2">
            <div class="text-subtitle-1 font-weight-bold">Паспортные поля</div>
            <div v-if="!isEditing">
              <v-btn v-if="mutationsEnabled" color="primary" variant="text" density="compact" prepend-icon="mdi-pencil" @click="startEdit">Редактировать</v-btn>
            </div>
            <div v-else class="d-flex ga-2">
              <v-btn v-if="mutationsEnabled" color="error" variant="text" density="compact" @click="cancelEdit" :disabled="saving">Отмена</v-btn>
              <v-btn v-if="mutationsEnabled" color="primary" variant="flat" density="compact" @click="saveChanges" :loading="saving">Сохранить</v-btn>
            </div>
          </div>
          <div class="detail-grid" v-if="!isEditing">
            <div v-for="entry in attributeDetails" :key="entry[0]" class="detail-cell"><div class="detail-label">{{ attributeLabel(entry[0]) }}</div><div>{{ formatValue(entry[1]) }}</div></div>
          </div>
          <v-card variant="outlined" class="pa-3" v-else>
            <v-row dense>
              <v-col v-for="field in buildFields()" :key="field.key" cols="12" sm="6">
                <div class="detail-label mb-1">{{ field.label }}</div>
                <v-select v-if="field.type === 'select'" v-model="editFields[field.key]" :items="field.items" item-title="name" item-value="id" density="compact" hide-details variant="outlined" clearable />
                <v-text-field v-else v-model="editFields[field.key]" :type="field.type === 'number' ? 'number' : 'text'" density="compact" hide-details variant="outlined" clearable />
              </v-col>
            </v-row>
          </v-card>
        </section>
        <section v-for="relation in relationGroups" :key="relation.key" class="mb-5">
          <div class="text-subtitle-1 font-weight-bold mb-2">{{ relation.title }} ({{ relation.rows.length }})</div>
          <div class="relation-list">
            <button v-for="(row, index) in relation.rows" :key="String(row.id || index)" type="button" class="relation-row" @click="openRelation(row)">
              <strong>{{ row.id ? `ID ${row.id}` : '—' }}</strong><span>{{ relationText(row) }}</span>
            </button>
          </div>
        </section>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useMutationsEnabled } from '~/composables/useMutationsEnabled'

const mutationsEnabled = useMutationsEnabled()
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { fastApiService, type ElectricalNetworkLookups, type ElectricalObjectDetails, type ElectricalObjectSummary, type ElectricalObjectType } from '~/services/fastApiService'

export interface ElectricalNetworkJournalScope { objectType?: ElectricalObjectType; objectId?: number; parentLineId?: number }

const emit = defineEmits<{ 'locate-electrical-object': [payload: { longitude: number; latitude: number; id: number; objectType: ElectricalObjectType; label: string }] }>()
const { mobile } = useDisplay(), isMobile = computed(() => mobile.value)
const visible = ref(false), detailsVisible = ref(false), loading = ref(false), detailsLoading = ref(false), error = ref('')
const page = ref(1), pages = ref(0), total = ref(0), items = ref<ElectricalObjectSummary[]>([]), selected = ref<ElectricalObjectDetails | null>(null)
const lookups = ref<ElectricalNetworkLookups>({ owners: [], source_types: [], receiver_types: [], line_types: [], cable_marks: [], voltages: [], counts: {} })
const filters = ref({ search: '', object_type: undefined as ElectricalObjectType | undefined, owner_id: undefined as number | undefined, parent_line_id: undefined as number | undefined, voltage_kv: undefined as number | undefined })
const isEditing = ref(false), saving = ref(false), editFields = ref<Record<string, any>>({})
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
const labels: Record<string, string> = { naimenovanie_lep: 'ЛЭП', naimenovanie_istochnika_es: 'Наименование источника', naimenovanie_priemnika_es: 'Наименование приёмника', napryazhenie__kv: 'Напряжение, кВ', maksimalno_dopustimaya_nagruzka_vneshnego_vvoda_rp__kvt: 'Максимальная нагрузка, кВт', mestopolozhenie: 'Местоположение', tip_prokladki_lep: 'Тип прокладки', cable_mark_name: 'Марка кабеля', fidera: 'Рабочие фидеры', fidera_rez: 'Резервные фидеры', protyazhennost__linii_m: 'Длина линии, м', protyazhennost__m: 'Длина кабеля, м', data_vvoda_v_ekspluatatsiyu: 'Дата ввода', data_ustanovki: 'Дата установки', primechanie: 'Примечание', trans_pro_kol: 'Производственные трансформаторы', trans_sob_kol: 'Трансформаторы собственных нужд', edv_pod_kol: 'Двигатели подачи', edv_obr_kol: 'Двигатели обратки', edv_dren_kol: 'Дренажные двигатели', edv_opr_kol: 'Опрессовочные двигатели', diz_kol: 'ДГУ', chast_reg_reg: 'Частотно-регулируемый привод' }

const summaryDetails = computed<Array<[string, unknown]>>(() => selected.value ? [['ID', selected.value.id], ['Вид', typeMeta(selected.value.object_type).title], ['Наименование', selected.value.name], ['Тип', selected.value.type_name], ['Владелец', selected.value.owner_name], ['Родительская ЛЭП', selected.value.parent_line_id], ['Источник', selected.value.source_id], ['Приёмник', selected.value.receiver_id], ['Напряжение', numeric(selected.value.voltage_kv, ' кВ')], ['Мощность', numeric(selected.value.capacity_kw, ' кВт')], ['Длина', numeric(selected.value.length_m, ' м')], ['Дата', formatDate(selected.value.installed_on)], ['Примечание', selected.value.note]] : [])
const attributeDetails = computed<Array<[string, unknown]>>(() => selected.value ? Object.entries(selected.value.attributes).filter(([key, value]) => key !== 'id' && value !== null && value !== '') : [])
const relationGroups = computed(() => selected.value ? Object.entries(selected.value.relations).filter(([, rows]) => rows.length).map(([key, rows]) => ({ key, title: relationTitle(key), rows })) : [])

function typeMeta(type: ElectricalObjectType) { return objectTypes.find(item => item.value === type) || objectTypes[1] }
function lookupCount(type: ElectricalObjectType) { return Number(lookups.value.counts[countKeys[type]] || 0).toLocaleString('ru-RU') }
function formatValue(value: unknown) { return value === null || value === undefined || value === '' ? '—' : String(value) }
function numeric(value: unknown, suffix = '') { return value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 })}${suffix}` }
function formatDate(value: unknown) { if (!value) return '—'; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('ru-RU') }
function hasCoordinates(item: object) { const row = item as Record<string, unknown>; return Number.isFinite(Number(row.longitude)) && Number.isFinite(Number(row.latitude)) }
function attributeLabel(key: string) { return labels[key] || key.replaceAll('_', ' ') }
function relationTitle(key: string) { return ({ lines: 'Связанные ЛЭП', children: 'Объекты ЛЭП', transformers: 'Трансформаторы', engines: 'Электродвигатели', diesel_generators: 'Дизель-генераторы', lifting_equipment: 'Грузоподъёмное оборудование', documents: 'Документы' } as Record<string, string>)[key] || key }
function relationText(row: Record<string, unknown>) { return String(row.name || row.description || row.document_type_name || row.path || row.object_type || 'Связанная запись') }

async function loadLookups() { if (!Object.keys(lookups.value.counts).length) lookups.value = await fastApiService.getElectricalNetworkLookups() }
async function loadPage() { loading.value = true; error.value = ''; try { const response = await fastApiService.getElectricalObjects({ page: page.value, page_size: 50, ...filters.value }); items.value = response.items; total.value = response.total; pages.value = response.pages } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить электросеть' } finally { loading.value = false } }
async function reload() { page.value = 1; await loadPage() }
async function resetFilters() { filters.value = { search: '', object_type: undefined, owner_id: undefined, parent_line_id: undefined, voltage_kv: undefined }; await reload() }
async function openDetails(objectType: ElectricalObjectType, objectId: number) { detailsVisible.value = true; detailsLoading.value = true; isEditing.value = false; try { selected.value = await fastApiService.getElectricalObject(objectType, objectId) } finally { detailsLoading.value = false } }
function openRelation(row: Record<string, unknown>) { const type = row.object_type as ElectricalObjectType | undefined; if (type && Number(row.id)) void openDetails(type, Number(row.id)); else if (selected.value?.object_type === 'source' || selected.value?.object_type === 'receiver') { if (Number(row.id)) void openDetails('line', Number(row.id)) } }
function locateSelected() { if (!selected.value || !hasCoordinates(selected.value)) return; emit('locate-electrical-object', { longitude: Number(selected.value.longitude), latitude: Number(selected.value.latitude), id: selected.value.id, objectType: selected.value.object_type, label: `${typeMeta(selected.value.object_type).title}: ${selected.value.name || selected.value.id}` }); visible.value = false; detailsVisible.value = false }
async function openDialog(scope: ElectricalNetworkJournalScope = {}) { visible.value = true; await loadLookups(); filters.value.object_type = scope.objectType; filters.value.parent_line_id = scope.parentLineId; await loadPage(); if (scope.objectType && scope.objectId) await openDetails(scope.objectType, scope.objectId) }

const TABLE_MAP: Record<ElectricalObjectType, string> = { source: 'istochnik_elektrosnabzheniya', line: 'liniya_elektroperedach', receiver: 'priemnik_elektrosnabzheniya', channel: 'kabelnyy_kanal_es', coupling: 'mufta', support: 'opora_es', sleeve: 'gilza_es' }

const buildFields = () => {
  if (!selected.value) return []
  const attrs = selected.value.attributes
  return Object.keys(attrs)
    .filter(key => key !== 'id' && key !== 'shape' && key !== 'fileid' && key !== 'uuid' && !key.endsWith('_name'))
    .map(key => {
      let type = typeof attrs[key] === 'number' ? 'number' : 'text'
      let items: any[] = []
      
      if (key === 'vladeltsy_es_id' || key === 'vladelets_lep') {
        type = 'select'; items = lookups.value.owners
      } else if (key === 'typid' && selected.value?.object_type === 'source') {
        type = 'select'; items = lookups.value.source_types
      } else if (key === 'typid' && selected.value?.object_type === 'receiver') {
        type = 'select'; items = lookups.value.receiver_types
      } else if (key === 'tip_prokladki_lep') {
        type = 'select'; items = lookups.value.line_types
      } else if (key === 'marka_kabelya_linii') {
        type = 'select'; items = lookups.value.cable_marks
      } else if (key.includes('date') || key.includes('data')) {
        type = 'text' // Fallback for dates
      }
      
      return { key, label: attributeLabel(key), type, items, value: attrs[key] }
    })
}

const startEdit = () => {
  isEditing.value = true; editFields.value = {}
  for (const field of buildFields()) if (field.key) editFields.value[field.key] = field.value ?? null
}
const cancelEdit = () => { isEditing.value = false; editFields.value = {} }

const saveChanges = async () => {
  if (!selected.value) return
  saving.value = true
  try {
    const processedFields: Record<string, any> = {}
    for (const key in editFields.value) {
      if (editFields.value[key] === '') processedFields[key] = null
      else processedFields[key] = editFields.value[key]
    }
    const tableName = TABLE_MAP[selected.value.object_type]
    await fastApiService.updateObjectAttributes(tableName, selected.value.id, processedFields)
    await openDetails(selected.value.object_type, selected.value.id)
    isEditing.value = false
    await loadPage()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Ошибка при сохранении' } finally { saving.value = false }
}

defineExpose({ openDialog })
</script>

<style scoped>
.electrical-journal { height: min(92vh, 930px); display: flex; flex-direction: column; }
.electrical-filters { flex-shrink: 0; background: #fff8e1; }
.electrical-table-wrap { min-height: 320px; overflow: auto; flex: 1; }
.electrical-table { width: 100%; min-width: 1350px; border-collapse: collapse; font-size: .83rem; }
.electrical-table th { position: sticky; top: 0; z-index: 1; background: #fff3e0; color: #e65100; text-align: left; padding: 10px 12px; }
.electrical-table td { padding: 10px 12px; border-bottom: 1px solid #eceff1; vertical-align: top; }
.electrical-table tbody tr { cursor: pointer; }.electrical-table tbody tr:hover { background: #fff8e1; }
.electrical-empty { min-height: 360px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e0e0e0; border: 1px solid #e0e0e0; }
.detail-cell { background: white; padding: 10px 12px; overflow-wrap: anywhere; }.detail-label { color: #795548; font-size: .75rem; margin-bottom: 2px; }
.relation-list { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }.relation-row { width: 100%; border: 0; border-bottom: 1px solid #eceff1; background: white; display: grid; grid-template-columns: 90px 1fr; gap: 12px; padding: 10px 12px; text-align: left; cursor: pointer; }.relation-row:hover { background: #fff8e1; }
@media (max-width: 600px) { .electrical-journal { height: 100dvh; } .detail-grid { grid-template-columns: 1fr; } }
</style>
