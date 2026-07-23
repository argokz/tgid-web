# P4 — синхронизация 2D/3D и 3D Tiles сети

## Сделано в коде

- Перенос камеры MapLibre ↔ Cesium при переключении режима (`syncCameraFrom2D` / `getCameraStateFor2D`).
- Общее состояние выбора `cesiumStore.syncedSelection` + `flyToSelection` в 3D.
- Хук `loadNetworkTileset(url)` для подключения Cesium3DTileset, когда появится URL тайлов сети.

## Как пользоваться selection sync

Из journal locate / identify:

```ts
cesiumStore.setSyncedSelection({
  id,
  longitude,
  latitude,
  label: 'Узел 123',
  layerId: 'nodes'
})
```

При `viewMode === '3D'` камера улетает к точке. При возврате в 2D MapViewer продолжает использовать MapLibre `flyTo`.

## 3D Tiles сети (следующий этап пайплайна)

1. Экспорт активных `linesobj`/`nodes` (или MVT → glTF) в 3D Tiles (высоты из геодезии / clamp to terrain).
2. Хостинг tileset.json (S3/nginx/GeoServer community).
3. Задать URL:

```ts
await cesiumStore.loadNetworkTileset('https://…/network/tileset.json')
```

или через runtime config (будущий `NUXT_PUBLIC_NETWORK_TILESET_URL`).

4. Синхронизировать стили 2D MapLibre paint с 3D material через общий style DTO.
5. Клик по tileset feature → тот же AttributePanel, что и в 2D.

## DoD P4

- [x] Камера 2D/3D синхронизируется
- [x] Общий selection state + flyTo в Cesium
- [x] API загрузки 3D Tiles готов
- [ ] Производственный tileset сети
- [ ] Единый стиль и pick в 3D
