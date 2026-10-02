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

        <div
          class="ap-header"
          :class="isMobile ? 'pa-3' : 'pa-4'"
        >

          <div
            class="d-flex align-center"
            style="gap: 12px; min-width: 0; flex: 1;"
          >

            <v-avatar
              size="40"
              color="primary"
              class="ap-avatar flex-shrink-0"
            >

              <v-icon
                size="20"
                color="white"
              >mdi-information-outline</v-icon>

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

          <div
            class="d-flex align-center"
            style="gap: 4px; flex-shrink: 0;"
          >

            <v-btn

              v-if="passportTarget"

              icon

              variant="text"

              size="small"

              color="success"

              aria-label="Скачать паспорт (Excel)"

              @click="downloadPassport"
            >

              <v-icon size="18">mdi-file-excel-box</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Скачать паспорт (Excel)</v-tooltip>

            </v-btn>

            <v-btn
              v-if="cardLineId && isLineObject"
              icon
              variant="text"
              size="small"
              color="error"
              aria-label="Анализ отключения: какие задвижки закрыть"
              @click="emit('open-outage-simulation', { lineId: cardLineId })"
            >
              <v-icon size="18">mdi-valve-closed</v-icon>
              <v-tooltip
                activator="parent"
                location="bottom"
              >Анализ отключения: какие задвижки закрыть</v-tooltip>
            </v-btn>

            <!-- Разворот меняет топологию: только в режиме редактирования сети -->
            <v-btn
              v-if="cardLineId && isLineObject && isEditTopologyMode"
              icon
              variant="text"
              size="small"
              color="primary"
              :loading="reversingLine"
              aria-label="Развернуть направление линии"
              @click="reverseLineDirection"
            >
              <v-icon size="18">mdi-swap-horizontal</v-icon>
              <v-tooltip
                activator="parent"
                location="bottom"
              >Развернуть направление линии</v-tooltip>
            </v-btn>

            <v-btn

              v-if="canOpenDefectJournal"

              icon

              variant="text"

              size="small"

              color="deep-orange-darken-2"

              aria-label="Журнал нарушений объекта"

              @click="openDefectJournal"
            >

              <v-icon size="18">mdi-alert-decagram-outline</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Журнал нарушений объекта</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenShurfJournal"

              icon

              variant="text"

              size="small"

              color="brown-darken-2"

              aria-label="Журнал шурфовок объекта"

              @click="openShurfJournal"
            >

              <v-icon size="18">mdi-shovel</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Журнал шурфовок объекта</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenInspectionJournal"

              icon

              variant="text"

              size="small"

              color="teal-darken-2"

              aria-label="Журнал осмотров объекта"

              @click="openInspectionJournal"
            >

              <v-icon size="18">mdi-clipboard-search-outline</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Журнал осмотров объекта</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenRepairJournal"

              icon

              variant="text"

              size="small"

              color="deep-purple-darken-2"

              aria-label="Журнал ремонтов объекта"

              @click="openRepairJournal"
            >

              <v-icon size="18">mdi-hammer-wrench</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Журнал ремонтов объекта</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenPressureTestJournal"

              icon

              variant="text"

              size="small"

              color="blue-darken-2"

              aria-label="Журнал опрессовок объекта"

              @click="openPressureTestJournal"
            >

              <v-icon size="18">mdi-gauge</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Журнал опрессовок объекта</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenTechnicalConditionJournal"

              icon

              variant="text"

              size="small"

              color="cyan-darken-3"

              aria-label="Технические условия объекта"

              @click="openTechnicalConditionJournal"
            >

              <v-icon size="18">mdi-file-certificate-outline</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Технические условия объекта</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenCorrosionIndicatorJournal"

              icon

              variant="text"

              size="small"

              color="orange-darken-3"

              aria-label="Индикаторы коррозии объекта"

              @click="openCorrosionIndicatorJournal"
            >

              <v-icon size="18">mdi-test-tube</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Индикаторы коррозии объекта</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenAlsekoJournal"

              icon

              variant="text"

              size="small"

              color="indigo-darken-2"

              aria-label="Объекты АЛСЕКО по адресу"

              @click="openAlsekoJournal"
            >

              <v-icon size="18">mdi-office-building-marker</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Объекты АЛСЕКО по адресу</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenElectricalNetworkJournal"

              icon

              variant="text"

              size="small"

              color="amber-darken-4"

              aria-label="Карточка объекта электросети"

              @click="openElectricalNetworkJournal"
            >

              <v-icon size="18">mdi-transmission-tower</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Карточка объекта электросети</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenHeatLossJournal"

              icon

              variant="text"

              size="small"

              color="deep-orange-darken-3"

              aria-label="Исходные данные тепловых потерь"

              @click="openHeatLossJournal"
            >

              <v-icon size="18">mdi-heat-wave</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Исходные данные тепловых потерь</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenTemperatureGraphJournal"

              icon

              variant="text"

              size="small"

              color="purple-darken-3"

              aria-label="Температурный график источника"

              @click="openTemperatureGraphJournal"
            >

              <v-icon size="18">mdi-chart-bell-curve-cumulative</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Температурный график источника</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenConsumerLoadDiagnostics"

              icon

              variant="text"

              size="small"

              color="teal-darken-3"

              aria-label="Диагностика нагрузки потребителя"

              @click="openConsumerLoadDiagnostics"
            >

              <v-icon size="18">mdi-home-lightning-bolt-outline</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Диагностика нагрузки потребителя</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenPumpEquipment"

              icon

              variant="text"

              size="small"

              color="blue-grey-darken-3"

              aria-label="Насосное оборудование и характеристики"

              @click="openPumpEquipment"
            >

              <v-icon size="18">mdi-pump</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Насосное оборудование и характеристики</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenNetworkArmatures"

              icon

              variant="text"

              size="small"

              color="deep-purple-darken-3"

              aria-label="Запорная и регулирующая арматура"

              @click="openNetworkArmatures"
            >

              <v-icon size="18">mdi-valve</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Запорная и регулирующая арматура</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenNetworkRegulators"

              icon

              variant="text"

              size="small"

              color="indigo-darken-3"

              aria-label="Сетевые регуляторы"

              @click="openNetworkRegulators"
            >

              <v-icon size="18">mdi-tune-vertical</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Сетевые регуляторы</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenNetworkBypasses"

              icon

              variant="text"

              size="small"

              color="cyan-darken-4"

              aria-label="Байпасы наружных теплопроводов"

              @click="openNetworkBypasses"
            >

              <v-icon size="18">mdi-pipe-valve</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Байпасы наружных теплопроводов</v-tooltip>

            </v-btn>

            <v-btn

              v-if="canOpenNetworkDiaphragms"

              icon

              variant="text"

              size="small"

              color="teal-darken-4"

              aria-label="Диафрагмы наружных теплопроводов"

              @click="openNetworkDiaphragms"
            >

              <v-icon size="18">mdi-circle-slice-8</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Диафрагмы наружных теплопроводов</v-tooltip>

            </v-btn>

            <v-btn

              v-if="propsData.id && (propsData.defectid || String(propsData.gistable || '').toLowerCase().includes('defect'))"

              icon

              variant="text"

              size="small"

              color="primary"

              aria-label="Карта повреждаемости (Word)"

              @click="downloadWordReport"
            >

              <v-icon size="18">mdi-file-word-box</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Карта повреждаемости (Word)</v-tooltip>

            </v-btn>

            <v-btn

              icon

              variant="text"

              size="small"

              color="grey-darken-1"

              :loading="copying"

              aria-label="Копировать всё"

              @click="copyToClipboard"
            >

              <v-icon size="18">mdi-content-copy</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
                aria-label="Копировать всё"
              >Копировать всё</v-tooltip>

            </v-btn>

            <v-btn
              v-if="historyTarget && authStore.canViewHistory"
              icon
              variant="text"
              size="small"
              color="grey-darken-1"
              aria-label="История правок объекта"
              @click="$emit('open-audit-history', historyTarget)"
            >
              <v-icon size="18">mdi-history</v-icon>
              <v-tooltip
                activator="parent"
                location="bottom"
              >История правок объекта</v-tooltip>
            </v-btn>

            <v-btn

              v-if="isEditTopologyMode"

              icon

              variant="text"

              size="small"

              color="error"

              :disabled="!cardObjectId"
              aria-label="Удалить объект"
              @click="$emit('delete-feature', cardObjectId!, cardVersion, { kind: cardObjectKind!, expectedSectionId: cardSectionId })"
            >

              <v-icon size="18">mdi-delete</v-icon>

              <v-tooltip
                activator="parent"
                location="bottom"
              >Удалить объект</v-tooltip>

            </v-btn>

            <v-btn
              icon
              variant="text"
              size="small"
              color="grey-darken-1"
              aria-label="Закрыть"
              @click="close"
            >

              <v-icon>mdi-close</v-icon>

            </v-btn>

          </div>

        </div>


        <v-divider />


        <!-- ── Поиск ── -->

        <div
          class="ap-search"
          :class="isMobile ? 'pa-3 pb-2' : 'pa-3 pb-2'"
        >

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

            <template
              v-if="search && totalFilteredCount !== totalAttributesCount"
              #append-inner
            >

              <v-chip
                size="x-small"
                color="primary"
                variant="tonal"
              >{{ totalFilteredCount }}</v-chip>

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

              <v-chip
                size="x-small"
                color="primary"
                variant="tonal"
                class="ml-1"
                style="pointer-events:none;"
              >

                {{ getTabFieldsCount(tab) }}

              </v-chip>

            </v-tab>

          </v-tabs>

          <v-divider />

        </template>


        <!-- ── Контент ── -->

        <div class="ap-content">
          <!-- Calculation Results Section -->
          <div
            v-if="propsData._isCalculationResult"
            class="pa-2"
          >
            <v-card
              variant="outlined"
              class="mb-2 border-primary bg-blue-grey-lighten-5"
            >
              <v-card-title class="text-subtitle-2 font-weight-bold text-primary py-2 px-3">
                <v-icon
                  size="small"
                  class="mr-1"
                >mdi-calculator</v-icon>
                Результаты расчета
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <v-list
                  density="compact"
                  class="bg-transparent"
                >
                  <v-list-item v-if="propsData.flow !== undefined">
                    <template #title><span class="text-caption text-medium-emphasis">Расход воды (т/ч)</span></template>
                    <template #append><span class="text-body-2 font-weight-medium">{{ propsData.flow?.toFixed(2) ?? '-' }}</span></template>
                  </v-list-item>
                  <v-list-item v-if="propsData.velocity !== undefined">
                    <template #title><span class="text-caption text-medium-emphasis">Скорость воды (м/с)</span></template>
                    <template #append><span class="text-body-2 font-weight-medium">{{ propsData.velocity?.toFixed(2) ?? '-' }}</span></template>
                  </v-list-item>
                  <v-list-item v-if="propsData.pressure_drop !== undefined">
                    <template #title><span class="text-caption text-medium-emphasis">Падение давления (м)</span></template>
                    <template #append><span class="text-body-2 font-weight-medium">{{ propsData.pressure_drop?.toFixed(2) ?? '-' }}</span></template>
                  </v-list-item>
                  <v-list-item v-if="propsData.specific_pressure_drop !== undefined">
                    <template #title><span class="text-caption text-medium-emphasis">Удельное падение давления (мм/м)</span></template>
                    <template #append><span class="text-body-2 font-weight-medium">{{ propsData.specific_pressure_drop?.toFixed(2) ?? '-' }}</span></template>
                  </v-list-item>
                  <v-list-item v-if="propsData.head_start !== undefined">
                    <template #title><span class="text-caption text-medium-emphasis">Напор в начале (м)</span></template>
                    <template #append><span class="text-body-2 font-weight-medium">{{ propsData.head_start?.toFixed(2) ?? '-' }}</span></template>
                  </v-list-item>
                  <v-list-item v-if="propsData.head_end !== undefined">
                    <template #title><span class="text-caption text-medium-emphasis">Напор в конце (м)</span></template>
                    <template #append><span class="text-body-2 font-weight-medium">{{ propsData.head_end?.toFixed(2) ?? '-' }}</span></template>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </div>

          <!-- Tabbed view -->

          <v-window
            v-if="hasTabsStructure"
            v-model="activeTab"
          >

            <v-window-item

              v-for="(tab, tabIdx) in tabsData"

              :key="tabIdx"

              :value="tabIdx"
            >

              <div
                v-if="getFilteredTabSections(tab).length > 0"
                class="pa-2"
              >

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

                      <div
                        class="d-flex align-center w-100"
                        style="gap: 8px;"
                      >

                        <v-icon
                          size="15"
                          color="primary"
                        >mdi-table-of-contents</v-icon>

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

                              aria-label="Копировать"

                              @click.stop="copyAttribute(field.key, field.value)"
                            >

                              <v-icon size="13">mdi-content-copy</v-icon>

                              <v-tooltip
                                activator="parent"
                                location="left"
                                aria-label="Копировать"
                              >Копировать</v-tooltip>

                            </v-btn>

                          </div>

                        </div>

                      </div>

                    </v-expansion-panel-text>

                  </v-expansion-panel>

                </v-expansion-panels>

              </div>

              <div
                v-else
                class="ap-empty"
              >

                <v-icon
                  size="40"
                  color="grey-lighten-2"
                >mdi-file-search-outline</v-icon>

                <div class="text-body-2 text-grey mt-2">{{ search ? 'Атрибуты не найдены' : 'Нет данных' }}</div>

              </div>

            </v-window-item>

          </v-window>


          <!-- Simple list (no tabs) -->

          <div
            v-else
            class="pa-2"
          >

            <div
              v-if="Object.keys(filteredAttributesList).length > 0"
              class="ap-fields pa-1"
            >

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

                    icon
                    size="x-small"
                    variant="text"
                    color="grey"

                    class="ap-copy-btn"

                    aria-label="Копировать"

                    @click.stop="copyAttribute(String(key), value)"
                  >

                    <v-icon size="13">mdi-content-copy</v-icon>

                    <v-tooltip
                      activator="parent"
                      location="left"
                      aria-label="Копировать"
                    >Копировать</v-tooltip>

                  </v-btn>

                </div>

              </div>

            </div>

            <div
              v-else
              class="ap-empty"
            >

              <v-icon
                size="40"
                color="grey-lighten-2"
              >mdi-file-search-outline</v-icon>

              <div class="text-body-2 text-grey mt-2">{{ search ? 'Не найдено' : 'Нет данных' }}</div>

            </div>

          </div>

        </div>

      </v-card>

    </v-dialog>


    <!-- Превью разворота участка (dry-run → подтверждение) -->
    <LazyReversePreviewDialog
      v-if="reversePreviewOpen"
      v-model="reversePreviewOpen"
      :line-id="reversePreviewLineId"
      :report="reversePreviewReport"
      :loading="reversePreviewLoading"
      :confirming="reversingLine"
      :error="reversePreviewError"
      @confirm="confirmReverse"
    />
    <v-snackbar
      v-model="showNotification"
      :timeout="notificationError ? 4000 : 2000"
      :color="notificationError ? 'error' : 'primary'"
      location="bottom"
      rounded="pill"
    >

      <div
        class="d-flex align-center"
        style="gap: 8px;"
      >

        <v-icon size="16">{{ notificationError ? 'mdi-alert-circle' : 'mdi-check-circle' }}</v-icon>

        {{ notificationMessage }}

      </div>

    </v-snackbar>

  </Teleport>

