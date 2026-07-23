<template>
  <v-sheet
    v-if="isVisible"
    class="ml-4 pa-1"
  >
    <v-expansion-panels
      v-model="expandedPanels"
      multiple
    >
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon
            start
            icon="mdi-format-list-text"
            size="small"
          />
          Выбор атрибутов
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-skeleton-loader
            v-if="loading"
            type="list-item-two-line"
            width="100%"
          />
          <template v-else>
            <div
              v-if="!availableAttributes.length"
              class="text-caption pa-2"
            >
              Нет доступных атрибутов
            </div>
            <v-list
              v-else
              density="compact"
              class="pa-0"
            >
              <v-list-item
                v-for="attr in availableAttributes"
                :key="attr"
                class="pa-0"
              >
                <v-checkbox
                  v-model="selectedAttrs"
                  :label="formatAttributeName(attr)"
                  :value="attr"
                  density="compact"
                  hide-details
                  @update:model-value="() => handleAttributeChange()"
                />
              </v-list-item>
            </v-list>
          </template>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-sheet>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useLayerStore } from '~/stores/layerStore';
import { useTranslations } from '~/composables/useTranslations';
import type { LayerConfig } from '~/types';

// Props
const props = defineProps<{
  layer: LayerConfig;
}>();

// Store
const layerStore = useLayerStore();
const { loadTranslations, getCachedRussianName } = useTranslations();

// State
const expandedPanels = ref<number[]>([0]);
const loading = ref(false);
const selectedAttrs = ref<string[]>([]);
const availableAttributes = ref<string[]>([]);

// Computed
const isVisible = computed(() => 
  layerStore.visibleGeoServerLayers.includes(props.layer.layerId)
);

// Methods
const formatAttributeName = (attr: string): string => {
  // Пытаемся получить русское название из кэша
  const russianName = getCachedRussianName(attr);
  if (russianName !== attr) {
    return russianName;
  }
  
  // Фолбэк к стандартному форматированию
  return attr
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const loadAttributes = async (): Promise<void> => {
  if (!isVisible.value || !process.client) return;
  
  loading.value = true;
  try {
    const attributes = await layerStore.getPbfAttributes(props.layer);
    availableAttributes.value = attributes;
    
    // Предзагружаем переводы для атрибутов
    if (attributes.length > 0) {
      await loadTranslations(attributes);
    }
    
    if (!selectedAttrs.value.length && attributes.length) {
      selectedAttrs.value = attributes.slice(0, 3);
      handleAttributeChange();
    }
  } catch (error) {
    console.error('Error loading attributes:', error);
  } finally {
    loading.value = false;
  }
};

const handleAttributeChange = (): void => {
  if (process.client) {
    layerStore.updateLayerAttributes(props.layer.layerId, selectedAttrs.value);
  }
};

// Watchers
watch(isVisible, (newValue) => {
  if (newValue && process.client) {
    loadAttributes();
  }
}, { immediate: true });

// Lifecycle
onMounted(() => {
  if (!process.client) return;
  
  // Загрузка сохраненных настроек
  const savedAttrs = layerStore.layerAttributes[props.layer.layerId];
  if (savedAttrs?.length) {
    selectedAttrs.value = savedAttrs;
  }

});
</script>

<style lang="scss" scoped>
.v-expansion-panels {
  :deep(.v-expansion-panel-title) {
    min-height: 40px;
    padding: 8px 16px;
    
    .v-icon {
      margin-right: 8px;
      color: rgba(0, 0, 0, 0.6);
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .v-expansion-panels {
    :deep(.v-expansion-panel-title) {
      min-height: 36px;
      padding: 6px 12px;
    }
  }
}
</style>
