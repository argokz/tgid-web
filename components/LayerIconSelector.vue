<template>
  <div class="layer-icon-selector">
    <div
      v-if="isLayerSupported"
      class="selector-container"
    >
      <p class="icon-title">
        Выберите иконку для слоя
      </p>
      
      <div class="icon-select-container">
        <label :for="`icon-select-${uniqueId}`">Выберите иконку:</label>
        <v-select
          :id="`icon-select-${uniqueId}`"
          :key="`icon-select-${props.layer.layerId}`"
          v-model="selectedIcon"
          :items="availableIcons"
          item-title="name"
          item-value="path"
          return-object
          hide-details
          density="compact"
          class="mt-1"
          :menu-props="{ eager: true }"
          :disabled="isLoading"
          @update:model-value="handleIconChange"
        >
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <img
                  v-if="item.raw.path"
                  :src="item.raw.path"
                  height="24"
                  width="24"
                  class="me-2"
                >
                <v-icon
                  v-else
                  icon="mdiCancel"
                  size="24"
                  class="me-2"
                />
              </template>
              <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
            </v-list-item>
          </template>
          <template #selection="{ item }">
            <div class="d-flex align-center">
              <img
                v-if="selectedIcon && selectedIcon.path"
                :src="selectedIcon.path"
                height="24"
                width="24"
                class="me-2"
              >
              <v-icon
                v-else
                icon="mdiCancel"
                size="24"
                class="me-2"
              />
              <div>{{ selectedIcon ? selectedIcon.name : '' }}</div>
            </div>
          </template>
        </v-select>
      </div>
      
      <div class="size-control mt-4">
        <label :for="`icon-size-${uniqueId}`">Размер:</label>
        <input 
          :id="`icon-size-${uniqueId}`"
          v-model="iconSizeInput" 
          type="range" 
          min="0.05" 
          max="0.5" 
          step="0.01"
          :disabled="isLoading"
          @change="updateIconSize"
        >
        <span class="size-value">{{ (iconSizeInput * 100).toFixed(0) }}%</span>
      </div>
      
      <div class="actions mt-2">
        <button 
          v-if="hasIcon" 
          :id="`reset-button-${uniqueId}`" 
          class="reset-button" 
          :disabled="isLoading"
          @click="resetIcon"
        >
          Сбросить иконку
        </button>
      </div>
      
      <div
        v-if="errorMessage"
        class="error-message"
      >
        {{ errorMessage }}
      </div>
      
      <div
        v-if="isLoading"
        class="loading-overlay"
      >
        <div class="loading-spinner" />
      </div>
    </div>
    <div
      v-else
      class="not-supported-layer"
    >
      Выбор иконки доступен только для точечных слоев и символов
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore';
import { useLayerStore } from '~/stores/layerStore';
import type { ExtendedLayerConfig } from '~/types';

const props = defineProps<{
  layer: ExtendedLayerConfig;
}>();

// Store
const mapStore = useMapStore();
const layerStore = useLayerStore();
// Add ref to track the last loaded layer ID
const lastLoadedLayerId = ref('');
// Add debounce timeout
let debounceTimeout: number | undefined;

// Создаем уникальный идентификатор для компонента на основе ID слоя
const uniqueId = computed(() => props.layer.layerId.replace(/[^a-zA-Z0-9]/g, '_'));

// После импортов добавим интерфейс для иконки
interface IconOption {
  name: string;
  path: string;
}

// Определяем доступные иконки с полными путями (учитываем baseURL)
const runtimeConfig = useRuntimeConfig();
const baseUrl = computed(() => {
  const base = runtimeConfig.app.baseURL || '/';
  return `${window.location.origin}${base.endsWith('/') ? base.slice(0, -1) : base}`;
});
const availableIcons = computed(() => [
  { name: 'Выберите иконку', path: '' },
  { name: 'Насос', path: `${baseUrl.value}/icons/pump.png` },
  { name: 'Точка подключения', path: `${baseUrl.value}/icons/point_pump.png` },
  { name: 'Тепловой пункт', path: `${baseUrl.value}/icons/tec_building.png` },
  { name: 'Локация', path: `${baseUrl.value}/icons/location.png` }
]);

