<template>
  <client-only>
    <v-navigation-drawer
      v-model="drawer"
      location="right"
      :width="drawerWidth"
      temporary
      touchless
      class="object-details-drawer"
    >
      <div class="details-shell">

        <!-- ── Шапка ── -->
        <div class="details-header">
          <div class="d-flex align-center" style="gap: 12px; min-width: 0; flex: 1;">
            <v-avatar size="40" color="primary" class="details-avatar flex-shrink-0">
              <v-icon size="20">{{ objectIcon }}</v-icon>
            </v-avatar>
            <div style="min-width: 0;">
              <div class="text-subtitle-2 font-weight-bold text-truncate details-title">
                {{ objectTitle }}
              </div>
              <div class="text-caption text-medium-emphasis">Информация об объекте</div>
            </div>
          </div>
          <v-btn
            icon
            variant="text"
            size="small"
            color="grey-darken-1"
            class="flex-shrink-0"
            @click="drawer = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>

        <!-- ── Табы (если больше одного) ── -->
        <template v-if="displayTabs.length > 1">
          <v-tabs
            v-model="activeTab"
            color="primary"
            density="compact"
            bg-color="white"
            class="details-tabs"
          >
            <v-tab
              v-for="tab in displayTabs"
              :key="tab.title"
              :value="tab.title"
              density="compact"
            >
              {{ tab.title }}
            </v-tab>
          </v-tabs>
          <v-divider />
        </template>

        <!-- ── Контент ── -->
        <div class="details-content">
          <!-- Нет данных -->
          <div
            v-if="!displayTabs.length"
            class="empty-state"
          >
            <v-icon size="48" color="grey-lighten-2">mdi-information-off-outline</v-icon>
            <div class="text-body-2 text-grey mt-3">Нет данных для отображения</div>
          </div>

          <v-window
            v-else
            v-model="activeTab"
          >
            <v-window-item
              v-for="tab in displayTabs"
              :key="tab.title"
              :value="tab.title"
            >
              <v-expansion-panels
                v-model="activePanels"
                multiple
                flat
                class="pa-2"
              >
                <v-expansion-panel
                  v-for="subsection in tab.subsections"
                  :key="subsection.title"
                  class="subsection-panel mb-2"
                  elevation="0"
                  rounded="lg"
                >
                  <v-expansion-panel-title class="subsection-title px-3 py-2">
                    <div class="d-flex align-center w-100" style="gap: 8px;">
                      <v-icon size="15" color="primary">mdi-table-of-contents</v-icon>
                      <span class="text-body-2 font-weight-semibold">{{ subsection.title }}</span>
                      <v-chip
                        size="x-small"
                        color="primary"
                        variant="tonal"
                        class="ms-auto"
                        style="pointer-events: none;"
                      >
                        {{ subsection.fields.length }}
                      </v-chip>
                    </div>
                  </v-expansion-panel-title>

                  <v-expansion-panel-text>
                    <div class="fields-list">
                      <div
                        v-for="field in subsection.fields"
                        :key="field.field"
                        class="field-row"
                      >
                        <span class="field-label">{{ field.label }}</span>
                        <div class="field-value-wrap">
                          <span
                            class="field-value"
                            :class="{ 'no-value': !hasValue(field.value) }"
                          >
                            {{ hasValue(field.value) ? field.value : '—' }}
                          </span>
                          <v-btn
                            v-if="hasValue(field.value)"
                            icon
                            size="x-small"
                            variant="text"
                            color="grey"
                            class="copy-btn"
                            @click.stop="copyValue(String(field.value))"
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
            </v-window-item>
          </v-window>
        </div>

        <!-- ── Нижняя панель ── -->
        <div class="details-footer">
          <v-btn
            variant="tonal"
            color="primary"
            size="small"
            prepend-icon="mdi-content-copy"
            @click="copyAllFields"
          >
            Копировать всё
          </v-btn>
          <v-btn
            variant="text"
            color="grey-darken-1"
            size="small"
            prepend-icon="mdi-close"
            @click="drawer = false"
          >
            Закрыть
          </v-btn>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Уведомление о копировании -->
    <v-snackbar
      v-model="snackbar"
      :timeout="1800"
      color="success"
      location="bottom"
      rounded="pill"
    >
      <div class="d-flex align-center" style="gap: 8px;">
        <v-icon size="16">mdi-check-circle</v-icon>
        {{ snackbarText }}
      </div>
    </v-snackbar>
  </client-only>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDisplay } from 'vuetify';
import type { FeatureData } from '~/types';

const props = defineProps<{
  featureData: FeatureData | null;
}>();

