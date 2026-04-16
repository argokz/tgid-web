<template>
  <client-only>
    <v-sheet v-if="isVisible">
      <!-- Кнопка настройки атрибутов и надписей -->
      <v-btn
        block
        color="primary"
        variant="outlined"
        class="mt-2"
        @click="openLabelSettingsDialog"
      >
        <v-icon start>
          mdiFormatListText
        </v-icon>
        Атрибуты и надписи слоя
      </v-btn>
      
      <!-- Диалог настройки надписей - используем v-if вместо v-model для ленивой загрузки -->
      <v-dialog
        v-if="labelSettingsDialog"
        v-model="labelSettingsDialog"
        max-width="800px"
      >
        <v-card>
          <v-card-title class="text-h6">
            Настройка атрибутов и надписей
          </v-card-title>
          <v-card-text>
            <v-tabs v-model="activeTab">
              <v-tab value="attributes">
                Атрибуты для отображения
              </v-tab>
              <v-tab value="style">
                Стиль надписей
              </v-tab>
            </v-tabs>
            
            <v-window
              v-model="activeTab"
              class="mt-4"
            >
              <!-- Вкладка атрибутов для отображения -->
              <v-window-item value="attributes">
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
                  <div v-else>
                    <!-- Настройки масштаба для всех надписей -->
                    <v-row class="mb-4">
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="labelMinZoom"
                          label="Мин. масштаб"
                          type="number"
                          hide-details
                          density="compact"
                          min="0"
                          max="22"
                          @update:model-value="handleLabelAttributeChange"
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="labelMaxZoom"
                          label="Макс. масштаб"
                          type="number"
                          hide-details
                          density="compact"
                          min="0"
                          max="22"
                          @update:model-value="handleLabelAttributeChange"
                        />
                      </v-col>
                    </v-row>
                    
                    <!-- Popup Zoom Settings -->
                    <div class="popup-zoom-settings">
                      <div class="section-title">
                        <v-icon start>
                          mdiMagnify
                        </v-icon>
                        Настройки масштаба для всплывающих подсказок
                      </div>
                      <div class="zoom-controls">
                        <v-text-field
                          v-model.number="popupMinZoom"
                          type="number"
                          label="Минимальный масштаб"
                          density="compact"
                          hide-details
                          @update:model-value="updatePopupZoom"
                        />
                        <v-text-field
                          v-model.number="popupMaxZoom"
                          type="number"
                          label="Максимальный масштаб"
                          density="compact"
                          hide-details
                          @update:model-value="updatePopupZoom"
                        />
                      </div>
                      
                      <!-- Show all popups setting -->
                      <div class="show-all-popups-setting mt-2">
                        <v-switch
                          v-model="showAllPopups"
                          label="Показывать все подсказки без наведения"
                          hide-details
                          density="compact"
                          @update:model-value="toggleShowAllPopups"
                        />
                        <v-text-field
                          v-if="showAllPopups"
                          v-model.number="allPopupsZoom"
                          type="number"
                          label="Масштаб для отображения всех подсказок"
                          density="compact"
                          hide-details
                          class="mt-2"
                          @update:model-value="updateAllPopupsZoom"
                        />
                      </div>
                    </div>
                    
                    <!-- Таблица атрибутов с виртуализацией -->
                    <v-list
                      density="compact"
                      class="attributes-list"
                      style="max-height: 300px; overflow-y: auto;"
                    >
                      <v-list-item
                        v-for="attr in visibleAttributes"
                        :key="attr.name"
                      >
                        <v-row
                          align="center"
                          no-gutters
                        >
                          <v-col cols="6">
                            <v-checkbox
                              v-model="labelAttributes[attr.name].showAsLabel"
                              :label="getTranslatedAttributeName(attr.name)"
                              hide-details
                              density="compact"
                              @change="handleLabelAttributeChange"
                            />
                          </v-col>
                          <v-col cols="3">
                            <v-checkbox
                              v-model="labelAttributes[attr.name].showInPopup"
                              label="В попапе"
                              hide-details
                              density="compact"
                              @change="handleAttributeChange"
                            />
                          </v-col>
                          <v-col
                            v-if="labelAttributes[attr.name].showAsLabel"
                            cols="3"
                          >
                            <v-select
                              v-model="labelAttributes[attr.name].icon"
                              :items="iconOptions"
                              item-title="title"
                              item-value="value"
                              hide-details
                              density="compact"
                              class="icon-select"
                              @update:model-value="handleLabelAttributeChange"
                            />
                          </v-col>
                        </v-row>
                      </v-list-item>
                    </v-list>
                  </div>
                </template>
              </v-window-item>
              
              <!-- Вкладка стиля надписей -->
              <v-window-item value="style">
                <v-row>
                  <!-- Цвет текста -->
                  <v-col
                    cols="12"
                    class="d-flex align-center"
                  >
                    <v-icon
                      size="small"
                      class="mr-2"
                    >
                      mdiFormatColorText
                    </v-icon>
                    <span class="text-caption mr-2">Цвет текста:</span>
                    <input
                      v-model="labelStyle.color"
                      type="color"
                      class="color-picker"
                      @input="handleLabelStyleChange"
                    >
                  </v-col>
                  
                  <!-- Размер шрифта -->
                  <v-col
                    cols="12"
                    class="d-flex align-center"
                  >
                    <v-icon
                      size="small"
                      class="mr-2"
                    >
                      mdiFormatFontSizeIncrease
                    </v-icon>
                    <span class="text-caption mr-2">Размер шрифта:</span>
                    <v-slider
                      v-model="labelStyle.fontSize"
                      min="8"
                      max="24"
                      step="1"
                      hide-details
                      class="mx-2"
                      density="compact"
                      @update:model-value="handleLabelStyleChange"
                    />
                    <span class="text-caption ml-1">{{ labelStyle.fontSize }}px</span>
                  </v-col>
                  
                  <!-- Позиция надписи -->
                  <v-col
                    cols="12"
                    class="d-flex align-center"
                  >
                    <v-icon
                      size="small"
                      class="mr-2"
                    >
                      mdiFormatAlignMiddle
                    </v-icon>
                    <span class="text-caption mr-2">Позиция:</span>
                    <v-select
                      v-model="labelStyle.anchor"
                      :items="anchorOptions"
                      hide-details
                      density="compact"
                      class="ml-2"
                      @update:model-value="handleLabelStyleChange"
                    />
                  </v-col>
                  
                  <!-- Смещение -->
                  <v-col cols="12">
                    <div class="text-caption mb-2">
                      Смещение:
                    </div>
                    <v-row dense>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="labelStyle.offsetX"
                          label="По горизонтали"
                          type="number"
                          hide-details
                          density="compact"
                          @update:model-value="handleLabelStyleChange"
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="labelStyle.offsetY"
                          label="По вертикали"
                          type="number"
                          hide-details
                          density="compact"
                          @update:model-value="handleLabelStyleChange"
                        />
                      </v-col>
                    </v-row>
                  </v-col>
                  
                  <!-- Фон надписи -->
                  <v-col
                    cols="12"
                    class="d-flex align-center"
                  >
                    <v-icon
                      size="small"
                      class="mr-2"
                    >
                      mdiFormatColorFill
                    </v-icon>
                    <span class="text-caption mr-2">Фон надписи:</span>
                    <v-switch
                      v-model="labelStyle.showBackground"
                      hide-details
                      density="compact"
                      class="ml-2"
                      @update:model-value="handleLabelStyleChange"
                    />
                  </v-col>
                  
                  <!-- Цвет фона (если включен) -->
                  <v-col
                    v-if="labelStyle.showBackground"
                    cols="12"
                    class="d-flex align-center"
                  >
                    <v-icon
                      size="small"
                      class="mr-2"
                    >
                      mdiPalette
                    </v-icon>
                    <span class="text-caption mr-2">Цвет фона:</span>
                    <input
                      v-model="labelStyle.backgroundColor"
                      type="color"
                      class="color-picker"
                      @input="handleLabelStyleChange"
                    >
                  </v-col>
                </v-row>
              </v-window-item>
            </v-window>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              @click="saveLabelSettings"
            >
              Сохранить
            </v-btn>
            <v-btn
              color="secondary"
              @click="labelSettingsDialog = false"
            >
              Отмена
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-sheet>
  </client-only>