</template>


<script setup lang="ts">
import { formatApiError, formatApiErrorWith } from '~/utils/apiError'

import { ref, computed, watch } from 'vue'

import { useMobile } from '~/composables/useMobile'

import { useAttributeTabs, type TabData } from '~/composables/useAttributeTabs'

import { ApiError, fastApiService, type ReverseLineReport } from '~/services/fastApiService'
import { getSectionRowId, resolveCardObject, type CardObject } from '~/utils/networkFeature'
import { useAuthStore } from '~/stores/authStore'
import { useNotificationStore } from '~/stores/notificationStore'


const componentProps = withDefaults(defineProps<{

  isEditTopologyMode?: boolean

}>(), {

  isEditTopologyMode: false

})


const emit = defineEmits<{

  'delete-feature': [featureId: string | number, version?: string, meta?: { kind: 'line' | 'node'; expectedSectionId?: number | null }]
  'open-audit-history': [scope: { table: string; recordId: number }]

  'open-defect-journal': [scope: { lineId?: number; nodeId?: number; defectId?: number }]

  'open-shurf-journal': [scope: { lineId?: number; nodeId?: number; shurfId?: number }]

  'open-inspection-journal': [scope: { lineId?: number; nodeId?: number; inspectionId?: number }]

  'open-repair-journal': [scope: { lineId?: number; nodeId?: number; repairId?: number }]

  'open-outage-simulation': [scope: { lineId?: number; nodeId?: number }]

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

  'refresh-layers': []

}>()