const { mobile } = useDisplay();

const drawer      = ref(false);
const activeTab   = ref<string | null>(null);
const activePanels = ref<number[]>([]);
const snackbar    = ref(false);
const snackbarText = ref('');

const drawerWidth = computed(() => {
  if (mobile.value) return '100%';
  return 400;
});

// Вычисляем заголовок из свойств объекта
const objectTitle = computed(() => {
  const p = props.featureData?.properties || {};
  return (
    p.name || p.NAME || p.displayName ||
    p.code2 || p.code || p.title ||
    'Объект'
  );
});

// Иконка по типу геометрии
const objectIcon = computed(() => {
  const geom = (props.featureData as any)?.geometry?.type;
  if (geom === 'Point' || geom === 'MultiPoint')             return 'mdi-map-marker';
  if (geom === 'LineString' || geom === 'MultiLineString')   return 'mdi-vector-polyline';
  if (geom === 'Polygon' || geom === 'MultiPolygon')         return 'mdi-vector-polygon';
  return 'mdi-information-outline';
});

const displayTabs = computed(() => {
  if (props.featureData?.data?.tabs) {
    return props.featureData.data.tabs;
  }

  if (props.featureData?.properties) {
    return [{
      title: 'Свойства',
      subsections: [{
        title: 'Атрибуты объекта',
        fields: Object.entries(props.featureData.properties)
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value], index) => ({
            field: key,
            label: key,
            value,
            type: 'text',
            id: index,
          }))
      }]
    }];
  }

  return [];
});

const hasValue = (v: unknown) => v !== null && v !== undefined && v !== '';

const copyValue = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    snackbarText.value = 'Значение скопировано';
    snackbar.value = true;
  } catch {
    snackbarText.value = 'Не удалось скопировать';
    snackbar.value = true;
  }
};

const copyAllFields = async () => {
  const tab = displayTabs.value.find((t: { title: string }) => t.title === activeTab.value) || displayTabs.value[0];
  if (!tab) return;

  const lines: string[] = [];
  for (const section of tab.subsections) {
    lines.push(`=== ${section.title} ===`);
    for (const field of section.fields) {
      if (hasValue(field.value)) lines.push(`${field.label}: ${field.value}`);
    }
  }

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    snackbarText.value = 'Все поля скопированы';
    snackbar.value = true;
  } catch {
    snackbarText.value = 'Не удалось скопировать';
    snackbar.value = true;
  }
};

watch(() => props.featureData, (newVal: typeof props.featureData) => {
  drawer.value = !!newVal;
  if (newVal) {
    activeTab.value = displayTabs.value[0]?.title || null;
    activePanels.value = displayTabs.value[0]?.subsections
      ? Array.from({ length: displayTabs.value[0].subsections.length }, (_, i) => i)
      : [];
  }
}, { immediate: true });
</script>

<style scoped>
/* ── Оболочка ── */
.details-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

/* ── Шапка ── */
.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  background: #fff;
}

/* Белая иконка в аватаре */
.details-avatar :deep(svg),
.details-avatar :deep(path) {
  fill: white;
  color: white;
}

.details-title {
  font-size: 0.9rem;
  max-width: 220px;
}

/* ── Табы ── */
.details-tabs {
  flex-shrink: 0;
}

/* ── Контент ── */
.details-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

/* ── Секции (expansion panels) ── */
.subsection-panel {
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  background: #fff !important;
  overflow: hidden;
}

.subsection-title {
  min-height: 44px !important;
  background: #f8f9fa;
}

:deep(.v-expansion-panel-title__overlay) {
  display: none;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0 !important;
}

/* ── Список полей ── */
.fields-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.field-row {
  display: flex;
  flex-direction: column;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: background 0.12s;
}

.field-row:last-child {
  border-bottom: none;
}

.field-row:hover {
  background: rgba(21, 101, 192, 0.03);
}

.field-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #90a4ae;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 3px;
}

.field-value-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.field-value {
  font-size: 0.875rem;
  color: #263238;
  word-break: break-word;
  flex: 1;
}

.field-value.no-value {
  color: #b0bec5;
  font-style: italic;
}

.copy-btn {
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.field-row:hover .copy-btn {
  opacity: 1;
}

/* ── Нижняя панель ── */
.details-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  background: #f8f9fa;
}

/* Мобильная адаптация */
@media (max-width: 600px) {
  .details-title {
    max-width: 180px;
    font-size: 0.85rem;
  }

  .details-header {
    padding: 10px 12px;
  }

  .field-row {
    padding: 7px 12px;
  }

  .details-footer {
    padding: 8px 12px;
  }
}
</style>