</template>

<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore';
import { useLayerStore } from '~/stores/layerStore';
import { useLabelStore } from '~/stores/labelStore';
import { usePopupStore } from '~/stores/popupStore';
import type { ExtendedLayerConfig } from '~/types';
import { defaultLabelStyle, defaultLabelAttributes } from '~/utils/labelDefaults';
import LayerIconSelector from './LayerIconSelector.vue';
import { useTranslations } from '~/composables/useTranslations';



// Define label style interface
interface LabelStyle {
  color: string;
  fontSize: number;
  anchor: 'top' | 'bottom' | 'left' | 'right' | 'center';
  offsetX: number;
  offsetY: number;
  showBackground: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
  attributeIcons: Record<string, string>;
  background: boolean;
}

// Define label attribute interface
interface LabelAttribute {
  showAsLabel: boolean;
  showInPopup: boolean;
  icon: string;
}

interface Attribute {
  name: string;
  showAsLabel: boolean;
}

// Props
const props = defineProps<{
  layer: ExtendedLayerConfig;
}>();

// Store
const mapStore = useMapStore();
const layerStore = useLayerStore();
const labelStore = useLabelStore();
const popupStore = usePopupStore();
const { loadTranslations, getCachedRussianName } = useTranslations();

// State
const loading = ref(false);
const selectedAttrs = ref<string[]>([]);
const availableAttributes = ref<Attribute[]>([]);

// Label settings
const labelSettingsDialog = ref(false);
const activeTab = ref('attributes');
const labelStyle = ref<LabelStyle>({
  color: '#000000',
  fontSize: 12,
  anchor: 'top',
  offsetX: 0,
  offsetY: 1,
  showBackground: false,
  backgroundColor: '#ffffff',
  backgroundOpacity: 1,
  backgroundPadding: 2,
  background: false,
  attributeIcons: {}
});
const labelAttributes = ref<Record<string, LabelAttribute>>({});
const labelMinZoom = ref(0);
const labelMaxZoom = ref(22);
const anchorOptions = [
  { title: 'Сверху', value: 'top' },
  { title: 'Снизу', value: 'bottom' },
  { title: 'Слева', value: 'left' },
  { title: 'Справа', value: 'right' },
  { title: 'По центру', value: 'center' },
];
const iconOptions = [
  { title: 'Нет', value: '' },
  { title: '📍', value: '📍' },
  { title: '🏢', value: '🏢' },
  { title: '🏭', value: '🏭' },
  { title: '🚧', value: '🚧' },
  { title: '⚡', value: '⚡' },
  { title: '💧', value: '💧' },
  { title: '🌳', value: '🌳' },
  { title: '🚗', value: '🚗' },
  { title: '🚶', value: '🚶' },
  { title: '📊', value: '📊' },
  { title: '📝', value: '📝' },
  { title: '🔧', value: '🔧' },
  { title: '⚠️', value: '⚠️' },
  { title: '✅', value: '✅' },
];

