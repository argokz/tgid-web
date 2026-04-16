<template>
  <client-only>
    <div class="layer-control-wrapper">
      <!-- Кнопка открытия панели -->
      <v-btn
        class="layer-control-button"
        color="primary"
        variant="elevated"
        size="large"
        rounded="circle"
        @click="drawer = !drawer"
      >
        <v-icon size="large">
          mdiLayers
        </v-icon>
      </v-btn>

      <!-- Панель слоев -->
      <div class="layer-control-panel">
        <v-navigation-drawer
          v-model="drawer"
          location="right"
          :width="mobile ? '100%' : 320"
          temporary
          class="layer-drawer"
        >
          <!-- Заголовок -->
          <v-toolbar
            density="compact"
            color="primary"
          >
            <v-toolbar-title class="text-subtitle-2">
              Управление слоями
            </v-toolbar-title>
            <template #append>
              <v-btn
                icon
                size="small"
                @click="drawer = false"
              >
                <v-icon>mdiClose</v-icon>
              </v-btn>
            </template>
          </v-toolbar>

          <!-- Содержимое -->
          <v-container class="pa-2">
            <!-- Базовые слои -->
            <v-expansion-panels
              v-model="expandedPanels"
              multiple
            >
              <v-expansion-panel>
                <v-expansion-panel-title class="text-subtitle-2 py-1">
                  <v-icon
                    start
                    size="small"
                  >
                    mdiMap
                  </v-icon>
                  Базовая карта
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pa-2">
                  <v-radio-group
                    v-model="selectedBaseLayer"
                    density="compact"
                    hide-details
                    @update:model-value="updateBaseLayer"
                  >
                    <v-radio
                      v-for="layer in baseLayers"
                      :key="layer.id"
                      :label="layer.label"
                      :value="layer.id"
                      density="compact"
                    />
                  </v-radio-group>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Слои GeoServer -->
              <v-expansion-panel>
                <v-expansion-panel-title class="text-subtitle-2 py-1">
                  <v-icon
                    start
                    size="small"
                  >
                    mdiLayers
                  </v-icon>
                  Тематические слои
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pa-0">
                  <v-list
                    density="compact"
                    class="layer-list pa-0"
                  >
                    <v-list-item>
                      <v-btn 
                        variant="text" 
                        size="small" 
                        color="error"
                        prepend-icon="mdiEyeOffOutline"
                        class="mt-1 mb-2"
                        @click="hideAllLayers"
                      >
                        Скрыть все слои
                      </v-btn>
                      <v-btn 
                        variant="text" 
                        size="small" 
                        color="primary"
                        prepend-icon="mdiSort"
                        class="mt-1 mb-2 ml-2"
                        @click="openLayerOrderDialog"
                      >
                        Настроить порядок слоев
                      </v-btn>
                    </v-list-item>
                    <template v-if="geoServerLayers && geoServerLayers.length">
                      <v-list-item
                        v-for="layer in sortedVisibleLayers"
                        :key="layer.layerId"
                        :class="{ 'layer-active': isLayerVisible(layer.layerId) }"
                        class="layer-item"
                      >
                        <div class="d-flex flex-column w-100">
                          <div class="d-flex align-center">
                            <v-checkbox
                              :model-value="isLayerVisible(layer.layerId)"
                              hide-details
                              density="compact"
                              class="layer-checkbox ma-0 pa-0"
                              @update:model-value="() => toggleLayer(layer)"
                            />
                            <v-tooltip :text="layer.displayName">
                              <template #activator="{ props }">
                                <span
                                  v-bind="props"
                                  class="text-body-2 text-truncate layer-title"
                                >{{ layer.displayName }}</span>
                              </template>
                            </v-tooltip>
                            <v-spacer />
                            <v-btn-toggle
                              :model-value="layer.renderFormat || 'mvt'"
                              density="compact"
                              class="ml-2 format-toggle"
                              @update:model-value="(val) => val && layerStore.changeLayerFormat(layer.layerId, val)"
                            >
                              <v-btn value="mvt" size="x-small" class="px-1 text-caption">MVT</v-btn>
                              <v-btn value="wms" size="x-small" class="px-1 text-caption">WMS</v-btn>
                            </v-btn-toggle>
                            <v-btn
                              icon
                              size="x-small"
                              variant="text"
                              :color="layerStore.isLayerCachingEnabled(layer.layerId) ? 'success' : 'grey'"
                              class="ml-1"
                              @click.stop="layerStore.toggleLayerCaching(layer.layerId)"
                            >
                              <v-icon size="small">
                                {{ layerStore.isLayerCachingEnabled(layer.layerId) ? 'mdiDatabaseCheck' : 'mdiDatabaseOff' }}
                              </v-icon>
                              <v-tooltip
                                activator="parent"
                                location="top"
                                :aria-label="layerStore.isLayerCachingEnabled(layer.layerId) ? 'Кэширование включено' : 'Кэширование выключено'"
                              >
                                {{ layerStore.isLayerCachingEnabled(layer.layerId) ? 'Кэширование включено' : 'Кэширование выключено' }}
                              </v-tooltip>
                            </v-btn>
                          </div>

                          <!-- Компонент настройки слоя -->
                          <client-only>
                            <LayerAttributeAndLabelManager
                              v-if="isLayerVisible(layer.layerId)"
                              :layer="{
                                ...layer,
                                style: layer.style || {},
                                fragmentFilter: layer.fragmentFilter || []
                              }"
                              class="mt-2 mb-1"
                            />
                          </client-only>
                        </div>
                      </v-list-item>
                    </template>
                    
                    <v-divider
                      v-if="geoServerLayers.length && wmsLayers.length"
                      class="my-2"
                    />

                    <template v-if="wmsLayers && wmsLayers.length">
                      <v-list-subheader class="pa-1 text-caption text-medium-emphasis">
                        Слои WMS (из конфигурации)
                      </v-list-subheader>
                      <v-list-item
                        v-for="layer in wmsLayers"
                        :key="layer.id"
                        :class="{ 'layer-active': isWmsLayerVisible(layer.id) }"
                        class="layer-item"
                      >
                        <div class="d-flex flex-column w-100">
                          <div class="d-flex align-center">
                            <v-checkbox
                              :model-value="isWmsLayerVisible(layer.id)"
                              hide-details
                              density="compact"
                              class="layer-checkbox ma-0 pa-0"
                              @update:model-value="toggleWmsLayer(layer.id)"
                            />
                            <v-tooltip :text="layer.name">
                              <template #activator="{ props }">
                                <span
                                  v-bind="props"
                                  class="text-body-2 text-truncate layer-title"
                                >{{ layer.name }} (WMS)</span>
                              </template>
                            </v-tooltip>
                          </div>
                        </div>
                      </v-list-item>
                    </template>

                    <v-list-item v-if="!geoServerLayers.length && !wmsLayers.length">
                      <v-list-item-title class="text-caption">
                        Нет доступных слоев
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Фрагменты -->
              <v-expansion-panel>
                <v-expansion-panel-title class="text-subtitle-2 py-1">
                  <v-icon
                    start
                    size="small"
                  >
                    mdiPuzzle
                  </v-icon>
                  Фрагменты
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pa-2">
                  <FragmentList />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-container>
        </v-navigation-drawer>
      </div>

      <!-- Диалоговое окно для настройки порядка слоев -->
      <v-dialog
        v-model="layerOrderDialog"
        max-width="500px"
      >
        <v-card>
          <v-card-title class="text-h6">
            Настройка порядка слоев
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="(layer, index) in orderedLayers"
                :key="layer.layerId"
                class="draggable-item"
                draggable="true"
                @dragstart="startDrag($event, index)"
                @dragover="allowDrop($event)"
                @drop="drop($event, index)"
              >
                <v-icon
                  small
                  class="drag-handle"
                >
                  mdiMenu
                </v-icon>
                <span class="ml-2">{{ layer.displayName }}</span>
              </v-list-item>
            </v-list>
            <p class="text-caption mt-2">
              Перетаскивайте слои, чтобы изменить их порядок. Слои выше в списке отображаются поверх других.
            </p>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="grey"
              variant="text"
              @click="layerOrderDialog = false"
            >
              Отмена
            </v-btn>
            <v-btn
              color="primary"
              variant="text"
              @click="saveLayerOrder"
            >
              Сохранить
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </client-only>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useMapStore } from '~/stores/mapStore';
import { useLayerStore } from '~/stores/layerStore';
import type { ExtendedLayerConfig } from '~/types';
import LayerAttributeAndLabelManager from './LayerAttributeAndLabelManager.vue';
import FragmentList from './FragmentList.vue';

