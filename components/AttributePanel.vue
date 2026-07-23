<template>


  <Teleport to="body">


    <v-dialog


      v-model="visible"


      :max-width="isMobile ? '100vw' : '680'"


      :fullscreen="isMobile"


      scrollable


      persistent


      :transition="isMobile ? 'dialog-bottom-transition' : 'dialog-transition'"


    >


      <v-card


        class="ap-card"


        :class="{ 'ap-card--mobile': isMobile }"


        elevation="8"


        :rounded="isMobile ? '0' : 'lg'"


      >


        <!-- ── Шапка ── -->


        <div class="ap-header" :class="isMobile ? 'pa-3' : 'pa-4'">


          <div class="d-flex align-center" style="gap: 12px; min-width: 0; flex: 1;">


            <v-avatar size="40" color="primary" class="ap-avatar flex-shrink-0">


              <v-icon size="20" color="white">mdi-information-outline</v-icon>


            </v-avatar>


            <div style="min-width: 0;">


              <div class="text-subtitle-1 font-weight-bold text-truncate ap-title">


                {{ objectTitle || 'Информация об объекте' }}


              </div>


              <div class="text-caption text-medium-emphasis">


                {{ filledCount }} из {{ totalAttributesCount }} заполнено


              </div>


            </div>


          </div>


          <div class="d-flex align-center" style="gap: 4px; flex-shrink: 0;">


            <v-btn


              v-if="propsData.id && (propsData.gistable === 'linesobj' || propsData.gistable === 'nodes')"


              icon


              variant="text"


              size="small"


              color="success"


              @click="downloadPassport"


            >


              <v-icon size="18">mdi-file-excel-box</v-icon>


              <v-tooltip activator="parent" location="bottom">Скачать паспорт (Excel)</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenDefectJournal"


              icon


              variant="text"


              size="small"


              color="deep-orange-darken-2"


              @click="openDefectJournal"


            >


              <v-icon size="18">mdi-alert-decagram-outline</v-icon>


              <v-tooltip activator="parent" location="bottom">Журнал нарушений объекта</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenShurfJournal"


              icon


              variant="text"


              size="small"


              color="brown-darken-2"


              @click="openShurfJournal"


            >


              <v-icon size="18">mdi-shovel</v-icon>


              <v-tooltip activator="parent" location="bottom">Журнал шурфовок объекта</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenInspectionJournal"


              icon


              variant="text"


              size="small"


              color="teal-darken-2"


              @click="openInspectionJournal"


            >


              <v-icon size="18">mdi-clipboard-search-outline</v-icon>


              <v-tooltip activator="parent" location="bottom">Журнал осмотров объекта</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenRepairJournal"


              icon


              variant="text"


              size="small"


              color="deep-purple-darken-2"


              @click="openRepairJournal"


            >


              <v-icon size="18">mdi-hammer-wrench</v-icon>


              <v-tooltip activator="parent" location="bottom">Журнал ремонтов объекта</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenPressureTestJournal"


              icon


              variant="text"


              size="small"


              color="blue-darken-2"


              @click="openPressureTestJournal"


            >


              <v-icon size="18">mdi-gauge</v-icon>


              <v-tooltip activator="parent" location="bottom">Журнал опрессовок объекта</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenTechnicalConditionJournal"


              icon


              variant="text"


              size="small"


              color="cyan-darken-3"


              @click="openTechnicalConditionJournal"


            >


              <v-icon size="18">mdi-file-certificate-outline</v-icon>


              <v-tooltip activator="parent" location="bottom">Технические условия объекта</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenCorrosionIndicatorJournal"


              icon


              variant="text"


              size="small"


              color="orange-darken-3"


              @click="openCorrosionIndicatorJournal"


            >


              <v-icon size="18">mdi-test-tube</v-icon>


              <v-tooltip activator="parent" location="bottom">Индикаторы коррозии объекта</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenAlsekoJournal"


              icon


              variant="text"


              size="small"


              color="indigo-darken-2"


              @click="openAlsekoJournal"


            >


              <v-icon size="18">mdi-office-building-marker</v-icon>


              <v-tooltip activator="parent" location="bottom">Объекты АЛСЕКО по адресу</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenElectricalNetworkJournal"


              icon


              variant="text"


              size="small"


              color="amber-darken-4"


              @click="openElectricalNetworkJournal"


            >


              <v-icon size="18">mdi-transmission-tower</v-icon>


              <v-tooltip activator="parent" location="bottom">Карточка объекта электросети</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenHeatLossJournal"


              icon


              variant="text"


              size="small"


              color="deep-orange-darken-3"


              @click="openHeatLossJournal"


            >


              <v-icon size="18">mdi-heat-wave</v-icon>


              <v-tooltip activator="parent" location="bottom">Исходные данные тепловых потерь‚РµСЂСЊ</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenTemperatureGraphJournal"


              icon


              variant="text"


              size="small"


              color="purple-darken-3"


              @click="openTemperatureGraphJournal"


            >


              <v-icon size="18">mdi-chart-bell-curve-cumulative</v-icon>


              <v-tooltip activator="parent" location="bottom">Температурный график источника</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenConsumerLoadDiagnostics"


              icon


              variant="text"


              size="small"


              color="teal-darken-3"


              @click="openConsumerLoadDiagnostics"


            >


              <v-icon size="18">mdi-home-lightning-bolt-outline</v-icon>


              <v-tooltip activator="parent" location="bottom">Диагностика нагрузки потребителя</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenPumpEquipment"


              icon


              variant="text"


              size="small"


              color="blue-grey-darken-3"


              @click="openPumpEquipment"


            >


              <v-icon size="18">mdi-pump</v-icon>


              <v-tooltip activator="parent" location="bottom">Насосное оборудование и характеристики</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenNetworkArmatures"


              icon


              variant="text"


              size="small"


              color="deep-purple-darken-3"


              @click="openNetworkArmatures"


            >


              <v-icon size="18">mdi-valve</v-icon>


              <v-tooltip activator="parent" location="bottom">Запорная и регулирующая арматура</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenNetworkRegulators"


              icon


              variant="text"


              size="small"


              color="indigo-darken-3"


              @click="openNetworkRegulators"


            >


              <v-icon size="18">mdi-tune-vertical</v-icon>


              <v-tooltip activator="parent" location="bottom">Сетевые регуляторы</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenNetworkBypasses"


              icon


              variant="text"


              size="small"


              color="cyan-darken-4"


              @click="openNetworkBypasses"


            >


              <v-icon size="18">mdi-pipe-valve</v-icon>


              <v-tooltip activator="parent" location="bottom">Байпасы наружных теплопроводов</v-tooltip>


            </v-btn>


            <v-btn


              v-if="canOpenNetworkDiaphragms"


              icon


              variant="text"


              size="small"


              color="teal-darken-4"


              @click="openNetworkDiaphragms"


            >


              <v-icon size="18">mdi-circle-slice-8</v-icon>


              <v-tooltip activator="parent" location="bottom">Диафрагмы наружных теплопроводов</v-tooltip>


            </v-btn>


            <v-btn


              v-if="propsData.id && (propsData.defectid || String(propsData.gistable || '').toLowerCase().includes('defect'))"


              icon


              variant="text"


              size="small"


              color="primary"


              @click="downloadWordReport"


            >


              <v-icon size="18">mdi-file-word-box</v-icon>


              <v-tooltip activator="parent" location="bottom">Карта повреждаемости (Word)</v-tooltip>


            </v-btn>


            <v-btn


              icon


              variant="text"


              size="small"


              color="grey-darken-1"


              :loading="copying"


              @click="copyToClipboard"


            >


              <v-icon size="18">mdi-content-copy</v-icon>


              <v-tooltip activator="parent" location="bottom" aria-label="Копировать всё">Копировать всё</v-tooltip>


            </v-btn>


            <v-btn


              v-if="isEditTopologyMode"


              icon


              variant="text"


              size="small"


              color="error"


              @click="$emit('delete-feature', propsData.id)"


            >


              <v-icon size="18">mdi-delete</v-icon>


              <v-tooltip activator="parent" location="bottom">Удалить объект</v-tooltip>


            </v-btn>


            <v-btn icon variant="text" size="small" color="grey-darken-1" @click="close">


              <v-icon>mdi-close</v-icon>


            </v-btn>


          </div>


        </div>





        <v-divider />





        <!-- ── Поиск ── -->


        <div class="ap-search" :class="isMobile ? 'pa-3 pb-2' : 'pa-3 pb-2'">


          <v-text-field


            v-model="search"


            prepend-inner-icon="mdi-magnify"


            placeholder="Поиск атрибутов..."


            variant="outlined"


            density="compact"


            hide-details


            clearable


            rounded="lg"


            bg-color="grey-lighten-5"


          >


            <template v-if="search && totalFilteredCount !== totalAttributesCount" #append-inner>


              <v-chip size="x-small" color="primary" variant="tonal">{{ totalFilteredCount }}</v-chip>


            </template>


          </v-text-field>


        </div>





        <!-- ── Табы ── -->


        <template v-if="hasTabsStructure">


          <v-tabs


            v-model="activeTab"


            bg-color="white"


            color="primary"


            density="compact"


            slider-color="primary"


            class="ap-tabs"


          >


            <v-tab


              v-for="(tab, idx) in tabsData"


              :key="idx"


              :value="idx"


              class="ap-tab"


            >


              {{ tab.tabName }}


              <v-chip size="x-small" color="primary" variant="tonal" class="ml-1" style="pointer-events:none;">


                {{ getTabFieldsCount(tab) }}


              </v-chip>


            </v-tab>


          </v-tabs>


          <v-divider />


        </template>





        <!-- ── Контент ── -->


                <div class="ap-content">

          <!-- Calculation Results Section -->

          <div v-if="propsData._isCalculationResult" class="pa-2">

            <v-card variant="outlined" class="mb-2 border-primary bg-blue-grey-lighten-5">

              <v-card-title class="text-subtitle-2 font-weight-bold text-primary py-2 px-3">

                <v-icon size="small" class="mr-1">mdi-calculator</v-icon>

                Результаты расчета

              </v-card-title>

              <v-divider></v-divider>

              <v-card-text class="pa-0">

                <v-list density="compact" class="bg-transparent">

                  <v-list-item v-if="propsData.flow !== undefined">

                    <template v-slot:title><span class="text-caption text-medium-emphasis">Расход воды (т/ч)</span></template>

                    <template v-slot:append><span class="text-body-2 font-weight-medium">{{ propsData.flow?.toFixed(2) ?? '-' }}</span></template>

                  </v-list-item>

                  <v-list-item v-if="propsData.velocity !== undefined">

                    <template v-slot:title><span class="text-caption text-medium-emphasis">Скорость воды (м/с)</span></template>

                    <template v-slot:append><span class="text-body-2 font-weight-medium">{{ propsData.velocity?.toFixed(2) ?? '-' }}</span></template>

                  </v-list-item>

                  <v-list-item v-if="propsData.pressure_drop !== undefined">

                    <template v-slot:title><span class="text-caption text-medium-emphasis">Падение давления (м)</span></template>

                    <template v-slot:append><span class="text-body-2 font-weight-medium">{{ propsData.pressure_drop?.toFixed(2) ?? '-' }}</span></template>

                  </v-list-item>

                  <v-list-item v-if="propsData.specific_pressure_drop !== undefined">

                    <template v-slot:title><span class="text-caption text-medium-emphasis">Удельное падение давления (мм/м)</span></template>

                    <template v-slot:append><span class="text-body-2 font-weight-medium">{{ propsData.specific_pressure_drop?.toFixed(2) ?? '-' }}</span></template>

                  </v-list-item>

                  <v-list-item v-if="propsData.head_start !== undefined">

                    <template v-slot:title><span class="text-caption text-medium-emphasis">Напор в начале (м)</span></template>

                    <template v-slot:append><span class="text-body-2 font-weight-medium">{{ propsData.head_start?.toFixed(2) ?? '-' }}</span></template>

                  </v-list-item>

                  <v-list-item v-if="propsData.head_end !== undefined">

                    <template v-slot:title><span class="text-caption text-medium-emphasis">Напор в конце (м)</span></template>

                    <template v-slot:append><span class="text-body-2 font-weight-medium">{{ propsData.head_end?.toFixed(2) ?? '-' }}</span></template>

                  </v-list-item>

                </v-list>

              </v-card-text>

            </v-card>

          </div>


          <!-- Tabbed view -->


          <v-window v-if="hasTabsStructure" v-model="activeTab">


            <v-window-item


              v-for="(tab, tabIdx) in tabsData"


              :key="tabIdx"


              :value="tabIdx"


            >


              <div v-if="getFilteredTabSections(tab).length > 0" class="pa-2">


                <v-expansion-panels


                  v-model="expandedSections[tabIdx]"


                  multiple


                  flat


                  class="ap-panels"


                >


                  <v-expansion-panel


                    v-for="(section, secIdx) in getFilteredTabSections(tab)"


                    :key="`${tabIdx}-${secIdx}`"


                    :value="secIdx"


                    class="ap-panel mb-2"


                    elevation="0"


                    rounded="lg"


                  >


                    <v-expansion-panel-title class="ap-panel-title px-3 py-2">


                      <div class="d-flex align-center w-100" style="gap: 8px;">


                        <v-icon size="15" color="primary">mdi-table-of-contents</v-icon>


                        <span class="text-body-2 font-weight-semibold">{{ section.sectionName }}</span>


                        <v-chip


                          size="x-small"


                          color="primary"


                          variant="tonal"


                          class="ms-auto"


                          style="pointer-events: none;"


                        >


                          {{ section.fields.length }}


                        </v-chip>


                      </div>


                    </v-expansion-panel-title>





                    <v-expansion-panel-text>


                      <div class="ap-fields">


                        <div


                          v-for="field in section.fields"


                          :key="field.key"


                          class="ap-field-row"


                        >


                          <span class="ap-field-label">{{ field.label }}</span>


                          <div class="ap-field-value-wrap">


                            <span


                              class="ap-field-value"


                              :class="{ 'ap-field-value--empty': !hasValue(field.value) }"


                            >


                              {{ hasValue(field.value) ? formatValue(field.value) : '—' }}


                            </span>


                            <v-btn


                              v-if="hasValue(field.value)"


                              icon


                              size="x-small"


                              variant="text"


                              color="grey"


                              class="ap-copy-btn"


                              @click.stop="copyAttribute(field.key, field.value)"


                            >


                              <v-icon size="13">mdi-content-copy</v-icon>


                              <v-tooltip activator="parent" location="left" aria-label="Копировать">Копировать</v-tooltip>


                            </v-btn>


                          </div>


                        </div>


                      </div>


                    </v-expansion-panel-text>


                  </v-expansion-panel>


                </v-expansion-panels>


              </div>


              <div v-else class="ap-empty">


                <v-icon size="40" color="grey-lighten-2">mdi-file-search-outline</v-icon>


                <div class="text-body-2 text-grey mt-2">{{ search ? 'Атрибуты не найдены' : 'Нет данных' }}</div>


              </div>


            </v-window-item>


          </v-window>





          <!-- Simple list (no tabs) -->


          <div v-else class="pa-2">


            <div v-if="Object.keys(filteredAttributesList).length > 0" class="ap-fields pa-1">


              <div


                v-for="(value, key) in filteredAttributesList"


                :key="key"


                class="ap-field-row"


              >


                <span class="ap-field-label">{{ formatAttributeLabel(String(key)) }}</span>


                <div class="ap-field-value-wrap">


                  <span


                    class="ap-field-value"


                    :class="{ 'ap-field-value--empty': !hasValue(value) }"


                  >


                    {{ hasValue(value) ? formatValue(value) : '—' }}


                  </span>


                  <v-btn


                    v-if="hasValue(value)"


                    icon size="x-small" variant="text" color="grey"


                    class="ap-copy-btn"


                    @click.stop="copyAttribute(String(key), value)"


                  >


                    <v-icon size="13">mdi-content-copy</v-icon>


                    <v-tooltip activator="parent" location="left" aria-label="Копировать">Копировать</v-tooltip>


                  </v-btn>


                </div>


              </div>


            </div>


            <div v-else class="ap-empty">


              <v-icon size="40" color="grey-lighten-2">mdi-file-search-outline</v-icon>


              <div class="text-body-2 text-grey mt-2">{{ search ? 'Не найдено' : 'Нет данных' }}</div>


            </div>


          </div>


        </div>


      </v-card>


    </v-dialog>





    <v-snackbar v-model="showNotification" :timeout="2000" color="primary" location="bottom" rounded="pill">


      <div class="d-flex align-center" style="gap: 8px;">


        <v-icon size="16">mdi-check-circle</v-icon>


        {{ notificationMessage }}


      </div>


    </v-snackbar>


  </Teleport>