// Add popup zoom state
const popupMinZoom = ref(0);
const popupMaxZoom = ref(22);
const showAllPopups = ref(false);
const allPopupsZoom = ref(16);

// Add at the top of the script section with other state variables
let updateTimeout: ReturnType<typeof setTimeout> | null = null;

// Add a new method to handle label attribute changes
const handleLabelAttributeChange = (): void => {
  // Remove the immediate update logic, just store the changes
  // The actual update will happen in saveLabelSettings
};

// Add a method to handle label style changes
const handleLabelStyleChange = (): void => {
  // Remove the immediate update logic, just store the changes
  // The actual update will happen in saveLabelSettings
};

// Add cleanup in onBeforeUnmount
onBeforeUnmount(() => {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
});

// Computed
const isVisible = computed(() => {
  return layerStore.visibleGeoServerLayers.includes(props.layer.layerId);
});



// Add computed property for visible attributes with pagination
const visibleAttributes = computed(() => {
  // If we have more than 50 attributes, only show the first 50 initially
  // This will be loaded dynamically as the user scrolls
  return availableAttributes.value.slice(0, 50);
});

// Methods
const formatAttributeName = (attr: string): string => {
  return attr
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const loadAttributes = async (): Promise<void> => {
  if (!isVisible.value || !process.client) return;
  
  loading.value = true;
  try {
    console.log(`Loading attributes for layer: ${props.layer.layerId}`);
    
    // Проверяем, существует ли слой на карте
    const checkLayerExists = async (): Promise<boolean> => {
      if (!mapStore.map) return false;
      
      // Проверяем все возможные варианты ID слоя
      const possibleLayerIds = [
        props.layer.layerId,
        `${props.layer.layerId}-labels`,
        `${props.layer.layerId}-above`,
        `${props.layer.layerId}-below`
      ];
      
      return possibleLayerIds.some(id => mapStore.map?.getLayer(id));
    };
    
    // Ждем, пока слой появится на карте
    let retries = 0;
    const maxRetries = 10;
    const retryDelay = 1000; // 1 секунда
    
    while (!(await checkLayerExists()) && retries < maxRetries) {
      console.log(`Waiting for layer ${props.layer.layerId} to be created, attempt ${retries + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retries++;
    }
    
    if (retries >= maxRetries) {
      console.warn(`Layer ${props.layer.layerId} not found after ${maxRetries} attempts`);
      return;
    }
    
    // Создаем LayerConfig объект из ServerLayer
    const layerConfig = {
      id: props.layer.id || props.layer.layerId,
      layerId: props.layer.layerId,
      displayName: props.layer.displayName || '',
      sourceLayer: props.layer.sourceLayer || '',
      url: props.layer.url || '',
      styleUrl: props.layer.styleUrl,
      visible: !!props.layer.visible,
      type: props.layer.type || 'fill',
      label: props.layer.label || '',
      sourceId: props.layer.sourceId || '',
      paint: props.layer.paint || {},
      attributes: props.layer.attributes || []
    };
    
    // Безопасно получаем атрибуты слоя
    let attributes: string[] = [];
    try {
      attributes = await layerStore.getPbfAttributes(layerConfig);
      console.log(`Loaded attributes for ${props.layer.layerId}:`, attributes);
      
      if (!attributes || attributes.length === 0) {
        console.log(`No attributes found for layer ${props.layer.layerId}`);
        return;
      }
      
      // Предзагружаем переводы для атрибутов
      if (attributes.length > 0) {
        await loadTranslations(attributes);
      }
    } catch (error) {
      console.error(`Error fetching attributes for layer ${props.layer.layerId}:`, error);
      return;
    }
    
    // Преобразуем массив строк в массив объектов с атрибутами
    availableAttributes.value = attributes.map(attr => ({
      name: attr,
      showAsLabel: false
    }));
    
    // Инициализация labelAttributes с проверкой на существование
    if (!labelAttributes.value) {
      labelAttributes.value = {};
    }
    
    // Инициализируем атрибуты с безопасной проверкой
    attributes.forEach(attr => {
      if (!labelAttributes.value[attr]) {
        labelAttributes.value[attr] = { 
          showAsLabel: false,
          showInPopup: false,
          icon: ''
        };
      }
    });
    
    // Загружаем сохраненные атрибуты для попапа, если они есть
    const savedAttrs = layerStore.layerAttributes[props.layer.layerId];
    if (savedAttrs && Array.isArray(savedAttrs) && savedAttrs.length > 0) {
      selectedAttrs.value = savedAttrs;
      
      // Проставляем флаги для отображения в попапе
      savedAttrs.forEach(attr => {
        if (labelAttributes.value[attr]) {
          labelAttributes.value[attr].showInPopup = true;
        }
      });
    }
  } catch (error) {
    console.error('Error loading attributes:', error);
  } finally {
    loading.value = false;
  }
};

const handleAttributeChange = (): void => {
  if (process.client && availableAttributes.value && labelAttributes.value) {
    // Get all attributes that should be shown in popup
    const popupAttrs = availableAttributes.value
      .filter(attr => 
        labelAttributes.value[attr.name] && labelAttributes.value[attr.name].showInPopup
      )
      .map(attr => attr.name);
    
    console.log(`Updating attributes for layer ${props.layer.layerId}:`, popupAttrs);
    layerStore.updateLayerAttributes(props.layer.layerId, popupAttrs);
  }
};



// Метод для получения переведенного названия атрибута
const getTranslatedAttributeName = (attr: string): string => {
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



// Modify the openLabelSettingsDialog function to use lazy loading
const openLabelSettingsDialog = (): void => {
  // Set dialog to true to trigger lazy loading
  labelSettingsDialog.value = true;
  
  // Use nextTick to ensure the dialog is rendered before loading data
  nextTick(() => {
    // Load current label settings
    const currentLabelStyle = labelStore.labelStyles[props.layer.layerId];
    if (currentLabelStyle) {
      labelStyle.value = { 
        ...labelStyle.value,
        ...currentLabelStyle,
        showBackground: currentLabelStyle.showBackground ?? currentLabelStyle.background ?? false,
        background: currentLabelStyle.background ?? false
      };
    }
    
    // Load current label attributes
    const currentLabels = labelStore.layerLabels[props.layer.layerId] || [];
    availableAttributes.value.forEach(attr => {
      if (!labelAttributes.value[attr.name]) {
        labelAttributes.value[attr.name] = { 
          showAsLabel: false,
          showInPopup: false,
          icon: ''
        };
      }
      
      // Set showAsLabel based on current labels
      labelAttributes.value[attr.name].showAsLabel = currentLabels.includes(attr.name);
      
      // Set showInPopup based on current popup attributes
      const popupAttrs = layerStore.layerAttributes[props.layer.layerId] || [];
      labelAttributes.value[attr.name].showInPopup = popupAttrs.includes(attr.name);
    });
    
    // Load zoom settings
    const savedMinZoom = labelStore.labelMinZoom[props.layer.layerId];
    const savedMaxZoom = labelStore.labelMaxZoom[props.layer.layerId];
    
    if (savedMinZoom !== undefined) {
      labelMinZoom.value = savedMinZoom;
    } else if (props.layer.type === 'circle' || props.layer.type === 'image') {
      labelMinZoom.value = 12; // Устанавливаем минимальный масштаб 12 для точечных объектов
    }
    
    if (savedMaxZoom !== undefined) {
      labelMaxZoom.value = savedMaxZoom;
    }
    
    // Load popup settings
    showAllPopups.value = popupStore.showAllPopups;
    allPopupsZoom.value = popupStore.allPopupsZoom;
    popupMinZoom.value = popupStore.popupMinZoom;
    popupMaxZoom.value = popupStore.popupMaxZoom;
  });
};

const saveLabelSettings = (): void => {
  // Check if there are any changes
  const currentLabelStyle = labelStore.labelStyles[props.layer.layerId];
  const currentLabels = labelStore.layerLabels[props.layer.layerId] || [];
  const currentPopupAttrs = layerStore.layerAttributes[props.layer.layerId] || [];
  const currentMinZoom = labelStore.labelMinZoom[props.layer.layerId];
  const currentMaxZoom = labelStore.labelMaxZoom[props.layer.layerId];

  // Get new values
  const newLabels = availableAttributes.value
    .filter(attr => labelAttributes.value[attr.name]?.showAsLabel)
    .map(attr => ({
      name: attr.name,
      icon: labelAttributes.value[attr.name]?.icon || ''
    }));

  const newPopupAttrs = availableAttributes.value
    .filter(attr => labelAttributes.value[attr.name]?.showInPopup)
    .map(attr => attr.name);

  // Check if anything has changed
  const hasStyleChanges = JSON.stringify(currentLabelStyle) !== JSON.stringify(labelStyle.value);
  const hasLabelChanges = JSON.stringify(currentLabels) !== JSON.stringify(newLabels.map(l => l.name));
  const hasPopupChanges = JSON.stringify(currentPopupAttrs) !== JSON.stringify(newPopupAttrs);
  const hasZoomChanges = currentMinZoom !== labelMinZoom.value || currentMaxZoom !== labelMaxZoom.value;

  // Only save and apply changes if something has changed
  if (hasStyleChanges || hasLabelChanges || hasPopupChanges || hasZoomChanges) {
    // Save label style
    labelStore.labelStyles[props.layer.layerId] = { ...labelStyle.value };
    
    // Update labels in store with icons
    labelStore.updateLayerLabels(props.layer.layerId, newLabels, labelStyle.value as any);
    
    // Save zoom settings
    labelStore.labelMinZoom[props.layer.layerId] = labelMinZoom.value;
    labelStore.labelMaxZoom[props.layer.layerId] = labelMaxZoom.value;
    
    // Save popup attributes
    layerStore.updateLayerAttributes(props.layer.layerId, newPopupAttrs);
    
    // Обрабатываем все image слои как circle
    let layerType = props.layer.type;
    if (layerType === 'image') {
      console.log('Converting image layer type to circle for label compatibility');
      layerType = 'circle';
    }
    
    const layerConfig: ExtendedLayerConfig = {
      ...props.layer,
      type: layerType as 'line' | 'circle' | 'fill' | 'symbol'
    };
    
    // Apply or remove labels based on whether there are any labels to show
    if (newLabels.length > 0) {
      labelStore.applyLayerLabels(layerConfig);
    } else {
      labelStore.removeLayerLabels(props.layer.layerId);
    }
  }
  
  // Close dialog
  labelSettingsDialog.value = false;
};

// Add method to toggle showing all popups
const toggleShowAllPopups = (value: boolean | null): void => {
  if (value !== null) {
    popupStore.toggleShowAllPopups(value);
    popupStore.updateAllPopupsZoom(allPopupsZoom.value);
  }
};

// Add method to update all popups zoom level
const updateAllPopupsZoom = () => {
  if (showAllPopups.value) {
    popupStore.toggleShowAllPopups(true);
    popupStore.updateAllPopupsZoom(allPopupsZoom.value);
  }
};

// Add method to update popup zoom limits
const updatePopupZoom = () => {
  popupStore.updatePopupZoomLimits(popupMinZoom.value, popupMaxZoom.value);
};

// Watchers
watch(isVisible, (newValue) => {
  if (newValue && process.client) {
    console.log(`Layer ${props.layer.layerId} became visible, loading attributes`);
    loadAttributes();
  }
}, { immediate: true });

// Lifecycle
onMounted(() => {
  if (!process.client) return;
  
  console.log(`LayerAttributeAndLabelManager mounted for layer: ${props.layer.layerId}`);
  
  // Загрузка сохраненных настроек
  const savedAttrs = layerStore.layerAttributes[props.layer.layerId];
  if (savedAttrs?.length) {
    console.log(`Found saved attributes for ${props.layer.layerId}:`, savedAttrs);
    selectedAttrs.value = savedAttrs;
  }


  
  // Загрузка сохраненных настроек надписей
  const savedLabelStyle = labelStore.labelStyles[props.layer.layerId];
  if (savedLabelStyle) {
    console.log(`Found saved label style for ${props.layer.layerId}:`, savedLabelStyle);
    labelStyle.value = { 
      ...labelStyle.value, 
      ...savedLabelStyle,
      // Ensure offsets are always set
      offsetX: savedLabelStyle.offsetX ?? 1,
      offsetY: savedLabelStyle.offsetY ?? 1,
      showBackground: savedLabelStyle.showBackground ?? savedLabelStyle.background ?? false,
      attributeIcons: savedLabelStyle.attributeIcons ?? {}
    };
  }
  
  // Загрузка сохраненных настроек масштаба
  const savedMinZoom = labelStore.labelMinZoom[props.layer.layerId];
  const savedMaxZoom = labelStore.labelMaxZoom[props.layer.layerId];
  
  if (savedMinZoom !== undefined) {
    labelMinZoom.value = savedMinZoom;
  } else if (props.layer.type === 'circle' || props.layer.type === 'image') {
    labelMinZoom.value = 12; // Устанавливаем минимальный масштаб 12 для точечных объектов
  }
  
  if (savedMaxZoom !== undefined) {
    labelMaxZoom.value = savedMaxZoom;
  }
  
  // Загрузка настроек popup
  showAllPopups.value = popupStore.showAllPopups;
  allPopupsZoom.value = popupStore.allPopupsZoom;

  // Загрузка сохраненных настроек иконки
  loadSavedSettings();

});

// Определяем доступные иконки с фиксированными размерами (учитываем baseURL)
const appBaseURL = useRuntimeConfig().app.baseURL || '/';
const iconBase = appBaseURL.endsWith('/') ? appBaseURL.slice(0, -1) : appBaseURL;
const availableIcons = [
  { name: 'Нет', url: '', width: 0, height: 0 },
  { name: 'Насос', url: `${iconBase}/icons/pump.png`, width: 32, height: 32 },
  { name: 'Тепловой пункт', url: `${iconBase}/icons/tec_building.png`, width: 32, height: 32 },
  { name: 'Точка подключения', url: `${iconBase}/icons/point_pump.png`, width: 32, height: 32 }
];

const selectedIcon = ref('');
const iconSize = ref(0.15); // Уменьшенное начальное значение 15%

const handleIconChange = async () => {
  // Проверяем, что карта инициализирована
  if (!mapStore.map) {
    console.error('Map is not initialized yet');
    return;
  }

  console.log(`Icon change triggered. Selected icon: ${selectedIcon.value}`);
  
  // Найдем все слои, связанные с текущим ID
  const layerId = props.layer.layerId;
  const layerIds = layerStore.getLayerIdsOnMap(layerId);
  
  // Если выбрано "Нет" или пустое значение, удаляем иконку
  if (!selectedIcon.value) {
    console.log('Removing icon - no selection');
    
    // Удаляем иконку из стиля
    layerStyle.value.icon = undefined;
    
    // Remove saved settings
    localStorage.removeItem(`layer-icon-${props.layer.layerId}`);
    
    // For MVT layers, we may need to remove the symbol layer instead of just updating properties
    for (const id of layerIds) {
      try {
        if (mapStore.map) {
          // If this is an MVT layer or has an associated symbol layer, handle it specially
          const symbolLayerId = `${id}-symbol-icon`;
          const hasSymbolLayer = mapStore.map.getLayer(symbolLayerId) !== undefined;
          
          if (hasSymbolLayer) {
            // If we have a symbol layer for this layer, hide it
            console.log(`Hiding symbol layer ${symbolLayerId}`);
            try {
              mapStore.map.setLayoutProperty(symbolLayerId, 'visibility', 'none');
            } catch (e) {
              console.warn(`Error hiding symbol layer ${symbolLayerId}:`, e);
            }
          }
          
          // Try to restore original layer visibility and properties
          const layer = mapStore.map.getLayer(id);
          if (layer) {
            try {
              // Make the original layer visible again
              mapStore.map.setLayoutProperty(id, 'visibility', 'visible');
              
              // For circle layers, restore circle paint properties
              if (layer.type === 'circle') {
                mapStore.map.setPaintProperty(id, 'circle-color', layerStyle.value.color);
                mapStore.map.setPaintProperty(id, 'circle-opacity', layerStyle.value.opacity);
                mapStore.map.setPaintProperty(id, 'circle-radius', layerStyle.value.circleRadius || 5);
                mapStore.map.setPaintProperty(id, 'circle-stroke-width', 1);
                mapStore.map.setPaintProperty(id, 'circle-stroke-color', '#ffffff');
                console.log(`Restored circle properties for layer ${id}`);
              }
            } catch (e) {
              console.warn(`Error restoring layer ${id} properties:`, e);
            }
          }
        }
      } catch (e) {
        console.warn(`Error updating layer ${id}:`, e);
      }
    }
    
    return;
  }
  
    const selectedIconData = availableIcons.find(icon => icon.url === selectedIcon.value);
  if (!selectedIconData) {
    console.error(`Icon data not found for ${selectedIcon.value}`);
    return;
  }
  
  // Обработка выбора опции "Нет"
      if (selectedIconData.url === '') {
    console.log('Removing icon - "Нет" selected');
    
        // Если выбрана опция "Нет", убираем иконку
        layerStyle.value.icon = undefined;
    
        // Возвращаем размер иконки к значению по умолчанию
    iconSize.value = 0.15;
    
        // Remove saved settings
        localStorage.removeItem(`layer-icon-${props.layer.layerId}`);
    
    // Restore original layers with circle properties instead of hiding/showing layers
    for (const id of layerIds) {
      try {
        if (mapStore.map) {
          const layer = mapStore.map.getLayer(id);
          if (layer && layer.type === 'circle') {
            mapStore.map.setPaintProperty(id, 'circle-color', layerStyle.value.color);
            mapStore.map.setPaintProperty(id, 'circle-opacity', layerStyle.value.opacity);
            mapStore.map.setPaintProperty(id, 'circle-radius', layerStyle.value.circleRadius || 5);
            mapStore.map.setPaintProperty(id, 'circle-stroke-width', 1);
            mapStore.map.setPaintProperty(id, 'circle-stroke-color', '#ffffff');
            console.log(`Restored circle properties for layer ${id}`);
          }
        }
      } catch (e) {
        console.warn(`Error updating layer ${id}:`, e);
      }
    }
      } else {
    console.log(`Setting icon to ${selectedIconData.url}`);
    
    // Создаем уникальный ID для иконки
    const iconId = `icon-${props.layer.layerId}`;
    
    try {
      // Проверяем, загружена ли иконка уже, и если да - удаляем ее для обновления
      if (mapStore.map.hasImage(iconId)) {
        console.log(`Removing existing image ${iconId} to replace it`);
        try {
          mapStore.map.removeImage(iconId);
        } catch (removeError) {
          console.warn(`Could not remove existing image ${iconId}:`, removeError);
        }
      }
      
      // Загружаем изображение
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Добавляем изображение в карту
          if (mapStore.map) {
            try {
              mapStore.map.addImage(iconId, img);
              console.log(`Image ${iconId} added to map from ${selectedIconData.url}`);
              resolve(true);
            } catch (addError) {
              console.error(`Error adding image to map:`, addError);
              reject(addError);
            }
          } else {
            reject(new Error('Map is not available'));
          }
        };
        img.onerror = (e) => {
          console.error(`Failed to load image: ${selectedIconData.url}`, e);
          reject(e);
        };
        img.src = selectedIconData.url;
      });
      
      // Устанавливаем иконку в стиле
        layerStyle.value.icon = {
        url: iconId, // Используем ID зарегистрированной иконки
        width: selectedIconData.width * (iconSize.value || 0.15),
        height: selectedIconData.height * (iconSize.value || 0.15)
      };
      
      // Сохраняем настройки иконки в localStorage
        localStorage.setItem(`layer-icon-${props.layer.layerId}`, JSON.stringify({
          iconUrl: selectedIconData.url,
        size: iconSize.value || 0.15
      }));
      
      // Process each layer
      for (const id of layerIds) {
        if (!mapStore.map) continue;
        
        try {
          // Get current layer
          const layer = mapStore.map.getLayer(id);
          if (!layer) continue;
          
          console.log(`Processing layer ${id} of type ${layer.type}`);
          
          // Check if this is an MVT layer
          const isMVTLayer = id.includes('mvt') || (layer.source && layer.source.toString().includes('mvt'));
          
          // For MVT layers or other layer types, create a separate symbol layer
          if (isMVTLayer || layer.type !== 'circle') {
            console.log(`Layer ${id} is ${isMVTLayer ? 'an MVT layer' : 'not a circle layer'}, creating a symbol layer for it`);
            
            // Always use the symbol layer approach for MVT layers
            const symbolLayerId = `${id}-symbol-icon`;
            
            // Check if the symbol layer already exists
            if (!mapStore.map.getLayer(symbolLayerId)) {
              try {
                // Get source information from the original layer
                const source = layer.source as string;
                // Need to access raw layer data for source-layer property
                const sourceLayer = (mapStore.map
                  .getStyle()
                  .layers.find((l: any) => l.id === id) as any)?.['source-layer'];
                
                // Create base layer config
                const symbolLayerConfig: any = {
                  id: symbolLayerId,
                  type: 'symbol',
                  source: source,
                  layout: {
                    'icon-image': iconId,
                    'icon-size': iconSize.value || 0.15,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'visibility': 'visible'
                  },
                  paint: {
                    'icon-opacity': layerStyle.value.opacity,
                    'icon-color': layerStyle.value.color
                  }
                };
                
                // For MVT layers, we need to include the source-layer
                if (sourceLayer) {
                  symbolLayerConfig['source-layer'] = sourceLayer;
                } else if (isMVTLayer) {
                  // If this is an MVT layer but source-layer is missing, try to find it
                  const layerConfig = layerStore.geoServerLayers.find(
                    (l: ExtendedLayerConfig) => l.layerId === props.layer.layerId
                  );
                  if (layerConfig && layerConfig.sourceLayer) {
                    symbolLayerConfig['source-layer'] = layerConfig.sourceLayer;
                  } else {
                    // Try to derive source-layer from the layer id
                    console.log(`No source-layer found for MVT layer ${id}, attempting to derive it`);
                    const possibleSourceLayer = id.split('-').pop();
                    if (possibleSourceLayer) {
                      symbolLayerConfig['source-layer'] = possibleSourceLayer;
                      console.log(`Using derived source-layer: ${possibleSourceLayer} for layer ${id}`);
                    } else {
                      console.error(`Cannot create symbol layer for MVT layer ${id} without source-layer property`);
                      continue; // Skip creating this layer
                    }
                  }
                }
                
                // Add the symbol layer
                mapStore.map.addLayer(symbolLayerConfig);
                console.log(`Created symbol layer ${symbolLayerId} for layer ${id}`);
                
                // Make the original layer invisible to prevent overlapping
                try {
                  if (layer.type === 'circle') {
                    mapStore.map.setPaintProperty(id, 'circle-opacity', 0);
                  }
                  console.log(`Made original layer ${id} invisible where possible`);
                } catch (e) {
                  console.warn(`Could not hide original layer ${id}:`, e);
                }
              } catch (createError) {
                console.error(`Failed to create symbol layer for ${id}:`, createError);
              }
            } else {
              // Update existing symbol layer
              try {
                mapStore.map.setLayoutProperty(symbolLayerId, 'icon-image', iconId);
                mapStore.map.setLayoutProperty(symbolLayerId, 'icon-size', iconSize.value || 0.15);
                mapStore.map.setPaintProperty(symbolLayerId, 'icon-opacity', layerStyle.value.opacity);
                mapStore.map.setPaintProperty(symbolLayerId, 'icon-color', layerStyle.value.color);
                mapStore.map.setLayoutProperty(symbolLayerId, 'visibility', 'visible');
                console.log(`Updated existing symbol layer ${symbolLayerId}`);
                
                // Make the original layer invisible
                try {
                  if (layer.type === 'circle') {
                    mapStore.map.setPaintProperty(id, 'circle-opacity', 0);
                  }
                } catch (e) {
                  console.warn(`Error hiding original layer ${id}:`, e);
                }
              } catch (updateError) {
                console.warn(`Error updating symbol layer ${symbolLayerId}`, updateError);
              }
            }
          } else if (layer.type === 'circle') {
            // For circle layers, we can update to use icon properties
            console.log(`Applying icon to circle layer ${id}`);
            
            // First, reduce circle opacity to make it invisible
            mapStore.map.setPaintProperty(id, 'circle-opacity', 0);
            
            try {
              // Try to apply icon properties
              mapStore.map.setLayoutProperty(id, 'icon-image', iconId);
              mapStore.map.setLayoutProperty(id, 'icon-size', iconSize.value || 0.15);
              mapStore.map.setLayoutProperty(id, 'icon-allow-overlap', true);
              mapStore.map.setLayoutProperty(id, 'icon-ignore-placement', true);
              
              // Try to set paint properties for the icon
              mapStore.map.setPaintProperty(id, 'icon-opacity', layerStyle.value.opacity);
              mapStore.map.setPaintProperty(id, 'icon-color', layerStyle.value.color);
              
              console.log(`Successfully applied icon properties to layer ${id}`);
            } catch (iconError) {
              console.warn(`Could not set icon properties on layer ${id}, creating a new symbol layer`, iconError);
              
              // If we can't set icon properties on the layer, create a new symbol layer
              const symbolLayerId = `${id}-symbol-icon`;
              
              // Check if the symbol layer already exists
              if (!mapStore.map.getLayer(symbolLayerId)) {
                try {
                  // Get source information from the original layer
                  const source = layer.source as string;
                  
                  // Create a new symbol layer
                  mapStore.map.addLayer({
                    id: symbolLayerId,
                    type: 'symbol',
                    source: source,
                    layout: {
                      'icon-image': iconId,
                      'icon-size': iconSize.value || 0.15,
                      'icon-allow-overlap': true,
                      'icon-ignore-placement': true
                    },
                    paint: {
                      'icon-opacity': layerStyle.value.opacity,
                      'icon-color': layerStyle.value.color
                    }
                  });
                  
                  // Copy event handlers from original layer to the new symbol layer
                  console.log(`Created new symbol layer ${symbolLayerId} for icon`);
                  
                  // Keep the original layer but make it invisible
                  mapStore.map.setPaintProperty(id, 'circle-opacity', 0);
                } catch (addLayerError) {
                  console.error(`Failed to create symbol layer ${symbolLayerId}`, addLayerError);
                  // Fall back to changing the original layer's style
                  mapStore.map.setPaintProperty(id, 'circle-color', layerStyle.value.color);
                  mapStore.map.setPaintProperty(id, 'circle-opacity', layerStyle.value.opacity);
                  mapStore.map.setPaintProperty(id, 'circle-radius', layerStyle.value.circleRadius || 5);
                }
              } else {
                // Update existing symbol layer
                try {
                  mapStore.map.setLayoutProperty(symbolLayerId, 'icon-image', iconId);
                  mapStore.map.setLayoutProperty(symbolLayerId, 'icon-size', iconSize.value || 0.15);
                  mapStore.map.setPaintProperty(symbolLayerId, 'icon-opacity', layerStyle.value.opacity);
                  mapStore.map.setPaintProperty(symbolLayerId, 'icon-color', layerStyle.value.color);
                  mapStore.map.setLayoutProperty(symbolLayerId, 'visibility', 'visible');
                  console.log(`Updated existing symbol layer ${symbolLayerId}`);
                } catch (updateError) {
                  console.warn(`Error updating symbol layer ${symbolLayerId}`, updateError);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing layer ${id} for icon change:`, error);
        }
      }
    } catch (error) {
      console.error(`Error setting icon: ${error}`);
    }
  }
};