// Store
const mapStore = useMapStore();
const layerStore = useLayerStore();
const { mobile } = useDisplay();

// State
const drawer = ref(false);
const expandedPanels = ref<number[]>([0, 1, 2]); // По умолчанию все панели развернуты
const layerOrderDialog = ref(false);
const orderedLayers = ref<ExtendedLayerConfig[]>([]);

// Computed
const baseLayers = computed(() => mapStore.baseLayers || []);
const geoServerLayers = computed(() => layerStore.geoServerLayers || []);
const wmsLayers = computed(() => layerStore.getWmsLayers || []);

const selectedBaseLayer = computed({
  get: () => mapStore.selectedBaseLayer,
  set: (value: string) => {
    if (value) {
      mapStore.updateBaseLayer(value);
    }
  }
});
const sortedVisibleLayers = computed(() => {
  return [...geoServerLayers.value].sort((a, b) => {
    // Убывающий порядок: слой с большим zIndex отображается выше в списке и выше на карте
    const aZIndex = a.zIndex !== undefined ? a.zIndex : 0;
    const bZIndex = b.zIndex !== undefined ? b.zIndex : 0;
    return bZIndex - aZIndex;
  });
});

// Methods
const isLayerVisible = (layerId: string): boolean => {
  return layerStore.visibleGeoServerLayers.includes(layerId);
};

