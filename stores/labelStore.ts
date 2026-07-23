import { defineStore } from 'pinia';
import type { 
  ExpressionSpecification, 
  LayerSpecification, 
  FilterSpecification 
} from 'maplibre-gl';
import type { LayerConfig } from '~/types';
import { useMapStore } from './mapStore';
import { useLayerStore } from './layerStore';
import { useFragmentStore } from './fragmentStore';
import { getMapTilerGlyphsUrl } from '~/utils/maptiler';

// Интерфейс для стиля надписей
interface LabelStyle {
  color: string;
  fontSize: number;
  anchor: 'top' | 'bottom' | 'left' | 'right' | 'center';
  offsetX: number;
  offsetY: number;
  showBackground: boolean;
  background?: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
  attributeIcons?: Record<string, string>;
}

interface LabelLayerIds {
  above: string;
  below: string;
  icon?: string;
}

// Технические названия подписей (из tgid-web и анализа MVT)
export const TECHNICAL_LABELS: Record<string, string> = {
  'NAPOR': 'Напор, м.вод.ст.',
  'RAS': 'Расход, т/ч',
  'DLINA': 'Длина, м',
  'DIAM_V': 'Диаметр вн., мм',
  'DIAM_U': 'Диаметр усл., мм',
  'OB': 'Объем, м3',
  'TEMP': 'Температура, °C',
  'T_POD': 'Т под., °C',
  'T_OBR': 'Т обр., °C',
  'P_POD': 'Р под., атм',
  'P_OBR': 'Р обр., атм',
  'RAS_U': 'Узловой расход, т/ч',
  'SKOR': 'Скорость, м/c',
  'UD_POT': 'Уд. потери, мм.вод.ст./м',
  'NAGR': 'Нагрузка, Гкал/ч',
  'RASP': 'Расп. напор, м',
  'H_OST': 'Ост. напор, м',
  'GEOD': 'Геод. отметка, м',
  'NAGR_U': 'Нагрузка уч., Гкал/ч',
  'NAPOR2': 'Полный напор, м.вод.ст.'
};