const { isMobile } = useMobile()

const { getAttributeLabel, groupAttributesByTabs, getUncategorizedAttributes } = useAttributeTabs()


const visible = ref(false)

const attributes = ref<Record<string, any>>({})

const propsData = ref<Record<string, any>>({})

const search = ref('')

const copying = ref(false)

const showNotification = ref(false)

/** Снэкбар в стиле ошибки; сбрасывается при закрытии */

const notificationError = ref(false)

watch(showNotification, (v) => { if (!v) notificationError.value = false })

const notificationMessage = ref('')

const activeTab = ref(0)

const expandedSections = ref<Record<number, number[]>>({})


const tabsData = ref<TabData[]>([])

const uncategorizedAttributes = ref<Array<{ key: string; value: any; label: string }>>([])

const objectTitle = ref('')

const objectTabsData = ref<any[] | null>(null)

const objectNamesData = ref<Record<string, string> | null>(null)

const isEditTopologyMode = computed(() => componentProps.isEditTopologyMode)

// Вид объекта карточки (QA F11): слои GeoServer не несут gistable — таблицу узнаём по
// query-слою, `tab` слоя узлов и полям записи (utils/networkFeature.resolveCardObject)
const cardObject = computed<CardObject>(() => resolveCardObject(propsData.value))
const isNodeObject = computed(() => cardObject.value.network === 'node')

