# P4 — синхронизация 2D/3D и 3D Tiles сети

## Сделано в коде

- Перенос камеры MapLibre ↔ Cesium при переключении режима (`syncCameraFrom2D` / `getCameraStateFor2D`).
- Общее состояние выбора `cesiumStore.syncedSelection` + `flyToSelection` в 3D.
- Хук `loadNetworkTileset(url)` для подключения Cesium3DTileset.
- Runtime config: `NUXT_PUBLIC_NETWORK_TILESET_URL` → `CesiumViewer` подхватывает URL при init.
- `GET /api/export/dxf` — DXF линий (ezdxf).
- `GET /api/ochered-opressovok` — RO очередь опрессовок (отдельно от журнала `opres`).
- `GET /reports/word/{journal}/{id}` — Word-акты shurf/osmotr/remont/opres.

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

## 3D Tiles сети

1. Экспорт активных `linesobj`/`nodes` в 3D Tiles.
2. Хостинг tileset.json.
3. Задать URL:

```
NUXT_PUBLIC_NETWORK_TILESET_URL=https://…/network/tileset.json
```

4. Синхронизировать стили 2D/3D.
5. Клик по tileset feature → AttributePanel.

## DoD P4

- [x] Камера 2D/3D синхронизируется
- [x] Общий selection state + flyTo в Cesium
- [x] API загрузки 3D Tiles готов + env URL
- [x] DXF + ochered RO + Word stubs
- [ ] Производственный tileset сети
- [ ] Единый стиль и pick в 3D