const selectedIcon = ref<IconOption | null>(null);
const iconSize = ref<number>(0.15);
const errorMessage = ref('');
const hasIcon = ref(false);
const isLoading = ref(false);
// Add ref to store layer type info to avoid recalculating it frequently
const layerTypeInfo = ref<{type: string, metadata: any, isLoaded: boolean} | null>(null);

// Create a computed property for the range input to ensure it's always a number
const iconSizeInput = computed({
  get: () => iconSize.value,
  set: (val) => {
    // Ensure the value is always stored as a number
    iconSize.value = Number(val);
  }
});

// Получаем текущий тип слоя с учетом возможных метаданных
function getCurrentLayerType(): string {
  if (!mapStore.map) return props.layer.type;
  
  try {
    const currentLayer = mapStore.map.getLayer(props.layer.layerId);
    if (!currentLayer) {
      console.error(`Слой ${props.layer.layerId} не найден на карте`);
      return props.layer.type;
    }

    const metadata = (currentLayer as any)?.metadata;
    
    // Update cached layer type info
    layerTypeInfo.value = {
      type: currentLayer.type,
      metadata,
      isLoaded: true
    };
    
    // Для обработки сброса иконок важно знать реальный тип слоя
    // Но для определения поддержки возможности иконок нужно знать оригинальный тип
    return currentLayer.type;
  } catch (error) {
    console.error('Error getting layer type:', error);
    return props.layer.type;
  }
}

// Получаем информацию о метаданных слоя
function getLayerMetadata() {
  if (!mapStore.map) return null;
  try {
    const currentLayer = mapStore.map.getLayer(props.layer.layerId);
    if (!currentLayer) return null;
    return (currentLayer as any)?.metadata || null;
  } catch (error) {
    console.error('Error getting layer metadata:', error);
    return null;
  }
}

// Проверяем, поддерживается ли тип слоя для смены иконки
const isLayerSupported = computed(() => {
  // Use cached layer type info if available
  if (!layerTypeInfo.value || layerTypeInfo.value.type === undefined) {
    // Only update layer type info if we don't have it yet
    const isLayerLoaded = !!mapStore.map?.getLayer(props.layer.layerId);
    
    if (!isLayerLoaded) {
      return false;
    }
    
    // Get and cache the layer type
    const layerType = getCurrentLayerType();
    const metadata = getLayerMetadata();
    
    // Don't need to log here as getCurrentLayerType already logs
  } else {
    // Use cached information
    if (!layerTypeInfo.value.isLoaded) {
      return false;
    }
  }
  
  // Get type from cache or fresh data
  const layerType = layerTypeInfo.value?.type || props.layer.type;
  
  // Слой поддерживается, если:
  // 1. Это точечный слой (circle)
  // 2. Это символьный слой (symbol)
  const isValidType = 
    layerType === 'circle' || 
    layerType === 'symbol';
  
  return isValidType;
});

// Загружаем сохраненные настройки при монтировании
onMounted(() => {
  // Устанавливаем первую иконку в качестве выбранной по умолчанию
  selectedIcon.value = availableIcons.value[0];
  // Запускаем с небольшой задержкой, чтобы компонент успел отрендериться
  setTimeout(() => {
    loadSavedSettings();
  }, 50);
});

// Clean up on component unmount
onUnmounted(() => {
  // Clear any pending timeout
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = undefined;
  }
});

// Debounced function to update layer settings
function debouncedUpdateLayerSettings(newLayerId: string) {
  // Clear any existing timeout
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  
  // Set a new timeout
  debounceTimeout = window.setTimeout(() => {
    if (newLayerId && newLayerId !== lastLoadedLayerId.value) {
      loadSavedSettings();
    }
  }, 200); // 200ms debounce
}

// Следим за изменением ID слоя вместо всего объекта layer
watch(() => props.layer.layerId, (newLayerId) => {
  // Используем debounce для загрузки настроек
  debouncedUpdateLayerSettings(newLayerId);
});