const updateIconSize = () => {
  // Проверка наличия карты
  if (!mapStore.map) {
    console.error('Map is not initialized yet');
    return;
  }
  
  if (!layerStyle.value || !selectedIcon.value) {
    console.log('No layer style or selected icon');
    return;
  }
  
  // Обеспечиваем безопасный доступ к значению
  const safeIconSize = iconSize.value || 0.15;
  
  const selectedIconData = availableIcons.find(icon => icon.url === selectedIcon.value);
  if (!selectedIconData) {
    console.error(`Icon data not found for ${selectedIcon.value}`);
    return;
  }
  
  // Обновляем размеры в объекте иконки
  if (layerStyle.value.icon) {
    layerStyle.value.icon.width = selectedIconData.width * safeIconSize;
    layerStyle.value.icon.height = selectedIconData.height * safeIconSize;
  } else {
    // Создаем объект icon, если он отсутствует
    layerStyle.value.icon = {
      url: `icon-${props.layer.layerId}`,
      width: selectedIconData.width * safeIconSize,
      height: selectedIconData.height * safeIconSize
    };
  }
  
  // Сохраняем обновленный размер
  try {
    const savedSettings = localStorage.getItem(`layer-icon-${props.layer.layerId}`);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      const iconUrl = parsed?.iconUrl || selectedIcon.value;
      localStorage.setItem(`layer-icon-${props.layer.layerId}`, JSON.stringify({
        iconUrl,
        size: safeIconSize
      }));
    } else {
      // Если настройки еще не сохранены
      localStorage.setItem(`layer-icon-${props.layer.layerId}`, JSON.stringify({
        iconUrl: selectedIcon.value,
        size: safeIconSize
      }));
    }
  } catch (error) {
    console.error('Error updating saved icon size:', error);
  }
  
  // Update all layer types carefully
  const layerIds = mapStore.getLayerIdsOnMap(props.layer.layerId);
  
  try {
    layerIds.forEach(id => {
      if (mapStore.map) {
        try {
          // Check layer type
          const layer = mapStore.map.getLayer(id);
          if (!layer) return;
          
          if (layer.type === 'symbol') {
            // For symbol layers, directly update the icon size
            mapStore.map.setLayoutProperty(id, 'icon-size', safeIconSize);
            console.log(`Updated icon size for symbol layer ${id} to ${safeIconSize}`);
          } else {
            // For non-symbol layers, check if we have a symbol layer for this layer
            const symbolLayerId = `${id}-symbol-icon`;
            if (mapStore.map.getLayer(symbolLayerId)) {
              mapStore.map.setLayoutProperty(symbolLayerId, 'icon-size', safeIconSize);
              console.log(`Updated icon size for symbol layer ${symbolLayerId} to ${safeIconSize}`);
            } else {
              console.log(`No symbol layer found for ${id}, cannot update icon size`);
            }
          }
        } catch (error) {
          console.warn(`Error setting icon size for layer ${id}:`, error);
        }
      }
    });
  } catch (error) {
    console.error('Error applying icon size:', error);
  }
};