</template>





<script setup lang="ts">


import { ref, computed, watch } from 'vue'


import { useMobile } from '~/composables/useMobile'


import { useAttributeTabs, type TabData } from '~/composables/useAttributeTabs'


import { fastApiService } from '~/services/fastApiService'





const componentProps = withDefaults(defineProps<{


  isEditTopologyMode?: boolean


}>(), {


  isEditTopologyMode: false


})





const emit = defineEmits<{


  'delete-feature': [featureId: string | number]


  'open-defect-journal': [scope: { lineId?: number; nodeId?: number; defectId?: number }]


  'open-shurf-journal': [scope: { lineId?: number; nodeId?: number; shurfId?: number }]


  'open-inspection-journal': [scope: { lineId?: number; nodeId?: number; inspectionId?: number }]


  'open-repair-journal': [scope: { lineId?: number; nodeId?: number; repairId?: number }]


  'open-pressure-test-journal': [scope: { lineId?: number; nodeId?: number; testId?: number }]


  'open-technical-condition-journal': [scope: { buildingId?: number; pipeId?: number; conditionId?: number }]


  'open-corrosion-indicator-journal': [scope: { lineId?: number; nodeId?: number; indicatorId?: number }]


  'open-alseko-journal': [scope: { loadId?: number; buildingId?: number }]


  'open-electrical-network-journal': [scope: { objectType?: 'source' | 'line' | 'receiver' | 'channel' | 'coupling' | 'support' | 'sleeve'; objectId?: number; parentLineId?: number }]


  'open-heat-loss-journal': [scope: { sourceId?: number; seasonId?: number }]


  'open-temperature-graph-journal': [scope: { sourceId?: number; nodeId?: number; graphStatus?: 'ready' | 'missing' | 'duplicates' | 'incomplete' }]


  'open-consumer-load-diagnostics': [scope: { consumerType?: 'generalized' | 'real'; consumerId?: number; nodeId?: number; diagnostic?: 'zero_load' | 'closed' | 'disconnected' | 'not_calculated' }]


  'open-pump-equipment': [scope: { pumpId?: number; standardPumpId?: number; lineId?: number }]


  'open-network-armatures': [scope: { equipmentType?: 'damper' | 'regulating'; armatureId?: number; standardId?: number; lineId?: number }]


  'open-network-regulators': [scope: { regulatorType?: 'pressure' | 'flow' | 'differential'; regulatorId?: number; catalogType?: 'pressure' | 'flow' | 'differential'; catalogId?: number; lineId?: number }]


  'open-network-bypasses': [scope: { bypassId?: number; standardTubeId?: number; lineId?: number }]


  'open-network-diaphragms': [scope: { diaphragmId?: number; lineId?: number }]


}>()