function loadSavedSettings() {
  try {
    const layerId = props.layer.layerId;
    
    // Check if we already loaded these settings
    if (lastLoadedLayerId.value === layerId && layerTypeInfo.value) {
      // If we've already loaded settings for this layer, just return
      // This prevents unnecessary reloading
      return;
    }

    // Запоминаем ID текущего слоя чтобы избежать повторной загрузки
    lastLoadedLayerId.value = layerId;
    
    // Проверяем текущий тип слоя - используем кэш если возможно
    const currentType = layerTypeInfo.value?.type || getCurrentLayerType();
    const metadata = layerTypeInfo.value?.metadata || getLayerMetadata();

    // Получаем стиль
    const style = layerStore.layerStyles[layerId];

    // Определяем, имеет ли слой иконку
    if (style?.icon) {
      // Из style.icon.url получаем путь к иконке
      // Обычно iconId имеет формат "icon-{layerId}"
      const iconPath = style.icon.iconPath || '';

      // Сначала пробуем найти точное совпадение
      let savedIcon = availableIcons.value.find(icon => icon.path === iconPath);
      
      // Если точного совпадения нет, пробуем найти иконку по имени файла
      if (!savedIcon && iconPath) {
        const iconFileName = iconPath.split('/').pop(); // Получаем имя файла из пути
        if (iconFileName) {
          savedIcon = availableIcons.value.find(icon => icon.path.endsWith(iconFileName));
        }
      }
      
      if (savedIcon) {
        selectedIcon.value = savedIcon;
        
        // Оценка размера иконки из сохраненных стилей
        if (style.icon.width && style.icon.height) {
          // Примерный расчет и обязательное преобразование в число
          const calculatedSize = style.icon.width / (24 * 24);
          iconSize.value = Number(calculatedSize);
        } else {
          iconSize.value = 0.15;
        }
        
        hasIcon.value = true;
      } else if (iconPath) {
        // Если иконка не найдена в списке, но путь есть
        selectedIcon.value = { name: 'Загруженная иконка', path: iconPath };
        
        // Оценка размера иконки
        if (style.icon.width && style.icon.height) {
          const calculatedSize = style.icon.width / (24 * 24);
          iconSize.value = Number(calculatedSize);
        } else {
          iconSize.value = 0.15;
        }

        hasIcon.value = true;
      } else {
        // Если нет пути к иконке, сбрасываем настройки
        setDefaultSettings();
      }
    } else {
      // Если слой не имеет сохраненной иконки
      
      // Для символьных слоев проверяем текущую иконку
      if (currentType === 'symbol') {
        try {
          const currentImage = mapStore.map?.getLayoutProperty(layerId, 'icon-image');
          if (currentImage) {
            hasIcon.value = true;
          } else {
            setDefaultSettings();
          }
        } catch (e) {
          console.warn(`Ошибка при получении текущей иконки:`, e);
          setDefaultSettings();
        }
      } else {
        // Для других типов слоев
        setDefaultSettings();
      }
    }
  } catch (error) {
    console.error('Error loading saved settings:', error);
    setDefaultSettings();
  }
}

// Устанавливает настройки по умолчанию
function setDefaultSettings() {
  selectedIcon.value = availableIcons.value[0];
  iconSize.value = 0.15; // Explicitly set as a number
  hasIcon.value = false;
}

function handleIconChange(icon: IconOption) {
  selectedIcon.value = icon;
  
  // Make sure if the icon is null or undefined, we set it to the first icon
  if (!icon) {
    console.warn('Received empty icon, setting default');
    selectedIcon.value = availableIcons.value[0];
    return;
  }
  
  // Автоматически применяем иконку, если она выбрана и имеет путь
  // И не является первым элементом списка (пустым значением)
  if (icon.path && icon !== availableIcons.value[0]) {
    applyIcon();
  }
}

function updateIconSize() {
  // Если у нас есть иконка и она применена, обновляем ее размер и она применена, обновляем ее размер
  if (hasIcon.value && selectedIcon.value && selectedIcon.value.path) {
    applyIcon();
  }
}