// Update loadSavedSettings with better error handling
const loadSavedSettings = () => {
  try {
    // Load saved icon settings
    const savedIconSettings = localStorage.getItem(`layer-icon-${props.layer.layerId}`);
    if (savedIconSettings) {
      const parsed = JSON.parse(savedIconSettings);
      const iconUrl = parsed?.iconUrl;
      const size = parsed?.size || 0.15;
      
      if (!iconUrl) {
        console.warn('Invalid saved icon URL');
        return;
      }
      
      selectedIcon.value = iconUrl;
      iconSize.value = size;
      
      if (iconUrl) {
        const iconId = `icon-${props.layer.layerId}`;
        
        // Load the icon image safely
        if (mapStore.map && !mapStore.map.hasImage(iconId)) {
          const img = new Image();
          img.onload = () => {
            if (mapStore.map) {
              try {
                // Add the image to the map
                mapStore.map.addImage(iconId, img);
                console.log(`Saved image ${iconId} added to map from ${iconUrl}`);
                
                // Update the style with the registered icon
                layerStyle.value.icon = {
                  url: iconId,
                  width: 32 * size,
                  height: 32 * size
                };
                
                // Apply the icon style
                updateStyle('icon', layerStyle.value.icon);
              } catch (error) {
                console.error('Error adding saved image to map:', error);
              }
            }
          };
          img.onerror = (e) => {
            console.error(`Failed to load saved icon: ${iconUrl}`, e);
          };
          img.src = iconUrl;
        } else if (mapStore.map) {
          // Icon already loaded, just update the style
          layerStyle.value.icon = {
            url: iconId,
            width: 32 * size,
            height: 32 * size
          };
          updateStyle('icon', layerStyle.value.icon);
        }
      }
    }
  } catch (error) {
    console.error('Error loading saved icon settings:', error);
  }
};
</script>

<style scoped>
.color-picker {
  width: 40px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.number-input {
  max-width: 80px;
}

.text-caption {
  font-size: 0.75rem;
  white-space: nowrap;
}

.text-subtitle-1 {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.text-body-2 {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.font-weight-medium {
  font-weight: 500;
}
</style> 