const { isMobile } = useMobile()


const { getAttributeLabel, groupAttributesByTabs, getUncategorizedAttributes } = useAttributeTabs()





const visible = ref(false)


const attributes = ref<Record<string, any>>({})


const propsData = ref<Record<string, any>>({})


const search = ref('')


const copying = ref(false)


const showNotification = ref(false)


const notificationMessage = ref('')


const activeTab = ref(0)


const expandedSections = ref<Record<number, number[]>>({})





const tabsData = ref<TabData[]>([])


const uncategorizedAttributes = ref<Array<{ key: string; value: any; label: string }>>([])


const objectTitle = ref('')


const objectTabsData = ref<any[] | null>(null)


const objectNamesData = ref<Record<string, string> | null>(null)


const isEditTopologyMode = computed(() => componentProps.isEditTopologyMode)


const canOpenDefectJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'linesobj'


    || table === 'nodes'


    || table.includes('defect')


  )


})


const canOpenShurfJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'linesobj'


    || table === 'nodes'


    || table.includes('shurf')


  )


})


const canOpenInspectionJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'linesobj'


    || table === 'nodes'


    || table.includes('osmotr')


    || table.includes('inspection')


  )


})


const canOpenRepairJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'linesobj'


    || table === 'nodes'


    || table.includes('remont')


    || table.includes('repair')


  )


})


const canOpenPressureTestJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'linesobj'


    || table === 'nodes'


    || table.includes('opres')


    || table.includes('pressure')


  )


})


const canOpenTechnicalConditionJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'zdaniya_tu'


    || table === 'tehnicheskie_usloviya'


    || table.includes('technical_condition')


  )


})


const canOpenCorrosionIndicatorJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'linesobj'


    || table === 'nodes'


    || table === 'indikator_korrozii'


    || table === 'corrosionindicators'


  )


})


const canOpenAlsekoJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (table === 'zdaniya_2' || table === 'nagruzki')


})


const electricalTableTypes = {


  istochnik_elektrosnabzheniya: 'source', liniya_elektroperedach: 'line',


  priemnik_elektrosnabzheniya: 'receiver', kabelnyy_kanal_es: 'channel',


  mufta: 'coupling', opora_es: 'support', gilza_es: 'sleeve'


} as const


const canOpenElectricalNetworkJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && table in electricalTableTypes


})


const canOpenHeatLossJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (table === 'heatsources' || table === 'heatlosesmain')


})


const canOpenTemperatureGraphJournal = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (table === 'heatsources' || table === 'nodes')


})


const canOpenConsumerLoadDiagnostics = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'generalizedconsumers' || table === 'realconsumers' || table === 'nodes'


  )


})