async function applyIcon() {
  if (!selectedIcon.value || !selectedIcon.value.path) {
    errorMessage.value = 'Пожалуйста, выберите иконку';
    return;
  }
  
  try {
    // Включаем индикатор загрузки
    isLoading.value = true;
    errorMessage.value = '';
    const iconPath = selectedIcon.value.path;
    const layerId = props.layer.layerId;

    // Предварительно проверяем доступность иконки
    const img = new Image();
    img.src = iconPath;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error(`Не удалось загрузить изображение: ${iconPath}`));
      
      // Таймаут на загрузку
      setTimeout(() => {
        if (!img.complete) {
          reject(new Error(`Превышено время ожидания при загрузке изображения: ${iconPath}`));
        }
      }, 5000);
    });
    
    const currentType = getCurrentLayerType();
    const metadata = getLayerMetadata();

    // Ensure iconSize is converted to a number
    const numericIconSize = Number(iconSize.value);

    if (currentType === 'circle') {
      // Для точечных слоев используем существующий метод
      await layerStore.convertCircleLayerToSymbol(layerId, iconPath, numericIconSize);
      hasIcon.value = true;
    } else if (currentType === 'symbol') {
      // Для символьных слоев меняем только иконку
      await layerStore.changeSymbolLayerIcon(layerId, iconPath, numericIconSize);
      hasIcon.value = true;
    } else {
      console.error(`Неподдерживаемый тип слоя: ${currentType}`);
      errorMessage.value = `Тип слоя ${currentType} не поддерживается для замены иконки`;
      return;
    }
  } catch (error: any) {
    console.error('Error applying icon:', error);
    errorMessage.value = `Ошибка при применении иконки: ${error.message || 'Неизвестная ошибка'}`;
  } finally {
    // Выключаем индикатор загрузки
    isLoading.value = false;
  }
}

async function resetIcon() {
  try {
    isLoading.value = true;
    errorMessage.value = '';
    
    const currentType = getCurrentLayerType();
    const layerId = props.layer.layerId;
    const metadata = getLayerMetadata();

    if (currentType === 'symbol') {
      if (metadata?.originalType === 'circle') {
        // Если это был изначально точечный слой, восстанавливаем его
        await layerStore.convertSymbolLayerToCircle(layerId);
      } else {
        // Иначе просто удаляем иконку, сохраняя слой как символьный
        await layerStore.removeSymbolLayerIcon(layerId);
      }
      // Сбрасываем состояние компонента
      selectedIcon.value = availableIcons.value[0];
      iconSize.value = 0.15;
      hasIcon.value = false;
    } else if (currentType === 'circle') {
      // Для точечных слоев просто сбрасываем состояние компонента
      selectedIcon.value = availableIcons.value[0];
      iconSize.value = 0.15;
      hasIcon.value = false;
    } else {
      console.warn(`Слой ${layerId} имеет неподдерживаемый тип ${currentType}, сброс невозможен`);
      errorMessage.value = `Тип слоя ${currentType} не поддерживает операцию сброса`;
    }
  } catch (error: any) {
    console.error('Error resetting icon:', error);
    errorMessage.value = `Ошибка при сбросе иконки: ${error.message || 'Неизвестная ошибка'}`;
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.layer-icon-selector {
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  position: relative;
}

.icon-title {
  font-weight: bold;
  margin-bottom: 10px;
}

.icon-select-container {
  margin-bottom: 10px;
}

.icon-select-container label {
  display: block;
  margin-bottom: 5px;
}

.size-control {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.size-control label {
  margin-right: 10px;
}

.size-control input[type="range"] {
  flex-grow: 1;
}

.size-value {
  margin-left: 10px;
  min-width: 40px;
  text-align: right;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.reset-button {
  padding: 5px 10px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background-color: #f44336;
  color: white;
}

.reset-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: red;
  margin-top: 10px;
  font-size: 0.9em;
}

.not-supported-layer {
  color: #666;
  font-style: italic;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 