export const useLabelStore = defineStore('label', {
  state: () => ({
    layerLabels: {} as Record<string, string[]>,
    labelStyles: {} as Record<string, LabelStyle>,
    labelLayers: {} as Record<string, LabelLayerIds>,
    labelMinZoom: {} as Record<string, number>,
    labelMaxZoom: {} as Record<string, number>,
    globalLabels: [] as string[], // Глобально выбранные подписи
  }),

  actions: {
    // Загрузка сохраненных надписей
    loadLayerLabels() {
      if (process.client) {
        console.log('Loading saved layer labels...');
        
        const savedLabels = localStorage.getItem('layerLabels');
        const savedStyles = localStorage.getItem('labelStyles');
        const savedMinZoom = localStorage.getItem('labelMinZoom');
        const savedMaxZoom = localStorage.getItem('labelMaxZoom');
        const savedGlobalLabels = localStorage.getItem('globalLabels');
        
        if (savedLabels) {
          this.layerLabels = JSON.parse(savedLabels);
        }
        
        if (savedStyles) {
          this.labelStyles = JSON.parse(savedStyles);
        }
        
        if (savedMinZoom) {
          this.labelMinZoom = JSON.parse(savedMinZoom);
        }
        
        if (savedMaxZoom) {
          this.labelMaxZoom = JSON.parse(savedMaxZoom);
        }

        if (savedGlobalLabels) {
          this.globalLabels = JSON.parse(savedGlobalLabels);
        }

        const mapStore = useMapStore();
        const layerStore = useLayerStore();
        // if (mapStore.map) {
        //   // Применяем метки к видимым слоям
        //   this.syncGlobalLabels();
        // }
      }
    },
    
    // Сохранение настроек надписей
    saveLayerLabels() {
      if (process.client) {
        localStorage.setItem('layerLabels', JSON.stringify(this.layerLabels));
        localStorage.setItem('labelStyles', JSON.stringify(this.labelStyles));
        localStorage.setItem('labelMinZoom', JSON.stringify(this.labelMinZoom));
        localStorage.setItem('labelMaxZoom', JSON.stringify(this.labelMaxZoom));
        localStorage.setItem('globalLabels', JSON.stringify(this.globalLabels));
      }
    },
    
    // Обновление надписей слоя
    updateLayerLabels(layerId: string, labels: { name: string; icon: string }[], style: LabelStyle) {
      this.layerLabels[layerId] = labels.map(l => l.name);
      this.labelStyles[layerId] = {
        ...style,
        attributeIcons: labels.reduce((acc, label) => {
          if (label.icon) {
            acc[label.name] = label.icon;
          }
          return acc;
        }, {} as Record<string, string>)
      };
      this.saveLayerLabels();
      
      // Находим слой по ID
      const mapStore = useMapStore();
      const layerStore = useLayerStore();
      const layer = layerStore.geoServerLayers.find(l => l.layerId === layerId);
      if (layer) {
        this.applyLayerLabels(layer);
      }
    },

    // Применение надписей к слою
    applyLayerLabels(layer: LayerConfig) {
      const mapStore = useMapStore();
      if (!mapStore.map || !mapStore.map.getSource(layer.sourceId)) {
        console.warn(`Cannot apply labels: source ${layer.sourceId} for layer ${layer.layerId} not found on map`);
        return;
      }
      
      const labels = this.layerLabels[layer.layerId] || [];
      if (labels.length === 0) {
        console.log(`No labels selected for layer ${layer.layerId}, skipping label creation`);
        return;
      }
      
      console.log(`Applying labels for layer ${layer.layerId}. Selected labels:`, labels);
      
      // If the layer is an MVT layer with MBStyle, we skip client-side label generation
      // because the user wants to use the server-side {name}\n{text} format.
      if (layer.mvtUrl && layer.mbLayers && layer.mbLayers.length > 0) {
        console.log(`[labelStore] Skipping client-side labels for MVT layer ${layer.layerId} (using server-side style instead)`);
        this.removeLayerLabels(layer.layerId);
        return;
      }
      
      const style = this.labelStyles[layer.layerId] || {
        color: '#444444', // Dark gray instead of bright red
        fontSize: 9,      // Smaller font size
        anchor: 'center',
        offsetX: 0,
        offsetY: 0,
        showBackground: true,
        backgroundColor: '#ffffff',
        backgroundOpacity: 0.8,
        backgroundPadding: 1,
      };
      
      const defaultMinZoom = layer.type === 'circle' ? 15 : 14; // Подписи чуть позже линий
      const layerMinZoom = this.labelMinZoom[layer.layerId] || defaultMinZoom;
      const layerMaxZoom = this.labelMaxZoom[layer.layerId] || 22;
      
      const layerStore = useLayerStore();
      const isLayerVisible = layerStore.visibleGeoServerLayers.includes(layer.layerId);
      
      const labelLayerId = `${layer.layerId}-labels`;
      
      try {
        // Удаляем существующие слои меток
        this.removeLayerLabels(layer.layerId);

        // Проверяем глифы
        const currentStyle = mapStore.map.getStyle();
        if (!currentStyle.glyphs) {
          mapStore.map.setStyle({
            ...currentStyle,
            glyphs: getMapTilerGlyphsUrl()
          });
        }
        
        const textFieldParts: any[] = ['format'];
        
        if (labels.length === 1 && layer.type === 'circle') {
          // Для точечных слоев с одним атрибутом показываем только значение
          const label = labels[0];
          textFieldParts.push(['coalesce', 
            ['to-string', ['get', label.toUpperCase()]], 
            ['to-string', ['get', label.toLowerCase()]], 
            ['to-string', ['get', label]],
            '0'
          ]);
          textFieldParts.push({ 'font-scale': 1.1, 'text-color': style.color, 'font-weight': 'bold' });
        } else {
          // Для нескольких атрибутов или неточечных слоев показываем имена и значения атрибутов
          labels.forEach((label, idx) => {
            // Removed prefix as per user request
            // textFieldParts.push(`${formattedLabel}: `);
            // textFieldParts.push({ 'font-scale': 0.8, 'text-color': '#444444' });
            
            // Значение атрибута (пробуем все регистры)
            textFieldParts.push(['coalesce', 
              ['to-string', ['get', label.toUpperCase()]], 
              ['to-string', ['get', label.toLowerCase()]], 
              ['to-string', ['get', label]],
              '0'
            ]);
            textFieldParts.push({ 'font-scale': 1.0, 'text-color': style.color, 'font-weight': 'bold' });
            
            if (idx < labels.length - 1) {
              textFieldParts.push('\n');
              textFieldParts.push({});
            }
          });
        }
        
        const labelLayerSpec: LayerSpecification = {
          id: labelLayerId,
          type: 'symbol',
          source: layer.sourceId,
          'source-layer': layer.sourceLayer,
          minzoom: layerMinZoom,
          maxzoom: layerMaxZoom,
          layout: {
            'text-field': textFieldParts as any,
            'text-font': ['Open Sans Regular', 'Open Sans Bold'],
            'text-size': style.fontSize,
            'text-anchor': style.anchor || 'center',
            'text-offset': [style.offsetX || 0, style.offsetY || 2],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-max-width': layer.type === 'circle' ? 8 : 10,
            'text-justify': 'center',
            'text-letter-spacing': 0.05,
            'text-line-height': 1.2,
            'visibility': isLayerVisible ? 'visible' : 'none',
            'text-optional': true,
            'text-padding': layer.type === 'circle' ? 1 : 2,
            'text-max-angle': 45,
            'symbol-sort-key': ['get', 'id'],
            'symbol-z-order': 'source',
            'symbol-placement': layer.type === 'line' ? 'line' : 'point',
            'text-keep-upright': layer.type === 'line' ? true : false,
          },
          paint: {
            'text-color': style.color,
            'text-halo-color': style.showBackground ? style.backgroundColor : '#ffffff',
            'text-halo-width': style.showBackground ? 3 : 2,
            'text-halo-blur': style.showBackground ? 1 : 0.5,
            'text-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              layerMinZoom, 0,
              layerMinZoom + 1, 1
            ]
          }
        };
        
        const fragmentStore = useFragmentStore();
        const fileIdVariants = ['fileID', 'fileid', 'fileId', 'FILEID', 'FileId', 'file_id', 'FILE_ID'];
        const fragmentFilter: FilterSpecification = fragmentStore.visibleFragments.length > 0
          ? ['any', ...fileIdVariants.map(variant => 
              ['in', ['get', variant], ['literal', fragmentStore.visibleFragments]]
            )] as FilterSpecification
          : ['all'] as FilterSpecification;
        labelLayerSpec.filter = fragmentFilter;
        
        mapStore.map.addLayer(labelLayerSpec);
        
        this.labelLayers[layer.layerId] = {
          above: labelLayerId,
          below: '',
        };
      } catch (error) {
        console.error(`Error adding label layer for ${layer.layerId}:`, error);
      }
    },
    
    hideLayerLabels(layerId: string) {
      const mapStore = useMapStore();
      if (!mapStore.map) return;
      
      const labelLayers = this.labelLayers[layerId];
      if (labelLayers?.above && mapStore.map.getLayer(labelLayers.above)) {
        mapStore.map.setLayoutProperty(labelLayers.above, 'visibility', 'none');
      }
    },
    
    showLayerLabels(layerId: string) {
      const mapStore = useMapStore();
      if (!mapStore.map) return;
      
      const labelLayers = this.labelLayers[layerId];
      if (labelLayers?.above && mapStore.map.getLayer(labelLayers.above)) {
        mapStore.map.setLayoutProperty(labelLayers.above, 'visibility', 'visible');
      } else {
        const layerStore = useLayerStore();
        const layer = layerStore.geoServerLayers.find(l => l.layerId === layerId);
        if (layer) {
          this.applyLayerLabels(layer);
        }
      }
    },
    
    applyFragmentFilterToLabels(layerId: string, filter: any) {
      const mapStore = useMapStore();
      if (!mapStore.map) return;
      
      const labelLayers = this.labelLayers[layerId];
      if (labelLayers?.above && mapStore.map.getLayer(labelLayers.above)) {
        mapStore.map.setFilter(labelLayers.above, filter);
      }
      
      // Also check standard ID
      const standardId = `${layerId}-labels`;
      if (mapStore.map.getLayer(standardId)) {
        mapStore.map.setFilter(standardId, filter);
      }
    },
    
    removeLayerLabels(layerId: string) {
      const mapStore = useMapStore();
      if (!mapStore.map) return;
      
      const labelLayers = this.labelLayers[layerId];
      if (labelLayers?.above && mapStore.map.getLayer(labelLayers.above)) {
        mapStore.map.removeLayer(labelLayers.above);
      }
      
      const standardId = `${layerId}-labels`;
      if (mapStore.map.getLayer(standardId)) {
        mapStore.map.removeLayer(standardId);
      }
      
      delete this.labelLayers[layerId];
    },

    // Переключение глобальной подписи
    toggleGlobalLabel(labelId: string) {
      if (this.globalLabels.includes(labelId)) {
        this.globalLabels = this.globalLabels.filter(id => id !== labelId);
      } else {
        this.globalLabels.push(labelId);
      }
      this.saveLayerLabels();
      this.syncGlobalLabels();
    },

    /** Разом применить выбор подписей (после кнопки «Применить» в UI). */
    applyGlobalLabelsSelection(labelIds: string[]) {
      const uniq = [...new Set(labelIds)].sort();
      this.globalLabels = uniq;
      this.saveLayerLabels();
      this.syncGlobalLabels();
      useLayerStore().applyFragmentFilter();
    },

    // Синхронизация глобальных подписей со всеми слоями
    syncGlobalLabels() {
      const layerStore = useLayerStore();
      const mapStore = useMapStore();
      
      if (!mapStore.map) return;

      console.log('Syncing global labels:', this.globalLabels);

      layerStore.visibleGeoServerLayers.forEach(layerId => {
        const layer = layerStore.geoServerLayers.find(l => l.layerId === layerId);
        if (!layer) return;

        if (this.globalLabels.length > 0) {
          this.layerLabels[layerId] = [...this.globalLabels];
          
          if (!this.labelStyles[layerId]) {
            this.labelStyles[layerId] = {
              color: '#444444',
              fontSize: 9,
              anchor: 'top',
              offsetX: 0,
              offsetY: 2,
              showBackground: true,
              backgroundColor: '#ffffff',
              backgroundOpacity: 0.8,
              backgroundPadding: 1,
            };
          }
          
          this.applyLayerLabels(layer);
        } else {
          this.removeLayerLabels(layerId);
          delete this.layerLabels[layerId];
        }
      });
    }
  }
});