// Версия узла/участка на момент открытия карточки (оптимистичная блокировка):
// удаление и разворот применятся, только если объект с тех пор не меняли.
const cardVersion = ref<string | undefined>(undefined)
const loadCardVersion = async () => {
  cardVersion.value = undefined
  const id = cardObjectId.value
  if (!isEditTopologyMode.value || !id) return
  const kind = cardObjectKind.value === 'line' ? 'lines' : cardObjectKind.value === 'node' ? 'nodes' : null
  if (!kind) return
  try {
    const res = await fastApiService.getTopologyVersions({ [kind]: [id] })
    if (cardObjectId.value === id) cardVersion.value = res[kind]?.[String(id)]?.version
  } catch {
    // без версии сервер не проверяет конфликт — операция всё равно идёт под FOR UPDATE
  }
}
watch(() => [propsData.value.id, isEditTopologyMode.value], () => { void loadCardVersion() })

const isLineObject = computed(() => cardObject.value.network === 'line')

// id участка — linesobj.id (не heatpipesections.id из query-слоя GeoServer, QA F12/F54);
// null — участок не определён, действия по нему недоступны
const cardLineId = computed<number | null>(() => (isLineObject.value ? cardObject.value.networkId : null))
// heatpipesections.id карточки: сервер сверяет его с участком перед удалением/разворотом
const cardSectionId = computed<number | null>(() => getSectionRowId(propsData.value))
// Вид объекта для удаления из карточки: участок или узел (потребитель/источник/насосная — узел)
const cardObjectKind = computed<'line' | 'node' | null>(() => cardObject.value.network)
// linesobj.id / nodes.id объекта сети карточки
const cardObjectId = computed<number | null>(() => cardObject.value.networkId)
// nodes.id узла карточки (в т.ч. потребителя/источника/насосной)
const cardNodeId = computed<number | null>(() => (isNodeObject.value ? cardObject.value.networkId : null))
// id строки в таблице карточки (журналы дефектов, оборудование, справочники…)
const cardRowId = computed<number | null>(() => cardObject.value.rowId)
/** «История»: записи audit_log этой таблицы и этого id (триггеры пишут table_name в lower case) */
const authStore = useAuthStore()
const historyTarget = computed<{ table: string; recordId: number } | null>(() => {
  const { table, network, networkId, rowId } = cardObject.value
  // потребитель/источник с карты: история узла (строка роли может быть не определена)
  const target = network && table !== 'linesobj' && table !== 'nodes' && !rowId
    ? { table: 'nodes', recordId: networkId }
    : { table, recordId: rowId }
  return target.table && target.recordId ? { table: target.table, recordId: target.recordId } : null
})

