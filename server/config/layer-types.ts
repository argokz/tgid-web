/**
 * Конфигурация типов слоев
 * 
 * Этот файл содержит конфигурацию для определения типов слоев на основе их имен.
 * Можно добавлять новые слои и изменять их типы.
 */

export interface LayerTypeConfig {
  type: 'line' | 'circle' | 'fill';
  paint?: Record<string, any>;
}

// Дефолтные стили для каждого типа слоя
export const DEFAULT_STYLES = {
  line: {
    'line-color': '#0000ff',
    'line-width': 3.5,
    'line-opacity': 1.0,
    'line-antialias-width': 1
  },
  fill: {
    'fill-color': '#0000ff',
    'fill-opacity': 0.6,
    'fill-outline-color': '#000000'
  },
  circle: {
    'circle-color': '#0000ff',
    'circle-radius': 6,
    'circle-opacity': 1.0,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#ffffff'
  }
} as const;

export const layerTypes: Record<string, LayerTypeConfig> = {

};

/**
 * Определяет тип слоя на основе его имени
 * @param layerName Имя слоя
 * @returns Конфигурация типа слоя или null, если слой не найден
 */
export function getLayerType(layerName: string): { type: 'line' | 'circle' | 'fill', paint?: Record<string, any> } | null {
  return layerTypes[layerName] || null;
}

/**
 * Определяет тип слоя на основе его имени и ключевых слов
 * @param layerName Имя слоя
 * @param sourceLayer Исходный слой
 * @returns Тип слоя ('line', 'circle' или 'fill')
 */
export function determineLayerType(layerName: string, sourceLayer: string): 'line' | 'circle' | 'fill' {
  // Проверяем, есть ли слой в конфигурации
  const config = getLayerType(layerName);
  if (config) {
    return config.type;
  }
  
  // Определяем тип на основе имени слоя
  const layerNameLower = layerName.toLowerCase();
  const sourceLayerLower = sourceLayer.toLowerCase();
  
  // Линейные слои
  if (layerNameLower.includes('line') || 
      layerNameLower.includes('linestring') || 
      layerNameLower.includes('pipe') ||
      layerNameLower.includes('road') ||
      layerNameLower.includes('street') ||
      layerNameLower.includes('path') ||
      layerNameLower.includes('route') ||
      sourceLayerLower.includes('line') || 
      sourceLayerLower.includes('linestring') ||
      sourceLayerLower.includes('pipe') ||
      sourceLayerLower.includes('road') ||
      sourceLayerLower.includes('street') ||
      sourceLayerLower.includes('path') ||
      sourceLayerLower.includes('route')) {
    return 'line';
  }
  
  // Полигональные слои
  if (layerNameLower.includes('polygon') || 
      layerNameLower.includes('area') || 
      layerNameLower.includes('district') ||
      layerNameLower.includes('zone') ||
      layerNameLower.includes('region') ||
      sourceLayerLower.includes('polygon') || 
      sourceLayerLower.includes('area') ||
      sourceLayerLower.includes('district') ||
      sourceLayerLower.includes('zone') ||
      sourceLayerLower.includes('region')) {
    return 'fill';
  }
  
  // По умолчанию используем точечный слой
  return 'circle';
}

/**
 * Получает дефолтные стили для типа слоя
 * @param type Тип слоя
 * @returns Дефолтные стили для типа слоя
 */
export function getDefaultPaint(type: 'line' | 'circle' | 'fill'): Record<string, any> {
  return DEFAULT_STYLES[type];
} 