const canOpenPumpEquipment = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'pumps' || table === 'standardpumps' || table === 'linesobj'


  )


})


const canOpenNetworkArmatures = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'dampers' || table === 'regularmatures' || table === 'standarddampers' || table === 'linesobj'


  )


})


const canOpenNetworkRegulators = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'pressregulators' || table === 'consumptregulators' || table === 'pressdropregulators'


    || table === 'standardpressregulators' || table === 'standardconsregulators'


    || table === 'standardpressdropregulators' || table === 'linesobj'


  )


})


const canOpenNetworkBypasses = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'bypass' || table === 'standardtubes' || table === 'linesobj'


  )


})


const canOpenNetworkDiaphragms = computed(() => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  return Boolean(propsData.value.id) && (


    table === 'diaphragms' || table === 'linesobj'


  )


})





const hasTabsStructure = computed(() => objectTabsData.value !== null && tabsData.value.length > 0)





const filteredAttributesList = computed(() => {


  if (!search.value) return attributes.value


  const s = search.value.toLowerCase()


  const result: Record<string, any> = {}


  Object.entries(attributes.value).forEach(([k, v]) => {


    if (formatAttributeLabel(k).toLowerCase().includes(s) || k.toLowerCase().includes(s) || String(v).toLowerCase().includes(s)) {


      result[k] = v


    }


  })


  return result


})





const getFilteredTabSections = (tab: TabData) => {


  if (!search.value) return tab.sections.filter(s => s.fields.length > 0)


  const s = search.value.toLowerCase()


  return tab.sections.map(section => ({


    ...section,


    fields: section.fields.filter(f =>


      f.label.toLowerCase().includes(s) || f.key.toLowerCase().includes(s) || String(f.value).toLowerCase().includes(s)


    )


  })).filter(section => section.fields.length > 0)


}





const filteredUncategorized = computed(() => {


  if (!search.value) return uncategorizedAttributes.value


  const s = search.value.toLowerCase()


  return uncategorizedAttributes.value.filter(f =>


    f.label.toLowerCase().includes(s) || f.key.toLowerCase().includes(s) || String(f.value).toLowerCase().includes(s)


  )


})





const getTabFieldsCount = (tab: TabData) => {


  if (!search.value) return tab.sections.reduce((sum, s) => sum + s.fields.length, 0)


  return getFilteredTabSections(tab).reduce((sum, s) => sum + s.fields.length, 0)


}





const totalAttributesCount = computed(() => Object.keys(attributes.value).length)


const totalFilteredCount = computed(() => {


  if (!search.value) return totalAttributesCount.value


  let count = 0


  tabsData.value.forEach(tab => getFilteredTabSections(tab).forEach(s => count += s.fields.length))


  count += filteredUncategorized.value.length


  return count


})