const isWmsLayerVisible = (layerId: string): boolean => {
  return layerStore.visibleWmsLayers.includes(layerId);
};

const toggleWmsLayer = (layerId: string) => {
  layerStore.toggleWmsLayer(layerId)
};

const toggleLayer = async (layer: ExtendedLayerConfig | string) => {
  if (!mapStore.map) {
    console.warn('Map not initialized');
    return;
  }
  try {
    layerStore.toggleGeoServerLayer(layer);
  } catch (error) {
    console.error('Error toggling layer:', error);
  }
};

const updateBaseLayer = (value: string | null): void => {
  if (value) {
    mapStore.updateBaseLayer(value);
  }
};

const hideAllLayers = () => {
  layerStore.visibleGeoServerLayers = [];
  layerStore.saveVisibleLayers();
  
  // Скрываем все сублои на карте
  if (mapStore.map) {
    layerStore.geoServerLayers.forEach(layer => {
      const subIds = layerStore.getLayerIdsOnMap(layer.layerId);
      const idsToHide = subIds.length > 0 ? subIds : [layer.layerId];
      for (const subId of idsToHide) {
        if (mapStore.map!.getLayer(subId)) {
          mapStore.map!.setLayoutProperty(subId, 'visibility', 'none');
        }
      }
    });
  }
};

const startDrag = (event: DragEvent, index: number) => {
  event.dataTransfer!.setData('text/plain', index.toString());
};

const allowDrop = (event: DragEvent) => {
  event.preventDefault();
};

