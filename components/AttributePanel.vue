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

const { isMobile } = useMobile()
const { getAttributeLabel, groupAttributesByTabs, getUncategorizedAttributes } = useAttributeTabs()

const visible = ref(false)
const attributes = ref<Record<string, any>>({})
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