/** «Паспорт Excel»: участок (linesobj.id) или узел (nodes.id), в т.ч. потребитель/источник/насосная */
const passportTarget = computed<{ table: 'linesobj' | 'nodes'; id: number } | null>(() => {
  const { network, networkId } = cardObject.value
  if (!network || !networkId) return null
  return { table: network === 'line' ? 'linesobj' : 'nodes', id: networkId }
})

/** Журналы по объекту сети (дефекты, шурфы, осмотры, ремонты, опрессовки, индикаторы коррозии) */
const networkJournalScope = computed<{ lineId: number } | { nodeId: number } | null>(() => {
  if (cardLineId.value) return { lineId: cardLineId.value }
  if (cardNodeId.value) return { nodeId: cardNodeId.value }
  return null
})

const cardTable = computed(() => cardObject.value.table)

const canOpenDefectJournal = computed(() => Boolean(networkJournalScope.value) || (Boolean(cardRowId.value) && cardTable.value.includes('defect')))

const canOpenShurfJournal = computed(() => Boolean(networkJournalScope.value) || (Boolean(cardRowId.value) && cardTable.value.includes('shurf')))

const canOpenInspectionJournal = computed(() => Boolean(networkJournalScope.value) || (
  Boolean(cardRowId.value) && (cardTable.value.includes('osmotr') || cardTable.value.includes('inspection'))
))

const canOpenRepairJournal = computed(() => Boolean(networkJournalScope.value) || (
  Boolean(cardRowId.value) && (cardTable.value.includes('remont') || cardTable.value.includes('repair'))
))

const canOpenPressureTestJournal = computed(() => Boolean(networkJournalScope.value) || (
  Boolean(cardRowId.value) && (cardTable.value.includes('opres') || cardTable.value.includes('pressure'))
))

const canOpenTechnicalConditionJournal = computed(() => {
  const table = cardTable.value
  return Boolean(cardRowId.value) && (
    table === 'zdaniya_tu' || table === 'tehnicheskie_usloviya' || table.includes('technical_condition')
  )
})

