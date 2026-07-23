import type { Map } from 'maplibre-gl';
import type { ExtendedLayerConfig } from '~/types';

const loadedSprites = new Set<string>();

function sanitizeMapLibreFilter(f: any): any {
  if (!Array.isArray(f) || f.length === 0) return f;
  const op = f[0];
  if (['==', '!='].includes(op) && f.length === 3) {
    const left = f[1];
    const right = f[2];
    if (right === null || right === 'null' || right === 'NULL') {
      const propName = typeof left === 'string' ? left : (Array.isArray(left) && left[0] === 'get' ? left[1] : null);
      if (propName) {
        return op === '==' ? ['!', ['has', propName]] : ['has', propName];
      }
    }
    if (left === null || left === 'null' || left === 'NULL') {
      const propName = typeof right === 'string' ? right : (Array.isArray(right) && right[0] === 'get' ? right[1] : null);
      if (propName) {
        return op === '==' ? ['!', ['has', propName]] : ['has', propName];
      }
    }
  }
  return f.map((k: any) => sanitizeMapLibreFilter(k));
}

export const mapService = {
  async loadStyleImage(map: Map, imageId: string, imageUrl: string) {
    if (!imageId || !imageUrl || map.hasImage(imageId)) return;
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.crossOrigin = 'Anonymous';
        element.onload = () => resolve(element);
        element.onerror = (e) => reject(new Error(`Unable to load style image: ${imageUrl}`));
        element.src = imageUrl;
      });
      if (!map.hasImage(imageId)) map.addImage(imageId, image, { pixelRatio: 1 });
    } catch (err) {
      console.warn(`[mapService] Failed to load style image ${imageId}:`, err);
    }
  },

  async loadSprite(map: Map, spriteUrl: string) {
    if (loadedSprites.has(spriteUrl)) return;
    loadedSprites.add(spriteUrl);

    try {
      const jsonUrl = `${spriteUrl}.json`;
      const imageUrl = `${spriteUrl}.png`;

      const [jsonRes, img] = await Promise.all([
        fetch(jsonUrl).then(r => r.json()),
        new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.crossOrigin = 'Anonymous';
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = imageUrl;
        })
      ]);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      for (const [id, info] of Object.entries(jsonRes)) {
        if (!map.hasImage(id)) {
          try {
            const { x, y, width, height, pixelRatio } = info as any;
            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
            
            const imageData = ctx.getImageData(0, 0, width, height);
            // Set pixelRatio to 2 so 100px icons render at 50px logical pixels (as requested by user)
            map.addImage(id, imageData, { pixelRatio: 2 });
          } catch (e) {
            console.warn(`[mapService] Failed to decode sprite icon ${id}:`, e);
          }
        }
      }
      console.log(`[mapService] Loaded ${Object.keys(jsonRes).length} icons from sprite ${spriteUrl}`);
    } catch (error) {
      console.error('[mapService] Failed to load sprite', spriteUrl, error);
      loadedSprites.delete(spriteUrl); // Allow retry
    }
  },

  async loadMvtLayer(map: Map, layer: ExtendedLayerConfig) {
    if (!layer.mvtUrl) {
      throw new Error(`Missing mvtUrl for layer ${layer.layerId}`);
    }
    
    // Load sprite if necessary BEFORE adding layer
    if (layer.sprite) {
      await this.loadSprite(map, layer.sprite);
    }

    try {
      // Дожидаемся полной загрузки стиля карты, иначе maplibre бросает
      // "Style is not done loading" при addSource/addLayer
      if (!map.isStyleLoaded()) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            map.off('styledata', onStyleData);
            map.off('idle', onIdle);
            reject(new Error('Map style did not finish loading in time'));
          }, 15000);

          const onStyleData = () => {
            if (map.isStyleLoaded()) {
              clearTimeout(timeout);
              map.off('styledata', onStyleData);
              map.off('idle', onIdle);
              resolve();
            }
          };

          const onIdle = () => {
            if (map.isStyleLoaded()) {
              clearTimeout(timeout);
              map.off('styledata', onStyleData);
              map.off('idle', onIdle);
              resolve();
            }
          };

          map.on('styledata', onStyleData);
          map.once('idle', onIdle);
        });
      }

      // Добавляем источник данных
      map.addSource(layer.sourceId, {
        type: 'vector',
        tiles: [layer.mvtUrl],
        minzoom: 0,
        maxzoom: 22,
      });

      const styleImages = new globalThis.Map<string, string>();
      for (const mbLayer of layer.mbLayers || []) {
        const imageId = String(mbLayer?.metadata?.geoserverIconId || '');
        const imageUrl = String(mbLayer?.metadata?.geoserverIconUrl || '');
        if (imageId && imageUrl) styleImages.set(imageId, imageUrl);
      }
      await Promise.all(
        [...styleImages.entries()].map(([imageId, imageUrl]) =>
          this.loadStyleImage(map, imageId, imageUrl)
        )
      );

      // Добавляем слой/слои
      if (layer.mbLayers && layer.mbLayers.length > 0) {
        // Если это нативный MBStyle с несколькими слоями (например, обводка + заливка + текст)
        // Сортируем: сначала линии/полигоны, затем точечные (circle/symbol) — чтобы точки были поверх линий
        const pointTypes = new Set(['circle', 'symbol']);
        const mbLayersWithOriginalIndex = layer.mbLayers.map((mbLayer, index) => ({ mbLayer, index }));
        const sortedMbLayers = [...mbLayersWithOriginalIndex].sort((a, b) => {
          const aIsPoint = pointTypes.has(a.mbLayer.type) ? 1 : 0;
          const bIsPoint = pointTypes.has(b.mbLayer.type) ? 1 : 0;
          return aIsPoint - bIsPoint; // Нон-поинт первым, точечные последними
        });

        sortedMbLayers.forEach(({ mbLayer, index }) => {
          // Если слой единственный, не добавляем суффикс к ID для совместимости
          const isSingle = layer.mbLayers!.length === 1;
          const mapLayerId = isSingle ? layer.layerId : `${layer.layerId}-${index}-${mbLayer.id || 'layer'}`;
          
          const isLine = mbLayer.type === 'line' || (mbLayer.id && (mbLayer.id.toLowerCase().includes('line') || mbLayer.id.toLowerCase().includes('pipe')));
          const defaultLayout = isLine ? { 'line-join': 'round', 'line-cap': 'round' } : {};

          const isSymbol = mbLayer.type === 'symbol' || (mbLayer.id && mbLayer.id.toLowerCase().includes('label'));
          const hasText = mbLayer.layout && mbLayer.layout['text-field'];
          
          // Re-enable MVT labels as the user wants to use the server-side {name}\n{text} format
          // which is controlled by viewparams.
          
          const layerConfig: any = {
            id: mapLayerId,
            type: mbLayer.type === 'image' ? 'symbol' : mbLayer.type,
            source: layer.sourceId,
            'source-layer': layer.sourceLayer,
            paint: mbLayer.paint || {},
            layout: { ...defaultLayout, ...(mbLayer.layout || {}) },
          };
          
          // Объединяем фильтры слоя и фильтры из стиля
          if (layer.filter && mbLayer.filter) {
            layerConfig.filter = ['all', layer.filter, mbLayer.filter];
          } else if (layer.filter) {
            layerConfig.filter = layer.filter;
          } else if (mbLayer.filter) {
            layerConfig.filter = mbLayer.filter;
          } else {
            layerConfig.filter = ['all'];
          }
          layerConfig.filter = sanitizeMapLibreFilter(layerConfig.filter);

          if (mbLayer.minzoom !== undefined) layerConfig.minzoom = mbLayer.minzoom;
          if (mbLayer.maxzoom !== undefined) layerConfig.maxzoom = mbLayer.maxzoom;
          
          if (mbLayer.type === 'symbol' && mbLayer.layout?.['text-size']) {
            const currentSize = mbLayer.layout['text-size'];
            if (typeof currentSize === 'number') {
              layerConfig.layout['text-size'] = currentSize * 0.8; // Reduce by 20%
            } else if (Array.isArray(currentSize)) {
              // Handle interpolated text size: ["interpolate", ["linear"], ["zoom"], 10, 12, 18, 16]
              layerConfig.layout['text-size'] = currentSize.map(item => typeof item === 'number' ? item * 0.8 : item);
            }
          }
          
          map.addLayer(layerConfig);
        });
      } else {
        // Fallback для одного слоя (сгенерированный style)
        const mapLayerType = layer.type === 'image' ? 'symbol' : layer.type;
        const isLine = mapLayerType === 'line';
        const defaultLayout = isLine ? { 'line-join': 'round', 'line-cap': 'round' } : {};

        const layerConfig: any = {
          id: layer.layerId,
          type: mapLayerType,
          source: layer.sourceId,
          'source-layer': layer.sourceLayer,
          paint: layer.paint || {},
          layout: { ...defaultLayout, ...(layer.layout || {}) },
          filter: sanitizeMapLibreFilter(layer.filter || ['all']) as any,
        };
        map.addLayer(layerConfig);
      }

      console.log(`MVT layer ${layer.layerId} added successfully`);
    } catch (error) {
      console.error(`Failed to load MVT layer ${layer.layerId}:`, error);
      throw error;
    }
  }
};