const filledCount = computed(() =>


  Object.values(attributes.value).filter(v => v !== null && v !== undefined && v !== '').length


)





const updateTabsStructure = (objectTabs: any[], objectNames: Record<string, string>) => {


  tabsData.value = groupAttributesByTabs(attributes.value, objectTabs, objectNames)


  uncategorizedAttributes.value = getUncategorizedAttributes(attributes.value, objectTabs, objectNames)


  tabsData.value = tabsData.value.filter(tab => tab.sections.some(s => s.fields.length > 0))


  tabsData.value.forEach((tab, idx) => {


    if (!expandedSections.value[idx]) {


      expandedSections.value[idx] = tab.sections.length > 0 ? [0] : []


    }


  })


}





const getObjectTitle = (props: Record<string, any>): string => {


  return props.name || props.externalnodename || props.nodename || props.naimenovanie ||


    (props.id ? `ID: ${props.id}` : '') || 'Объект'


}





const show = (props: Record<string, any>) => {


  let objectTabs: any[] | null = null


  let objectNames: Record<string, string> | null = null





  console.log('[AttributePanel] show() called, props keys:', Object.keys(props))


  console.log('[AttributePanel] tg_tabs present:', !!props.tg_tabs, '| type:', typeof props.tg_tabs)





  if (props.tg_tabs) {


    try {


      objectTabs = typeof props.tg_tabs === 'string' ? JSON.parse(props.tg_tabs) : props.tg_tabs


      console.log('[AttributePanel] objectTabs parsed:', objectTabs?.length, 'tabs')


    } catch (e) {


      console.error('[AttributePanel] tg_tabs parse error:', e)


      console.error('[AttributePanel] tg_tabs raw value:', String(props.tg_tabs).substring(0, 200))


    }


  } else {


    console.warn('[AttributePanel] tg_tabs is missing or falsy in props!')


  }





  if (props.tg_names) {


    try {


      objectNames = typeof props.tg_names === 'string' ? JSON.parse(props.tg_names) : props.tg_names


    } catch (e) { console.error('[AttributePanel] tg_names parse error:', e) }


  }





  const { tg_tabs, tg_names, ...cleanProps } = props





  console.log('[AttributePanel] cleanProps keys count:', Object.keys(cleanProps).length)





  objectTabsData.value = objectTabs


  objectNamesData.value = objectNames





  propsData.value = cleanProps


  attributes.value = cleanProps


  search.value = ''


  activeTab.value = 0


  expandedSections.value = {}


  objectTitle.value = getObjectTitle(cleanProps)





  if (objectTabs) {


    updateTabsStructure(objectTabs, objectNames || {})


    console.log('[AttributePanel] tabsData after build:', tabsData.value.length, 'tabs', tabsData.value.map(t => t.tabName))


  } else {


    console.warn('[AttributePanel] objectTabs is null → no tabs will be shown')


    tabsData.value = []


    uncategorizedAttributes.value = []


  }





  visible.value = true


}





const close = () => {


  visible.value = false


  search.value = ''


  objectTabsData.value = null


  objectNamesData.value = null


}





const formatAttributeLabel = (key: string): string => {


  if (objectNamesData.value) {


    const foundKey = Object.keys(objectNamesData.value).find(k => k.toLowerCase() === key.toLowerCase())


    if (foundKey) return objectNamesData.value[foundKey]


  }


  return getAttributeLabel(key)


}





const hasValue = (v: unknown) => v !== null && v !== undefined && v !== ''





// Detects ISO date strings like "2017-04-03Z" or "2017-04-09T18:00:00Z"


// and formats them as "03.04.2017" / "03.04.2017 18:00"


