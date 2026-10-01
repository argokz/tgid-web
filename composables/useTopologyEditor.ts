import maplibregl from 'maplibre-gl';
import { getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { ApiError, fastApiService } from '~/services/fastApiService';
import type {
  MergeNodesReport,
  SplitReviewDecision,
  SplitTransferReport,
  TopologyUndoEntry,
} from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';
import { useLineVertexEditor } from '~/composables/useLineVertexEditor';
import { getFeatureId, getFeatureKind } from '~/utils/networkFeature';
import { pickNetworkSnap } from '~/utils/networkSnap';
import { topologyOperationLabel } from '~/utils/topologyLabels';

export interface TopologyEditorOptions {
  getMap: () => maplibregl.Map | null | undefined;
  /** Правка топологии разрешена (роль + флаг сервера) */
  enabled: Ref<boolean>;
  /** Режим трассировки пьезометра — взаимоисключающий с правкой */
  isTraceMode: Ref<boolean>;
  /** Идёт рисование/измерение на панели рисования */
  isDrawActive: () => boolean;
  setIdentifyMode: (enabled: boolean) => void;
  /** Перерисовать слои данных после изменения сети */
  refreshLayers: () => void;
  /** Объект, открытый в карточке (для удаления) */
  getSelectedFeature: () => { layerId?: string; layerName?: string } | undefined | null;
  /** Закрыть карточку объекта */
  closeCard: () => void;
}

/**
 * Режим редактирования топологии: перенос/создание узлов, создание и разрезание
 * участков, слияние узлов, правка вершин, отмена последней операции.
 * Версии объектов (оптимистичная блокировка) берутся при выборе и уходят в операцию;
 * 409 version_conflict показывается уведомлением с кнопкой «Перезагрузить».
 */
export function useTopologyEditor(options: TopologyEditorOptions) {
  const { getMap, enabled, isTraceMode, isDrawActive, setIdentifyMode, refreshLayers, getSelectedFeature, closeCard } = options;

  // === Состояние режима ===
  const isEditTopologyMode = ref(false);
  // Вышел из учётной записи / сервер выключил флаг — режим правки топологии закрывается
  watch(enabled, (on: boolean) => {
    if (!on) isEditTopologyMode.value = false;
  });
  const topologyStartNode = ref<number | null>(null);
  // Версия начального узла нового участка — запрашивается при его выборе
  let topologyStartNodeVersion: Promise<string | undefined> | null = null;
  let draggedNodeMarker: maplibregl.Marker | null = null;
  let draggedNodeId: number | null = null;
  // Версия перетаскиваемого узла, запрошенная в момент захвата (mousedown)
  let draggedNodeVersion: Promise<string | undefined> | null = null;
  let suppressTopologyClickUntil = 0;
  // Клик по узлу — это mousedown+mouseup без сдвига: он не должен записывать moveNode
  const DRAG_THRESHOLD_PX = 4;
  let dragStartPoint: { x: number; y: number } | null = null;
  let dragMoved = false;

  const isMergeMode = ref(false);
  const mergeTargetNodeId = ref<number | null>(null);
  const mergeSourceNodeId = ref<number | null>(null);
  const mergeConfirmDialogOpen = ref(false);
  const mergeLoading = ref(false);
  const mergePreviewReport = ref<MergeNodesReport | null>(null);
  const mergePreviewLoading = ref(false);
  const mergePreviewError = ref<string | null>(null);

  // === Оптимистичная блокировка ===
  // Версия объекта берётся в момент выбора (или из dry-run превью) и уходит в операцию;
  // если объект успели изменить, сервер отвечает 409 version_conflict.
  const fetchTopologyVersion = async (kind: 'nodes' | 'lines', id: number): Promise<string | undefined> => {
    try {
      const res = await fastApiService.getTopologyVersions({ [kind]: [id] });
      return res[kind]?.[String(id)]?.version;
    } catch {
      return undefined; // без версии сервер не проверяет — операция всё равно под FOR UPDATE
    }
  };

  // === Отмена последней операции топологии (журнал на сервере, B5) ===
  const lastTopologyOperation = ref<TopologyUndoEntry | null>(null);
  const undoBusy = ref(false);

  const refreshUndoState = async () => {
    if (!enabled.value) {
      lastTopologyOperation.value = null;
      return;
    }
    try {
      lastTopologyOperation.value = await fastApiService.getLastTopologyOperation();
    } catch {
      lastTopologyOperation.value = null;
    }
  };

  /** После любой операции топологии: обновить слои и кнопку «Отменить» */
  const afterTopologyChange = () => {
    refreshLayers();
    void refreshUndoState();
  };

  /** Карточка объекта сообщает об изменении (разворот, удаление) */
  const onCardRefreshLayers = () => afterTopologyChange();

  const undoLastTopologyOperation = async () => {
    const entry = lastTopologyOperation.value;
    if (!entry) return;
    undoBusy.value = true;
    try {
      const res = await fastApiService.undoTopologyOperation(entry.operation_id);
      const deleted = Object.values(res.deleted || {}).reduce((a, ids) => a + ids.length, 0);
      const restored = Object.values(res.restored || {}).reduce((a, n) => a + Number(n || 0), 0);
      useNotificationStore().showSuccess(
        `Отменено: ${topologyOperationLabel(entry)} (восстановлено строк: ${restored}, удалено созданных: ${deleted})`
      );
      vertexEditor.stop();
      afterTopologyChange();
    } catch (err: any) {
      if (err instanceof ApiError && err.isVersionConflict) {
        useNotificationStore().showWarning(
          'Отменить нельзя: объекты операции изменены после неё (другим пользователем или следующей операцией).'
        );
      } else {
        reportTopologyError(err, 'Ошибка отмены');
      }
      void refreshUndoState();
    } finally {
      undoBusy.value = false;
    }
  };

  // === Правка вершин участка (8.5) ===
  const isVertexMode = ref(false);
  const vertexEditor = useLineVertexEditor(getMap, {
    onSaved: (res) => {
      useNotificationStore().showSuccess(`Геометрия участка ${res.line_id} сохранена, длина ${res.new_length} м`);
      afterTopologyChange();
    },
    onError: (err, reload) => reportTopologyError(err, 'Ошибка сохранения геометрии', reload),
  });

  const toggleVertexMode = () => {
    if (isVertexMode.value && vertexEditor.dirty.value && !confirm('Отказаться от несохранённых изменений вершин?')) return;
    isVertexMode.value = !isVertexMode.value;
    vertexEditor.stop();
    if (isVertexMode.value) {
      isMergeMode.value = false;
      mergeTargetNodeId.value = null;
      mergeSourceNodeId.value = null;
      topologyStartNode.value = null;
      useNotificationStore().showInfo('Правка вершин: кликните участок. Концы участка прибиты к узлам.');
    }
  };

  /** 409 «изменён другим пользователем» — уведомление с кнопкой перезагрузки; прочее — ошибка */
  const reportTopologyError = (err: any, prefix: string, reload?: () => void | Promise<void>) => {
    const notify = useNotificationStore();
    if (err instanceof ApiError && err.isVersionConflict) {
      notify.showConflict(err.userMessage, async () => {
        refreshLayers();
        await reload?.();
      });
      return;
    }
    notify.showError(`${prefix}: ${err?.userMessage || err?.message || ''}`);
  };

  const toggleMergeMode = () => {
    if (isVertexMode.value) {
      isVertexMode.value = false;
      vertexEditor.stop();
    }
    isMergeMode.value = !isMergeMode.value;
    mergeTargetNodeId.value = null;
    mergeSourceNodeId.value = null;
    if (isMergeMode.value) {
      topologyStartNode.value = null;
      useNotificationStore().showInfo('Режим слияния узлов: выберите целевой узел, затем узел для объединения.');
    }
  };

  const cancelMerge = () => {
    mergeConfirmDialogOpen.value = false;
    mergeTargetNodeId.value = null;
    mergeSourceNodeId.value = null;
    mergePreviewReport.value = null;
  };

  /** Dry-run слияния: отчёт «что и куда перенесётся» и версии обоих узлов для подтверждения */
  const openMergePreview = async () => {
    const target = mergeTargetNodeId.value;
    const source = mergeSourceNodeId.value;
    if (!target || !source) return;
    mergePreviewReport.value = null;
    mergePreviewError.value = null;
    mergePreviewLoading.value = true;
    mergeConfirmDialogOpen.value = true;
    try {
      mergePreviewReport.value = await fastApiService.previewMergeNodes({
        target_node_id: target,
        source_node_id: source,
      });
    } catch (err: any) {
      mergePreviewError.value = err?.userMessage || err?.message || 'Не удалось получить превью';
    } finally {
      mergePreviewLoading.value = false;
    }
  };

  const confirmMerge = async () => {
    const target = mergeTargetNodeId.value;
    const source = mergeSourceNodeId.value;
    if (!target || !source) return;
    const versions = mergePreviewReport.value?.versions || {};
    mergeLoading.value = true;
    try {
      const res = await fastApiService.mergeNodes({
        target_node_id: target,
        source_node_id: source,
        target_version: versions[`node:${target}`],
        source_version: versions[`node:${source}`],
      });
      const moved = Object.values(res.transferred || {}).reduce((a, n) => a + Number(n || 0), 0);
      const removed = res.removed_lines?.length ? `, снят участок: ${res.removed_lines.join(', ')}` : '';
      useNotificationStore().showSuccess(
        `Узел ${source} слит в ${target}. Перепривязано участков: ${res.merged_lines ?? 0}, перенесено ссылок: ${moved}${removed}`
      );
      afterTopologyChange();
      mergeConfirmDialogOpen.value = false;
      isMergeMode.value = false;
      mergeTargetNodeId.value = null;
      mergeSourceNodeId.value = null;
      mergePreviewReport.value = null;
    } catch (err: any) {
      // Конфликт версий: узлы изменились после превью — «Перезагрузить» строит превью заново
      reportTopologyError(err, 'Ошибка слияния', openMergePreview);
    } finally {
      mergeLoading.value = false;
    }
  };

  // Превью разрезания линии (dry-run → подтверждение → запись)
  const splitPreviewOpen = ref(false);
  const splitPreviewLoading = ref(false);
  const splitPreviewConfirming = ref(false);
  const splitPreviewError = ref<string | null>(null);
  const splitPreviewReport = ref<SplitTransferReport | null>(null);
  const splitPreviewTarget = ref<{ lineId: number; lng: number; lat: number; version?: string } | null>(null);

  const openSplitPreview = async (lineId: number, lng: number, lat: number) => {
    splitPreviewTarget.value = { lineId, lng, lat };
    splitPreviewReport.value = null;
    splitPreviewError.value = null;
    splitPreviewLoading.value = true;
    splitPreviewOpen.value = true;
    try {
      const preview = await fastApiService.previewSplitLine(lineId, lng, lat);
      splitPreviewReport.value = preview.transferred;
      // версия участка на момент превью — подтверждение применится, только если он не изменился
      splitPreviewTarget.value = { lineId, lng, lat, version: preview.versions?.[`line:${lineId}`] };
    } catch (err: any) {
      splitPreviewError.value = err?.userMessage || err?.message || 'Не удалось получить превью';
    } finally {
      splitPreviewLoading.value = false;
    }
  };

  const confirmSplit = async (reviewToNew: SplitReviewDecision = {}) => {
    const target = splitPreviewTarget.value;
    if (!target) return;
    splitPreviewConfirming.value = true;
    try {
      // решение по оборудованию без узла/позиции — всегда явное ({} — всё на первой половине)
      const result = await fastApiService.splitLine(target.lineId, target.lng, target.lat, target.version, reviewToNew);
      const movedByOperator = Object.values(result.transferred?.review_moved || {})
        .reduce((a: number, ids: any) => a + (ids?.length || 0), 0);
      useNotificationStore().showSuccess(
        `Участок ${target.lineId} разрезан: узел ${result.new_node_id}, участок ${result.new_line_id}`
        + (movedByOperator ? `; на вторую половину перенесено оборудования: ${movedByOperator}` : '')
      );
      afterTopologyChange();
      splitPreviewOpen.value = false;
    } catch (err: any) {
      splitPreviewOpen.value = false;
      reportTopologyError(err, 'Ошибка разрезания', () => openSplitPreview(target.lineId, target.lng, target.lat));
    } finally {
      splitPreviewConfirming.value = false;
      splitPreviewTarget.value = null;
    }
  };

  const cancelSplit = () => {
    splitPreviewTarget.value = null;
  };

  const toggleEditTopologyMode = () => {
    if (!isEditTopologyMode.value && isDrawActive()) {
      useNotificationStore().showWarning('Сначала завершите рисование или измерение на панели рисования.');
      return;
    }
    if (isEditTopologyMode.value && vertexEditor.dirty.value && !confirm('Отказаться от несохранённых изменений вершин?')) return;
    isEditTopologyMode.value = !isEditTopologyMode.value;
    isVertexMode.value = false;
    vertexEditor.stop();
    if (isEditTopologyMode.value) {
      void refreshUndoState();
      topologyStartNode.value = null;
      isTraceMode.value = false;
      setIdentifyMode(false);
      useNotificationStore().showSuccess('Режим редактирования сети включен. Клик по пустому месту — создать узел. Перетаскивание узла — переместить. Клик по двум узлам — создать участок.');
    } else {
      setIdentifyMode(true);
      if (draggedNodeMarker) {
        draggedNodeMarker.remove();
        draggedNodeMarker = null;
      }
      draggedNodeId = null;
      isMergeMode.value = false;
      mergeTargetNodeId.value = null;
      mergeSourceNodeId.value = null;
    }
  };

  const onMapMouseDownForTopology = (e: any) => {
    if (!isEditTopologyMode.value || isDrawActive()) return;
    // Режим вершин: перетаскивание вершин вместо узлов
    if (isVertexMode.value) {
      vertexEditor.onMouseDown(e);
      return;
    }
    // В режиме слияния узлы только выбираются кликом
    if (isMergeMode.value) return;
    const features = getMap()?.queryRenderedFeatures(e.point);
    const nodeFeature = features?.find((feature: any) => getFeatureKind(feature) === 'node');
    
    if (nodeFeature && nodeFeature.properties) {
      const id = getFeatureId(nodeFeature);
      if (!id) return;
      
      // Prevent default panning
      e.preventDefault();
      getMap()?.dragPan.disable();
      
      draggedNodeId = id;
      draggedNodeVersion = fetchTopologyVersion('nodes', id);
      dragStartPoint = { x: e.point.x, y: e.point.y };
      dragMoved = false;
      const pointCoordinates = nodeFeature.geometry?.type === 'Point'
        ? nodeFeature.geometry.coordinates
        : null;
      const coords = Array.isArray(pointCoordinates)
        ? { lng: Number(pointCoordinates[0]), lat: Number(pointCoordinates[1]) }
        : e.lngLat;
      
      // Create marker
      if (draggedNodeMarker) draggedNodeMarker.remove();
      draggedNodeMarker = new maplibregl.Marker({ color: 'red' })
        .setLngLat([coords.lng, coords.lat])
        .addTo(getMap()!);
    }
  };

  /** Привязка в редакторе — только к объектам сети (utils/networkSnap), кроме самого узла */
  const NODE_SNAP_RADIUS_PX = 10;
  const snapToNetwork = (e: any, excludeNodeId: number | null): [number, number] => {
    const map = getMap();
    if (!map) return [e.lngLat.lng, e.lngLat.lat];
    const r = NODE_SNAP_RADIUS_PX;
    const features = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]]);
    const snap = pickNetworkSnap(features, e.point, (c) => map.project(c), r, {
      nodes: excludeNodeId != null ? [excludeNodeId] : [],
    });
    return snap ? snap.coord : [e.lngLat.lng, e.lngLat.lat];
  };

  const onMapMouseMoveForTopology = (e: any) => {
    if (!isEditTopologyMode.value) return;
    if (isVertexMode.value) {
      vertexEditor.onMouseMove(e);
      return;
    }
    if (!draggedNodeMarker || draggedNodeId === null) return;
    if (!dragMoved && dragStartPoint) {
      const dx = e.point.x - dragStartPoint.x;
      const dy = e.point.y - dragStartPoint.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      dragMoved = true;
    }
    draggedNodeMarker.setLngLat(snapToNetwork(e, draggedNodeId));
  };

  const onNodeDragEnd = async () => {
    if (vertexEditor.onMouseUp()) return;
    if (!draggedNodeMarker || !draggedNodeId) return;
    if (!dragMoved) {
      // Сдвига не было: это клик — пусть его обработает onMapClickForTopology
      getMap()?.dragPan.enable();
      draggedNodeMarker.remove();
      draggedNodeMarker = null;
      draggedNodeId = null;
      dragStartPoint = null;
      return;
    }
    
    const lngLat = draggedNodeMarker.getLngLat();
    const id = draggedNodeId;
    
    try {
      useNotificationStore().showInfo('Сохранение новой позиции...');
      const expectedVersion = draggedNodeVersion ? await draggedNodeVersion : undefined;
      await fastApiService.moveNode(id, lngLat.lng, lngLat.lat, expectedVersion);
      useNotificationStore().showSuccess('Узел успешно перемещен');
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка перемещения узла');
    } finally {
      getMap()?.dragPan.enable();
      draggedNodeMarker.remove();
      draggedNodeMarker = null;
      draggedNodeId = null;
      draggedNodeVersion = null;
      dragStartPoint = null;
      dragMoved = false;
      suppressTopologyClickUntil = Date.now() + 250;
    }
  };

  const onMapClickForTopology = async (e: any) => {
    if (!isEditTopologyMode.value || isDrawActive()) return;
    if (draggedNodeId !== null || Date.now() < suppressTopologyClickUntil) return;
    
    const features = getMap()?.queryRenderedFeatures(e.point);
    const nodeFeature = features?.find((feature: any) => getFeatureKind(feature) === 'node');
    const lineFeature = features?.find((feature: any) => getFeatureKind(feature) === 'line');

    // Режим вершин: клик по участку выбирает его для правки (пока правка не закрыта)
    if (isVertexMode.value) {
      if (vertexEditor.active.value) return;
      const lineId = lineFeature ? getFeatureId(lineFeature) : null;
      if (!lineId) {
        useNotificationStore().showInfo('Кликните по участку сети.');
        return;
      }
      try {
        await vertexEditor.load(lineId);
      } catch (err: any) {
        reportTopologyError(err, 'Не удалось загрузить геометрию участка');
      }
      return;
    }
    
    if (nodeFeature && nodeFeature.properties) {
      const id = getFeatureId(nodeFeature);
      if (!id) return;
      
      if (isMergeMode.value) {
        if (!mergeTargetNodeId.value) {
          mergeTargetNodeId.value = id;
          useNotificationStore().showInfo(`Целевой узел ${id} выбран. Теперь кликните узел, который будет слит в него.`);
        } else {
          if (mergeTargetNodeId.value === id) {
            useNotificationStore().showWarning('Нельзя слить узел с самим собой.');
            return;
          }
          mergeSourceNodeId.value = id;
          await openMergePreview();
        }
        return;
      }
      
      // Line creation logic
      if (!topologyStartNode.value) {
        topologyStartNode.value = id;
        topologyStartNodeVersion = fetchTopologyVersion('nodes', id);
        useNotificationStore().showSuccess(`Узел ${id} выбран. Кликните по другому узлу для создания участка.`);
      } else {
        if (topologyStartNode.value === id) {
          topologyStartNode.value = null; // deselect
          useNotificationStore().showInfo('Выбор узла отменен.');
          return;
        }
        // Create line
        try {
          const [startVersion, endVersion] = await Promise.all([
            topologyStartNodeVersion ?? Promise.resolve(undefined),
            fetchTopologyVersion('nodes', id),
          ]);
          const created = await fastApiService.createLine(topologyStartNode.value, id, { nodeid1: startVersion, nodeid2: endVersion });
          // Паспорт трубы (диаметр, конструктив) сервер берёт от смежного/ближайшего участка
          const templateLine = created?.passport?.template_line_id;
          const passportNote = templateLine
            ? `; паспорт трубы скопирован с участка ${templateLine}`
            : '; паспорт трубы по умолчанию — проверьте диаметр';
          useNotificationStore().showSuccess(`Участок между ${topologyStartNode.value} и ${id} создан${passportNote}`);
          afterTopologyChange();
        } catch (err: any) {
          reportTopologyError(err, 'Ошибка создания участка');
        } finally {
          topologyStartNode.value = null;
        }
      }
      return;
    }

    if (isMergeMode.value) {
      useNotificationStore().showInfo('Режим слияния: кликните по узлу.');
      return;
    }

    if (lineFeature && lineFeature.properties) {
      const lineId = getFeatureId(lineFeature);
      if (!lineId) return;
      // Сначала превью (dry-run): показываем, что перенесётся, до записи
      await openSplitPreview(lineId, e.lngLat.lng, e.lngLat.lat);
      return;
    }

    try {
      // Фрагмент, код и признак подачи/обратки сервер берёт у ближайшего узла сети —
      // без них узел не попадёт в расчёт и не сольётся с соседями
      const [lng, lat] = snapToNetwork(e, null);
      const result = await fastApiService.createNode(lng, lat);
      useNotificationStore().showSuccess(`Узел ${result.id} создан (фрагмент ${result.fileid ?? '—'})`);
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка создания узла');
    }
  };

  /** Правый клик в режиме вершин — удалить промежуточную вершину */
  const onMapContextMenuForTopology = (e: any) => {
    if (!isEditTopologyMode.value || !isVertexMode.value) return;
    vertexEditor.onContextMenu(e);
  };

  /**
   * Удаление из карточки: version — версия объекта, запомненная при открытии карточки;
   * meta.kind — вид объекта по карточке (участок/узел), meta.expectedSectionId —
   * heatpipesections.id карточки участка: сервер сверит его с участком (QA F54).
   */
  const onDeleteFeature = async (
    featureId: string | number,
    version?: string,
    meta?: { kind: 'line' | 'node'; expectedSectionId?: number | null }
  ) => {
    const id = Number(featureId);
    if (!Number.isInteger(id) || id <= 0) {
      useNotificationStore().showWarning('Не удалось определить id объекта — удаление отменено.');
      return;
    }
    let kind = meta?.kind;
    if (!kind) {
      const selected = getSelectedFeature();
      if (!selected) return;
      // старый вызов без вида объекта: по имени слоя
      kind = selected.layerId?.includes('node') || selected.layerName?.includes('node') ? 'node' : 'line';
    }
    const what = kind === 'node' ? `узел ${id}` : `участок ${id}`;
    if (!confirm(`Вы уверены, что хотите удалить ${what}?`)) return;
    try {
      if (kind === 'node') {
        await fastApiService.deleteNode(id, version);
        useNotificationStore().showSuccess('Узел и прилегающие участки удалены');
      } else {
        await fastApiService.deleteLine(id, version, meta?.expectedSectionId);
        useNotificationStore().showSuccess('Участок удален');
      }
      closeCard();
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка удаления', () => closeCard());
    }
  };

  /** Подписка на события карты (порядок: mousedown, mousemove, mouseup, click, contextmenu) */
  const attach = (map: maplibregl.Map) => {
    map.on('mousedown', onMapMouseDownForTopology);
    map.on('mousemove', onMapMouseMoveForTopology);
    map.on('mouseup', onNodeDragEnd);
    map.on('click', onMapClickForTopology);
    map.on('contextmenu', onMapContextMenuForTopology);
  };

  const detach = (map: maplibregl.Map | null | undefined) => {
    map?.off('mousedown', onMapMouseDownForTopology);
    map?.off('mousemove', onMapMouseMoveForTopology);
    map?.off('mouseup', onNodeDragEnd);
    map?.off('click', onMapClickForTopology);
    map?.off('contextmenu', onMapContextMenuForTopology);
    if (draggedNodeMarker) draggedNodeMarker.remove();
  };

  if (getCurrentInstance()) onBeforeUnmount(() => detach(getMap()));

  return {
    isEditTopologyMode,
    topologyStartNode,
    isMergeMode,
    mergeTargetNodeId,
    mergeSourceNodeId,
    mergeConfirmDialogOpen,
    mergeLoading,
    mergePreviewReport,
    mergePreviewLoading,
    mergePreviewError,
    lastTopologyOperation,
    undoBusy,
    isVertexMode,
    vertexEditor,
    splitPreviewOpen,
    splitPreviewLoading,
    splitPreviewConfirming,
    splitPreviewError,
    splitPreviewReport,
    splitPreviewTarget,
    refreshUndoState,
    afterTopologyChange,
    onCardRefreshLayers,
    undoLastTopologyOperation,
    reportTopologyError,
    toggleEditTopologyMode,
    toggleVertexMode,
    toggleMergeMode,
    cancelMerge,
    openMergePreview,
    confirmMerge,
    openSplitPreview,
    confirmSplit,
    cancelSplit,
    onDeleteFeature,
    onMapMouseDownForTopology,
    onMapMouseMoveForTopology,
    onNodeDragEnd,
    onMapClickForTopology,
    onMapContextMenuForTopology,
    attach,
    detach,
  };
}