const canOpenCorrosionIndicatorJournal = computed(() => Boolean(networkJournalScope.value) || (
  Boolean(cardRowId.value) && (cardTable.value === 'indikator_korrozii' || cardTable.value === 'corrosionindicators')
))

const canOpenAlsekoJournal = computed(() => Boolean(cardRowId.value) && (cardTable.value === 'zdaniya_2' || cardTable.value === 'nagruzki'))

const electricalTableTypes = {
  istochnik_elektrosnabzheniya: 'source', liniya_elektroperedach: 'line',
  priemnik_elektrosnabzheniya: 'receiver', kabelnyy_kanal_es: 'channel',
  mufta: 'coupling', opora_es: 'support', gilza_es: 'sleeve'
} as const

const canOpenElectricalNetworkJournal = computed(() => Boolean(cardRowId.value) && cardTable.value in electricalTableTypes)

/** Источник тепла: heatsources.id (с карты — строка query-слоя), без неё журнал теплопотерь недоступен */
const cardHeatSourceId = computed<number | null>(() => (cardTable.value === 'heatsources' ? cardRowId.value : null))

const canOpenHeatLossJournal = computed(() => Boolean(cardHeatSourceId.value) || (Boolean(cardRowId.value) && cardTable.value === 'heatlosesmain'))

const canOpenTemperatureGraphJournal = computed(() => {
  if (cardHeatSourceId.value) return true
  // узел или источник без строки heatsources — поиск источника по узлу
  return Boolean(cardNodeId.value) && (cardTable.value === 'nodes' || cardTable.value === 'heatsources')
})

/** Диагностика нагрузки: потребитель (строка своей таблицы) или поиск по узлу */
const consumerLoadScope = computed<{ consumerType: 'generalized' | 'real'; consumerId: number } | { nodeId: number } | null>(() => {
  const table = cardTable.value
  if (table !== 'generalizedconsumers' && table !== 'realconsumers' && table !== 'nodes') return null
  if (table !== 'nodes' && cardRowId.value) {
    return { consumerType: table === 'generalizedconsumers' ? 'generalized' : 'real', consumerId: cardRowId.value }
  }
  return cardNodeId.value ? { nodeId: cardNodeId.value } : null
})

const canOpenConsumerLoadDiagnostics = computed(() => Boolean(consumerLoadScope.value))

const canOpenPumpEquipment = computed(() => Boolean(cardLineId.value) || (
  Boolean(cardRowId.value) && (cardTable.value === 'pumps' || cardTable.value === 'standardpumps')
))

const canOpenNetworkArmatures = computed(() => Boolean(cardLineId.value) || (
  Boolean(cardRowId.value) && ['dampers', 'regularmatures', 'standarddampers'].includes(cardTable.value)
))

const regulatorTables = {
  pressregulators: { regulatorType: 'pressure' }, consumptregulators: { regulatorType: 'flow' },
  pressdropregulators: { regulatorType: 'differential' }, standardpressregulators: { catalogType: 'pressure' },
  standardconsregulators: { catalogType: 'flow' }, standardpressdropregulators: { catalogType: 'differential' }
} as const

const canOpenNetworkRegulators = computed(() => Boolean(cardLineId.value) || (
  Boolean(cardRowId.value) && cardTable.value in regulatorTables
))

const canOpenNetworkBypasses = computed(() => Boolean(cardLineId.value) || (
  Boolean(cardRowId.value) && (cardTable.value === 'bypass' || cardTable.value === 'standardtubes')
))

const canOpenNetworkDiaphragms = computed(() => Boolean(cardLineId.value) || (Boolean(cardRowId.value) && cardTable.value === 'diaphragms'))


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

  } catch (e) {

    console.error('Copy error:', e)

    notificationMessage.value = 'Не удалось скопировать: браузер запретил доступ к буферу обмена'

    notificationError.value = true

    showNotification.value = true

  }

}