const formatValue = (value: any): string => {


  if (value === null || value === undefined || value === '') return ''


  const s = String(value)


  // Match "YYYY-MM-DDZ" or "YYYY-MM-DDTHH:MM:SSZ" (with optional ms)


  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})Z$/)


  if (dateOnly) {


    return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`


  }


  const dateTime = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?Z$/)


  if (dateTime) {


    return `${dateTime[3]}.${dateTime[2]}.${dateTime[1]} ${dateTime[4]}:${dateTime[5]}`


  }


  return s


}





const copyAttribute = async (key: string, value: any) => {


  try {


    await navigator.clipboard.writeText(`${key}: ${value}`)


    notificationMessage.value = `Скопировано: ${formatAttributeLabel(key)}`


    showNotification.value = true


  } catch (e) { console.error('Copy error:', e) }


}





const copyToClipboard = async () => {


  copying.value = true


  try {


    const text = Object.entries(attributes.value)


      .map(([k, v]) => `${getAttributeLabel(k)}: ${v}`).join('\n')


    await navigator.clipboard.writeText(text)


    notificationMessage.value = `Скопировано ${totalAttributesCount.value} атрибутов`


    showNotification.value = true


  } finally { copying.value = false }


}





const saveBlob = (blob: Blob, filename: string) => {


  const objectUrl = URL.createObjectURL(blob)


  const link = document.createElement('a')


  link.href = objectUrl


  link.download = filename


  document.body.appendChild(link)


  link.click()


  link.remove()


  URL.revokeObjectURL(objectUrl)


}





const downloadPassport = async () => {


  const table = String(propsData.value.gistable || '')


  const id = Number(propsData.value.id)


  if (!table || !Number.isFinite(id)) return


  try {


    const { blob, filename } = await fastApiService.downloadObjectPassport(table, id)


    saveBlob(blob, filename)


    notificationMessage.value = `Паспорт «${filename}» сформирован`


    showNotification.value = true


  } catch (error: any) {


    notificationMessage.value = `Ошибка формирования паспорта: ${error?.message || error}`


    showNotification.value = true


  }


}





const downloadWordReport = async () => {


  const defectId = Number(propsData.value.defectid || propsData.value.id)


  if (!Number.isFinite(defectId)) return


  try {


    const { blob, filename } = await fastApiService.downloadWordReport(defectId)


    saveBlob(blob, filename)


    notificationMessage.value = `Отчёт «${filename}» сформирован`


    showNotification.value = true


  } catch (error: any) {


    notificationMessage.value = `Ошибка формирования отчёта: ${error?.message || error}`


    showNotification.value = true


  }


}





const openDefectJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'linesobj') emit('open-defect-journal', { lineId: id })


  else if (table === 'nodes') emit('open-defect-journal', { nodeId: id })


  else if (table.includes('defect')) {


    emit('open-defect-journal', { defectId: Number(propsData.value.defectid || id) })


  }


}





const openShurfJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'linesobj') emit('open-shurf-journal', { lineId: id })


  else if (table === 'nodes') emit('open-shurf-journal', { nodeId: id })


  else if (table.includes('shurf')) {


    emit('open-shurf-journal', { shurfId: Number(propsData.value.shurfid || id) })


  }


}





const openInspectionJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'linesobj') emit('open-inspection-journal', { lineId: id })


  else if (table === 'nodes') emit('open-inspection-journal', { nodeId: id })


  else if (table.includes('osmotr') || table.includes('inspection')) {


    emit('open-inspection-journal', { inspectionId: Number(propsData.value.osmotrid || id) })


  }


}





const openRepairJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'linesobj') emit('open-repair-journal', { lineId: id })


  else if (table === 'nodes') emit('open-repair-journal', { nodeId: id })


  else if (table.includes('remont') || table.includes('repair')) {


    emit('open-repair-journal', { repairId: Number(propsData.value.remontid || id) })


  }


}





const openPressureTestJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'linesobj') emit('open-pressure-test-journal', { lineId: id })


  else if (table === 'nodes') emit('open-pressure-test-journal', { nodeId: id })


  else if (table.includes('opres') || table.includes('pressure')) {


    emit('open-pressure-test-journal', { testId: Number(propsData.value.opresid || id) })


  }


}





const openTechnicalConditionJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'zdaniya_tu') emit('open-technical-condition-journal', { buildingId: id })


  else if (table === 'tehnicheskie_usloviya' || table.includes('technical_condition')) {


    emit('open-technical-condition-journal', { conditionId: id })


  }


}





const openCorrosionIndicatorJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'linesobj') emit('open-corrosion-indicator-journal', { lineId: id })


  else if (table === 'nodes') emit('open-corrosion-indicator-journal', { nodeId: id })


  else if (table === 'indikator_korrozii' || table === 'corrosionindicators') {


    emit('open-corrosion-indicator-journal', { indicatorId: id })


  }


}





const openAlsekoJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'zdaniya_2') emit('open-alseko-journal', { buildingId: id })


  else if (table === 'nagruzki') emit('open-alseko-journal', { loadId: id })


}





const openElectricalNetworkJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase() as keyof typeof electricalTableTypes


  const id = Number(propsData.value.id)


  const objectType = electricalTableTypes[table]


  if (!objectType || !Number.isFinite(id)) return


  emit('open-electrical-network-journal', { objectType, objectId: id })


}





const openHeatLossJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'heatsources') emit('open-heat-loss-journal', { sourceId: id })


  else if (table === 'heatlosesmain') emit('open-heat-loss-journal', { seasonId: id })


}





const openTemperatureGraphJournal = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'heatsources') emit('open-temperature-graph-journal', { sourceId: id })


  else if (table === 'nodes') emit('open-temperature-graph-journal', { nodeId: id })


}





const openConsumerLoadDiagnostics = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'generalizedconsumers') emit('open-consumer-load-diagnostics', { consumerType: 'generalized', consumerId: id })


  else if (table === 'realconsumers') emit('open-consumer-load-diagnostics', { consumerType: 'real', consumerId: id })


  else if (table === 'nodes') emit('open-consumer-load-diagnostics', { nodeId: id })


}





const openPumpEquipment = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'pumps') emit('open-pump-equipment', { pumpId: id })


  else if (table === 'standardpumps') emit('open-pump-equipment', { standardPumpId: id })


  else if (table === 'linesobj') emit('open-pump-equipment', { lineId: id })


}





const openNetworkArmatures = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'dampers') emit('open-network-armatures', { equipmentType: 'damper', armatureId: id })


  else if (table === 'regularmatures') emit('open-network-armatures', { equipmentType: 'regulating', armatureId: id })


  else if (table === 'standarddampers') emit('open-network-armatures', { standardId: id })


  else if (table === 'linesobj') emit('open-network-armatures', { lineId: id })


}





const openNetworkRegulators = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'pressregulators') emit('open-network-regulators', { regulatorType: 'pressure', regulatorId: id })


  else if (table === 'consumptregulators') emit('open-network-regulators', { regulatorType: 'flow', regulatorId: id })


  else if (table === 'pressdropregulators') emit('open-network-regulators', { regulatorType: 'differential', regulatorId: id })


  else if (table === 'standardpressregulators') emit('open-network-regulators', { catalogType: 'pressure', catalogId: id })


  else if (table === 'standardconsregulators') emit('open-network-regulators', { catalogType: 'flow', catalogId: id })


  else if (table === 'standardpressdropregulators') emit('open-network-regulators', { catalogType: 'differential', catalogId: id })


  else if (table === 'linesobj') emit('open-network-regulators', { lineId: id })


}





const openNetworkBypasses = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'bypass') emit('open-network-bypasses', { bypassId: id })


  else if (table === 'standardtubes') emit('open-network-bypasses', { standardTubeId: id })


  else if (table === 'linesobj') emit('open-network-bypasses', { lineId: id })


}





const openNetworkDiaphragms = () => {


  const table = String(propsData.value.gistable || '').toLowerCase()


  const id = Number(propsData.value.id)


  if (!Number.isFinite(id)) return


  if (table === 'diaphragms') emit('open-network-diaphragms', { diaphragmId: id })


  else if (table === 'linesobj') emit('open-network-diaphragms', { lineId: id })


}





defineExpose({ show, close })


</script>





<style scoped>


/* ── Card ── */


.ap-card {


  display: flex;


  flex-direction: column;


  max-height: 90vh;


  background: #fff;


}


.ap-card--mobile {


  max-height: 100dvh;


}





/* ── Header ── */


.ap-header {


  display: flex;


  align-items: center;


  justify-content: space-between;


  border-bottom: 1px solid rgba(0, 0, 0, 0.08);


  flex-shrink: 0;


  background: #fff;


}


.ap-avatar :deep(svg),


.ap-avatar :deep(path) {


  fill: white;


  color: white;


}


.ap-title {


  font-size: 0.9rem;


  max-width: 340px;


}





/* ── Search ── */


.ap-search {


  flex-shrink: 0;


  background: #fff;


}





/* ── Tabs ── */


.ap-tabs {


  flex-shrink: 0;


}


.ap-tab {


  font-size: 0.8rem;


  min-width: 0;


  padding: 0 12px;


}





/* ── Content ── */


.ap-content {


  flex: 1;


  overflow-y: auto;


  min-height: 0;


  scrollbar-width: thin;


  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;


}


.ap-content::-webkit-scrollbar { width: 5px; }


.ap-content::-webkit-scrollbar-thumb {


  background: rgba(0, 0, 0, 0.15);


  border-radius: 4px;


}





/* ── Expansion panels ── */


.ap-panel {


  border: 1px solid rgba(0, 0, 0, 0.08) !important;


  background: #fff !important;


  overflow: hidden;


}


.ap-panel-title {


  min-height: 44px !important;


  background: #f8f9fa;


}


:deep(.v-expansion-panel-title__overlay) { display: none; }


:deep(.v-expansion-panel-text__wrapper) { padding: 0 !important; }





/* ── Fields ── */


.ap-fields {


  display: flex;


  flex-direction: column;


}


.ap-field-row {


  display: flex;


  flex-direction: column;


  padding: 8px 14px;


  border-bottom: 1px solid rgba(0, 0, 0, 0.05);


  transition: background 0.12s;


}


.ap-field-row:last-child { border-bottom: none; }


.ap-field-row:hover { background: rgba(21, 101, 192, 0.03); }





.ap-field-label {


  font-size: 0.68rem;


  font-weight: 600;


  color: #90a4ae;


  text-transform: uppercase;


  letter-spacing: 0.4px;


  margin-bottom: 3px;


}


.ap-field-value-wrap {


  display: flex;


  align-items: center;


  justify-content: space-between;


  gap: 4px;


}


.ap-field-value {


  font-size: 0.875rem;


  color: #263238;


  word-break: break-word;


  flex: 1;


}


.ap-field-value--empty {


  color: #b0bec5;


  font-style: italic;


}


.ap-copy-btn {


  opacity: 0;


  transition: opacity 0.15s;


  flex-shrink: 0;


}


.ap-field-row:hover .ap-copy-btn { opacity: 1; }





/* ── Empty state ── */


.ap-empty {


  display: flex;


  flex-direction: column;


  align-items: center;


  justify-content: center;


  padding: 48px 24px;


  text-align: center;


}





/* ── Mobile ── */


@media (max-width: 600px) {


  .ap-title { max-width: 200px; font-size: 0.85rem; }


  .ap-field-row { padding: 7px 12px; }


}


</style>