const drop = (event: DragEvent, dropIndex: number) => {
  event.preventDefault();
  const dragIndex = parseInt(event.dataTransfer!.getData('text/plain'), 10);
  if (dragIndex === dropIndex) {
    return;
  }

  const draggedLayer = orderedLayers.value[dragIndex];
  const newLayers = [...orderedLayers.value];
  newLayers.splice(dragIndex, 1);
  newLayers.splice(dropIndex, 0, draggedLayer);
  orderedLayers.value = newLayers;
};

const onOrderChange = (event: any) => {
  const newOrder = orderedLayers.value.map(l => l.layerId);
  layerStore.updateLayerOrder(newOrder);
};

const openLayerOrderDialog = () => {
  // Убывающий порядок: слой с большим zIndex — выше в диалоге = выше на карте
  orderedLayers.value = [...geoServerLayers.value].sort((a, b) => {
    const aZIndex = a.zIndex !== undefined ? a.zIndex : 0;
    const bZIndex = b.zIndex !== undefined ? b.zIndex : 0;
    return bZIndex - aZIndex;
  });
  layerOrderDialog.value = true;
};

const saveLayerOrder = () => {
  const total = orderedLayers.value.length;
  // Первый в диалоге = верхний на карте = наибольший zIndex
  orderedLayers.value.forEach((layer, index) => {
    layer.zIndex = total - index;
  });

  // Сохраняем zIndex в localStorage
  layerStore.saveLayerOrder(orderedLayers.value.map((layer, index) => ({
    id: layer.layerId,
    zIndex: total - index,
  })));

  // updateLayerOrder ожидает порядок снизу вверх (последний = верхний на карте)
  // В диалоге список сверху вниз (первый = верхний), поэтому передаём в обратном порядке
  const bottomToTopIds = [...orderedLayers.value].reverse().map(l => l.layerId);
  layerStore.updateLayerOrder(bottomToTopIds);
  layerOrderDialog.value = false;
};

// Watchers
// Больше не нужны вотчеры для синхронизации, так как всё в одном месте

// Lifecycle
onMounted(() => {
  // intentionally left minimal to avoid excessive debug noise
});
</script>

<style lang="scss" scoped>
.layer-control-wrapper {
  position: relative;
  z-index: 1;

  .layer-control-button {
    position: absolute;
    top: 10px;
    right: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    
    &:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
    }
  }

  .layer-control-panel {
    .layer-drawer {
      :deep(.v-navigation-drawer__content) {
        overflow-y: auto;
        overflow-x: hidden;
      }
    }
  }
}

.layer-active {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.layer-list {
  .layer-item {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    
    &:last-child {
      margin-bottom: 0;
      border-bottom: none;
    }
  }
}

.layer-checkbox {
  :deep(.v-selection-control) {
    min-height: 32px !important;
    padding-inline-start: 12px !important;
  }
}

.layer-title {
  padding-left: 8px;
  flex: 1;
  font-size: 0.9rem;
  line-height: 1.2;
}

:deep(.v-expansion-panel-title) {
  min-height: 48px !important;
  padding: 12px !important;
  font-size: 0.95rem !important;
  
  .v-icon {
    margin-right: 12px;
  }
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0 !important;
  flex: 1 1 auto;
  max-width: 100%;
}

:deep(.v-expansion-panel-text) {
  padding: 8px !important;
}

:deep(.v-btn) {
  text-transform: none !important;
  letter-spacing: normal !important;
  font-size: 0.875rem !important;
  height: 32px !important;
  
  .v-btn__content {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

:deep(.v-expansion-panels) {
  .v-expansion-panel {
    margin-bottom: 8px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

:deep(.v-radio-group) {
  margin-top: 8px;
  
  .v-radio {
    margin-bottom: 4px;
    padding: 4px 0;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

:deep(.v-list-item--density-compact:not(.v-list-item--nav).v-list-item--one-line) {
  padding-inline: 0 !important;
}

:deep(.v-list-item) {
  padding: 0 !important;
}
</style>