const copyToClipboard = async () => {

  copying.value = true

  try {

    const text = Object.entries(attributes.value)

      .map(([k, v]) => `${getAttributeLabel(k)}: ${v}`).join('\n')

    await navigator.clipboard.writeText(text)

    notificationMessage.value = `Скопировано ${totalAttributesCount.value} атрибутов`

    showNotification.value = true

  } catch (e) {

    // Буфер обмена запрещён (не https, нет разрешения) — сказать пользователю (QA F24)

    console.error('Copy error:', e)

    notificationMessage.value = 'Не удалось скопировать: браузер запретил доступ к буферу обмена'

    notificationError.value = true

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

  const target = passportTarget.value

  if (!target) return

  try {

    const { blob, filename } = await fastApiService.downloadObjectPassport(target.table, target.id)

    saveBlob(blob, filename)

    notificationMessage.value = `Паспорт «${filename}» сформирован`

    showNotification.value = true

  } catch (error: any) {

    notificationMessage.value = formatApiErrorWith('Ошибка формирования паспорта', error)

    showNotification.value = true

  }

}

const reversingLine = ref(false)

const reversePreviewOpen = ref(false)
const reversePreviewLoading = ref(false)
const reversePreviewError = ref<string | null>(null)
const reversePreviewReport = ref<ReverseLineReport | null>(null)
const reversePreviewLineId = ref<number | null>(null)
const reversePreviewSectionId = ref<number | null>(null)

/** Превью разворота: узлы, геометрия, оборудование; версия — та, что видела карточка */
const reverseLineDirection = async () => {
  const lineId = cardLineId.value
  if (!lineId) return
  reversePreviewLineId.value = lineId
  reversePreviewSectionId.value = cardSectionId.value
  reversePreviewReport.value = null
  reversePreviewError.value = null
  reversePreviewLoading.value = true
  reversePreviewOpen.value = true
  try {
    reversePreviewReport.value = await fastApiService.previewReverseLine(lineId, reversePreviewSectionId.value)
  } catch (error: any) {
    reversePreviewError.value = formatApiError(error, 'Не удалось получить превью')
  } finally {
    reversePreviewLoading.value = false
  }
}

const confirmReverse = async ({ acceptDirectionChange, includePair }: { acceptDirectionChange: boolean; includePair: boolean }) => {
  const lineId = reversePreviewLineId.value
  if (!lineId) return
  const pairId = includePair ? reversePreviewReport.value?.pair?.line_id ?? null : null
  reversingLine.value = true
  try {
    const res = await fastApiService.reverseLine(lineId, {
      // версия из превью; если превью не вернуло — версия карточки
      expectedVersion: reversePreviewReport.value?.versions?.[`line:${lineId}`] ?? cardVersion.value,
      acceptDirectionChange,
      // парная труба из превью разворачивается вместе (как GidWidget::swap в десктопе)
      includePair,
      pairLineId: pairId,
      pairVersion: pairId ? reversePreviewReport.value?.versions?.[`line:${pairId}`] : undefined,
      expectedSectionId: reversePreviewSectionId.value,
    })
    propsData.value = { ...propsData.value, nodeid1: res.nodeid1, nodeid2: res.nodeid2 }
    cardVersion.value = res.versions?.[`line:${lineId}`]
    reversePreviewOpen.value = false
    const pairText = res.pair_line_id ? ` вместе с парной трубой ${res.pair_line_id}` : ''
    notificationMessage.value = `Направление участка ${lineId}${pairText} изменено (узлы ${res.nodeid1} → ${res.nodeid2})`
    showNotification.value = true
    emit('refresh-layers')
  } catch (error: any) {
    reversePreviewOpen.value = false
    if (error instanceof ApiError && error.isVersionConflict) {
      // Участок изменён другим пользователем: перезагрузить слои и версию, открыть превью заново
      useNotificationStore().showConflict(error.userMessage, async () => {
        emit('refresh-layers')
        await loadCardVersion()
        await reverseLineDirection()
      })
    } else {
      notificationMessage.value = formatApiError(error, 'Не удалось развернуть участок')
      showNotification.value = true
    }
  } finally {
    reversingLine.value = false
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

    notificationMessage.value = formatApiErrorWith('Ошибка формирования отчёта', error)

    showNotification.value = true

  }

}


const openDefectJournal = () => {
  const scope = networkJournalScope.value
  if (scope) emit('open-defect-journal', scope)
  else if (cardRowId.value && cardTable.value.includes('defect')) {
    emit('open-defect-journal', { defectId: Number(propsData.value.defectid || cardRowId.value) })
  }
}


const openShurfJournal = () => {
  const scope = networkJournalScope.value
  if (scope) emit('open-shurf-journal', scope)
  else if (cardRowId.value && cardTable.value.includes('shurf')) {
    emit('open-shurf-journal', { shurfId: Number(propsData.value.shurfid || cardRowId.value) })
  }
}


const openInspectionJournal = () => {
  const scope = networkJournalScope.value
  const table = cardTable.value
  if (scope) emit('open-inspection-journal', scope)
  else if (cardRowId.value && (table.includes('osmotr') || table.includes('inspection'))) {
    emit('open-inspection-journal', { inspectionId: Number(propsData.value.osmotrid || cardRowId.value) })
  }
}


const openRepairJournal = () => {
  const scope = networkJournalScope.value
  const table = cardTable.value
  if (scope) emit('open-repair-journal', scope)
  else if (cardRowId.value && (table.includes('remont') || table.includes('repair'))) {
    emit('open-repair-journal', { repairId: Number(propsData.value.remontid || cardRowId.value) })
  }
}


const openPressureTestJournal = () => {
  const scope = networkJournalScope.value
  const table = cardTable.value
  if (scope) emit('open-pressure-test-journal', scope)
  else if (cardRowId.value && (table.includes('opres') || table.includes('pressure'))) {
    emit('open-pressure-test-journal', { testId: Number(propsData.value.opresid || cardRowId.value) })
  }
}


const openTechnicalConditionJournal = () => {
  const table = cardTable.value
  const id = cardRowId.value
  if (!id) return
  if (table === 'zdaniya_tu') emit('open-technical-condition-journal', { buildingId: id })
  else if (table === 'tehnicheskie_usloviya' || table.includes('technical_condition')) {
    emit('open-technical-condition-journal', { conditionId: id })
  }
}


const openCorrosionIndicatorJournal = () => {
  const scope = networkJournalScope.value
  const table = cardTable.value
  if (scope) emit('open-corrosion-indicator-journal', scope)
  else if (cardRowId.value && (table === 'indikator_korrozii' || table === 'corrosionindicators')) {
    emit('open-corrosion-indicator-journal', { indicatorId: cardRowId.value })
  }
}


const openAlsekoJournal = () => {
  const table = cardTable.value
  const id = cardRowId.value
  if (!id) return
  if (table === 'zdaniya_2') emit('open-alseko-journal', { buildingId: id })
  else if (table === 'nagruzki') emit('open-alseko-journal', { loadId: id })
}


const openElectricalNetworkJournal = () => {
  const objectType = electricalTableTypes[cardTable.value as keyof typeof electricalTableTypes]
  const id = cardRowId.value
  if (!objectType || !id) return
  emit('open-electrical-network-journal', { objectType, objectId: id })
}


const openHeatLossJournal = () => {
  if (cardHeatSourceId.value) emit('open-heat-loss-journal', { sourceId: cardHeatSourceId.value })
  else if (cardRowId.value && cardTable.value === 'heatlosesmain') emit('open-heat-loss-journal', { seasonId: cardRowId.value })
}


const openTemperatureGraphJournal = () => {
  if (cardHeatSourceId.value) emit('open-temperature-graph-journal', { sourceId: cardHeatSourceId.value })
  else if (cardNodeId.value) emit('open-temperature-graph-journal', { nodeId: cardNodeId.value })
}


const openConsumerLoadDiagnostics = () => {
  const scope = consumerLoadScope.value
  if (scope) emit('open-consumer-load-diagnostics', scope)
}


const openPumpEquipment = () => {
  const table = cardTable.value
  const id = cardRowId.value
  if (cardLineId.value) emit('open-pump-equipment', { lineId: cardLineId.value })
  else if (!id) return
  else if (table === 'pumps') emit('open-pump-equipment', { pumpId: id })
  else if (table === 'standardpumps') emit('open-pump-equipment', { standardPumpId: id })
}


const openNetworkArmatures = () => {
  const table = cardTable.value
  const id = cardRowId.value
  if (cardLineId.value) emit('open-network-armatures', { lineId: cardLineId.value })
  else if (!id) return
  else if (table === 'dampers') emit('open-network-armatures', { equipmentType: 'damper', armatureId: id })
  else if (table === 'regularmatures') emit('open-network-armatures', { equipmentType: 'regulating', armatureId: id })
  else if (table === 'standarddampers') emit('open-network-armatures', { standardId: id })
}


const openNetworkRegulators = () => {
  const id = cardRowId.value
  if (cardLineId.value) return emit('open-network-regulators', { lineId: cardLineId.value })
  const kind = regulatorTables[cardTable.value as keyof typeof regulatorTables]
  if (!kind || !id) return
  if ('regulatorType' in kind) emit('open-network-regulators', { regulatorType: kind.regulatorType, regulatorId: id })
  else emit('open-network-regulators', { catalogType: kind.catalogType, catalogId: id })
}


const openNetworkBypasses = () => {
  const table = cardTable.value
  const id = cardRowId.value
  if (cardLineId.value) emit('open-network-bypasses', { lineId: cardLineId.value })
  else if (!id) return
  else if (table === 'bypass') emit('open-network-bypasses', { bypassId: id })
  else if (table === 'standardtubes') emit('open-network-bypasses', { standardTubeId: id })
}


const openNetworkDiaphragms = () => {
  if (cardLineId.value) emit('open-network-diaphragms', { lineId: cardLineId.value })
  else if (cardRowId.value && cardTable.value === 'diaphragms') emit('open-network-diaphragms', { diaphragmId: cardRowId.value })
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


