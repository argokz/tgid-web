import { formatApiError, formatApiErrorWith } from '~/utils/apiError';
import { confirmAction } from '~/composables/useConfirm';
import maplibregl from 'maplibre-gl';
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { ApiError, fastApiService } from '~/services/fastApiService';
import type {
  ChainRequest,
  ChainRequestPoint,
  ChainResult,
  MergeNodesReport,
  SplitReviewDecision,
  SplitTransferReport,
  TopologyUndoEntry,
} from '~/services/fastApiService';
import { useNotificationStore } from '~/stores/notificationStore';
import { useLineVertexEditor } from '~/composables/useLineVertexEditor';
import { pickNetworkFeature } from '~/utils/networkFeature';
import type { PickCandidate, PickOptions } from '~/utils/networkFeature';
import { pickNetworkSnap } from '~/utils/networkSnap';
import { topologyOperationLabel } from '~/utils/topologyLabels';
import { appStorage } from '~/utils/appStorage';
import type { CardKind, CardTemplate } from '~/utils/objectCard';
import { useSnapIndex } from '~/composables/useSnapIndex';
import { useTraceDraw } from '~/composables/useTraceDraw';
import { useContextSnap } from '~/composables/useContextSnap';
import {
  buildingAt,
  buildingOutline,
  buildingStreet,
  entryAddress,
  CONTEXT_MIN_MAP_ZOOM,
  formatApproxM,
  planBuildingEntry,
  type BuildingEntryPlan,
  type ContextBuilding,
} from '~/utils/cadContext';
import { getCityConfig } from '~/utils/cityConfig';
import { NODE_TYPE_ITEMS, nodeTypeTitle, type NodeType } from '~/utils/nodeTypes';
import type { PointCrs } from '~/utils/pointCrs';
import { chainRequestPoints, traceOutcome, type PipeMode, type TracePoint } from '~/utils/cadChain';
import { DEFAULT_POLAR_STEP, POLAR_STEPS } from '~/utils/cadConstraint';
import type { LngLat } from '~/utils/lineVertices';
import { canMoveNodes, editorKeyAction, editorStatusHint, toolAllowed, type EditorTool } from '~/utils/editorTools';
import { canDo, type Permissions } from '~/utils/permissions';
import { useEditSelection } from '~/composables/useEditSelection';
import type { DeleteDone, DeleteTarget, EditorContextAction, EditorContextTarget, ObjectDialog } from '~/utils/editorTools';

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
  /** Фрагменты текущей работы (выбранный/видимые); пусто — показаны все, контекста нет */
  getActiveFragmentIds?: () => readonly number[];
  /**
   * Меню выбора, когда под курсором несколько подходящих объектов (копии в разных фрагментах);
   * null — пользователь отказался. Без него неоднозначный клик отклоняется.
   */
  chooseCandidate?: (candidates: PickCandidate[], point: { x: number; y: number }) => Promise<PickCandidate | null>;
  /** Открыть карточку объекта под курсором (инструмент «Выбор»: опознавание в режиме правки выключено) */
  openCard?: (e: any) => void;
  /** Права пользователя (матрица permissions): недоступные инструменты и действия не включаются */
  getPermissions?: () => Pick<Permissions, 'matrix'>;
}

/** Выделенный объект редактора: на нём работают перетаскивание, Del, F, «Изломы» */
export interface EditSelection {
  kind: 'node' | 'line';
  id: number;
  fragmentId: number | null;
  /** узел — его точка; участок — геометрия для подсветки и «показать» */
  coords: LngLat[];
}

/**
 * Режим редактирования топологии: перенос/создание узлов, создание и разрезание
 * участков, слияние узлов, правка вершин, отмена последней операции.
 * Версии объектов (оптимистичная блокировка) берутся при выборе и уходят в операцию;
 * 409 version_conflict показывается уведомлением с кнопкой «Перезагрузить».
 */
export function useTopologyEditor(options: TopologyEditorOptions) {
  const { getMap, enabled, isTraceMode, isDrawActive, setIdentifyMode, refreshLayers, getSelectedFeature, closeCard } = options;
  const activeFragments = (): readonly number[] => options.getActiveFragmentIds?.() ?? [];

  // === Состояние режима ===
  const isEditTopologyMode = ref(false);
  // Вышел из учётной записи / сервер выключил флаг — режим правки топологии закрывается
  watch(enabled, (on: boolean) => {
    if (!on) isEditTopologyMode.value = false;
  });

  // === Инструмент (один активный, как в ГИС) — прежние флаги режимов производные от него ===
  const activeTool = ref<EditorTool>('select');
  const toolFlag = (tools: EditorTool[], off: EditorTool) => computed<boolean>({
    get: () => tools.includes(activeTool.value),
    set: (on: boolean) => {
      if (on && !tools.includes(activeTool.value)) activeTool.value = tools[0]!;
      else if (!on && tools.includes(activeTool.value)) activeTool.value = off;
    },
  });
  /** Трасса: клики рисуют участки (ввод в здание — её вариант) */
  const isChainMode = toolFlag(['trace', 'entry'], 'select');
  const isMergeMode = toolFlag(['merge'], 'select');
  const isVertexMode = toolFlag(['vertex'], 'select');
  const isEntryMode = toolFlag(['entry'], 'trace');
  const hotkeysHelpOpen = ref(false);

  // === Выделение (инструмент «Выбор») ===
  const selection = ref<EditSelection | null>(null);
  const selectionLayer = useEditSelection(getMap);
  let selectionRequest = 0;
  const showSelection = (sel: EditSelection | null) => {
    if (!sel) selectionLayer.clear();
    else if (sel.kind === 'node') selectionLayer.show({ type: 'Point', coordinates: sel.coords[0]! });
    else if (sel.coords.length >= 2) selectionLayer.show({ type: 'LineString', coordinates: sel.coords });
    else selectionLayer.clear();
  };
  const clearSelection = () => {
    selectionRequest++;
    selection.value = null;
    selectionLayer.clear();
    syncInlineVertices(null, null);
  };
  const featureCoords = (feature: any): LngLat[] => {
    const g = feature?.geometry;
    if (g?.type === 'Point' && Array.isArray(g.coordinates)) return [[Number(g.coordinates[0]), Number(g.coordinates[1])]];
    if (g?.type === 'LineString' && Array.isArray(g.coordinates)) return g.coordinates.map((c: any) => [Number(c[0]), Number(c[1])]);
    return [];
  };
  /** «Выбор»: у выделенного участка — ручки изломов (с правом «Перемещение и изломы» участков) */
  const syncInlineVertices = (kind: 'node' | 'line' | null, id: number | null) => {
    if (activeTool.value !== 'select') return;
    const perms = options.getPermissions?.();
    const allowed = !perms || canDo(perms, 'line', 'move');
    if (kind === 'line' && id != null && allowed && isEditTopologyMode.value) {
      if (vertexEditor.lineId?.value !== id) void loadVertexLine(id);
    } else if (vertexEditor.active.value) {
      vertexEditor.stop();
    }
  };

  /** Выделить объект: узел — сразу, участок — по тайлу, затем точная геометрия с сервера */
  const select = (kind: 'node' | 'line', id: number, fragmentId: number | null, coords: LngLat[]) => {
    const request = ++selectionRequest;
    selection.value = { kind, id, fragmentId, coords };
    showSelection(selection.value);
    syncInlineVertices(kind, id);
    if (kind !== 'line') return;
    void (async () => {
      try {
        const g = await fastApiService.getLineGeometry(id);
        if (request !== selectionRequest || !g?.coordinates?.length) return;
        selection.value = { kind, id, fragmentId, coords: g.coordinates };
        showSelection(selection.value);
      } catch {
        // подсветка по тайлу — достаточно
      }
    })();
  };

  let draggedNodeMarker: maplibregl.Marker | null = null;
  let draggedNodeId: number | null = null;
  // Положение захваченного узла: маркер создаётся, только когда начался сдвиг (QA F52)
  let draggedNodeCoords: [number, number] | null = null;
  // Версия перетаскиваемого узла, запрошенная в момент захвата (mousedown)
  let draggedNodeVersion: Promise<string | undefined> | null = null;
  let suppressTopologyClickUntil = 0;
  // Клик по узлу — это mousedown+mouseup без сдвига: он не должен записывать moveNode
  const DRAG_THRESHOLD_PX = 4;
  let dragStartPoint: { x: number; y: number } | null = null;
  let dragMoved = false;

  // Шаблоны свойств для новых участков и узлов (окно свойств): применяются сразу после создания
  const NEW_LINE_TEMPLATE_KEY = 'topologyNewLineTemplate';
  const NEW_NODE_TEMPLATE_KEY = 'topologyNewNodeTemplate';
  const readTemplateId = (key: string): number | null => {
    try {
      const n = Number(appStorage.getItem(key));
      return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  };
  const rememberTemplateId = (key: string, id: number | null) => {
    try {
      if (id) appStorage.setItem(key, String(id));
      else appStorage.removeItem(key);
    } catch {
      // выбор шаблона — удобство: без хранилища действует до перезагрузки
    }
  };
  const newLineTemplateId = ref<number | null>(readTemplateId(NEW_LINE_TEMPLATE_KEY));
  const newNodeTemplateId = ref<number | null>(readTemplateId(NEW_NODE_TEMPLATE_KEY));
  const lineTemplates = ref<CardTemplate[]>([]);
  const nodeTemplates = ref<CardTemplate[]>([]);
  watch(newLineTemplateId, (id) => rememberTemplateId(NEW_LINE_TEMPLATE_KEY, id));
  watch(newNodeTemplateId, (id) => rememberTemplateId(NEW_NODE_TEMPLATE_KEY, id));
  const loadLineTemplates = async () => {
    const load = async (kind: CardKind): Promise<CardTemplate[]> => {
      try {
        return (await fastApiService.listCardTemplates(kind)).items;
      } catch {
        return [];
      }
    };
    const [lines, nodes] = await Promise.all([load('line'), load('node')]);
    lineTemplates.value = lines;
    nodeTemplates.value = nodes;
    if (newLineTemplateId.value && !lines.some((t) => t.id === newLineTemplateId.value)) newLineTemplateId.value = null;
    if (newNodeTemplateId.value && !nodes.some((t) => t.id === newNodeTemplateId.value)) newNodeTemplateId.value = null;
  };
  watch(isEditTopologyMode, (on) => { if (on) void loadLineTemplates(); });
  /** Применить выбранный шаблон к новому объекту → хвост уведомления */
  const applyNewTemplate = async (templateId: number | null, id: number | undefined | number[]): Promise<string> => {
    const ids = (Array.isArray(id) ? id : [id]).filter((x): x is number => Boolean(x)).map(Number);
    if (!templateId || !ids.length) return '';
    try {
      const applied = await fastApiService.applyCardTemplate(templateId, { ids });
      return `; шаблон «${applied.template.name}»: изменено строк ${applied.changed}`;
    } catch (e) {
      return `; шаблон не применён: ${formatApiError(e, 'ошибка')}`;
    }
  };

  const mergeTargetNodeId = ref<number | null>(null);
  const mergeSourceNodeId = ref<number | null>(null);
  // Фрагмент целевого узла слияния: узел-источник ищется в нём же
  let mergeTargetFragment: number | null = null;
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

  // === Отмена и повтор операций топологии (журнал на сервере, B5) ===
  const lastTopologyOperation = ref<TopologyUndoEntry | null>(null);
  const lastRedoOperation = ref<TopologyUndoEntry | null>(null);
  const undoBusy = ref(false);
  const redoBusy = ref(false);

  const refreshUndoState = async () => {
    if (!enabled.value) {
      lastTopologyOperation.value = null;
      lastRedoOperation.value = null;
      return;
    }
    const safe = async (load: () => Promise<TopologyUndoEntry | null>) => {
      try {
        return (await load()) ?? null;
      } catch {
        return null;
      }
    };
    const [undo, redo] = await Promise.all([
      safe(() => fastApiService.getLastTopologyOperation()),
      // сервер без повтора (старая версия) — кнопка просто недоступна
      safe(() => fastApiService.getLastRedoOperation()),
    ]);
    lastTopologyOperation.value = undo;
    lastRedoOperation.value = redo;
  };

  // === Трасса участков (CAD): полилиния с привязкой, врезкой и режимом трубы ===
  const PIPE_MODE_KEY = 'topologyPipeMode';
  const POLAR_STEP_KEY = 'topologyPolarStep';
  const CONTEXT_SNAP_KEY = 'topologyContextSnap';
  const NEW_NODE_TYPE_KEY = 'topologyNewNodeType';
  const readPipeMode = (): PipeMode => {
    try {
      const v = appStorage.getItem(PIPE_MODE_KEY);
      return v === 'pair' || v === 'supply' || v === 'return' ? v : 'common';
    } catch {
      return 'common';
    }
  };
  const readPolarStep = (): number => {
    try {
      const raw = appStorage.getItem(POLAR_STEP_KEY);
      const v = raw == null || raw === '' ? NaN : Number(raw);
      return POLAR_STEPS.includes(v) ? v : DEFAULT_POLAR_STEP;
    } catch {
      return DEFAULT_POLAR_STEP;
    }
  };
  const pipeMode = ref<PipeMode>(readPipeMode());
  watch(pipeMode, (v) => {
    try {
      appStorage.setItem(PIPE_MODE_KEY, v);
    } catch {
      // режим трубы — удобство: без хранилища действует до перезагрузки
    }
  });
  /** Шаг полярной привязки трассы, градусы; 0 — выкл (Shift — всё равно 90°) */
  const polarStep = ref<number>(readPolarStep());
  watch(polarStep, (v) => {
    try {
      appStorage.setItem(POLAR_STEP_KEY, String(v));
    } catch {
      // шаг — удобство: без хранилища действует до перезагрузки
    }
    trace.refresh();
  });
  /** Привязка к зданиям и улицам подложки и размеры до них (этап C) */
  const contextSnapEnabled = ref<boolean>((() => {
    try {
      return appStorage.getItem(CONTEXT_SNAP_KEY) !== '0';
    } catch {
      return true;
    }
  })());
  /** Тип нового узла: клик в пустоту и конечный новый узел трассы (ввод в здание — всегда потребитель) */
  const newNodeType = ref<NodeType>((() => {
    try {
      const v = appStorage.getItem(NEW_NODE_TYPE_KEY);
      return NODE_TYPE_ITEMS.some((i) => i.value === v) ? (v as NodeType) : 'US';
    } catch {
      return 'US';
    }
  })());
  watch(newNodeType, (v) => {
    try {
      appStorage.setItem(NEW_NODE_TYPE_KEY, v);
    } catch {
      // удобство: без хранилища действует до перезагрузки
    }
  });
  const snapIndex = useSnapIndex(getMap, activeFragments);
  const contextSnap = useContextSnap(getMap);
  const cadNorms = getCityConfig().cadDefaults;
  const trace = useTraceDraw(getMap, snapIndex.index, activeFragments, {
    polarStep,
    context: contextSnap.index,
    contextEnabled: contextSnapEnabled,
    norms: () => cadNorms,
  });
  // сменили рабочий фрагмент — привязка к его объектам, без ожидания сдвига карты
  watch(() => activeFragments().join(','), () => snapIndex.invalidate());
  const chainPreviewOpen = ref(false);
  const chainPreviewLoading = ref(false);
  const chainSaving = ref(false);
  const chainPreview = ref<ChainResult | null>(null);
  const chainPreviewError = ref<string | null>(null);
  let chainPoints: TracePoint[] = [];

  /** После любой операции топологии: обновить слои, привязки и кнопки «Отменить»/«Повторить» */
  const afterTopologyChange = () => {
    refreshLayers();
    snapIndex.invalidate();
    void refreshUndoState();
  };

  /** Карточка объекта сообщает об изменении (разворот, удаление) */
  const onCardRefreshLayers = () => afterTopologyChange();

  const redoLastTopologyOperation = async () => {
    const entry = lastRedoOperation.value;
    if (!entry || redoBusy.value) return;
    redoBusy.value = true;
    try {
      await fastApiService.redoTopologyOperation(entry.operation_id);
      useNotificationStore().showSuccess(`Повторено: ${topologyOperationLabel(entry)}`);
      vertexEditor.stop();
      afterTopologyChange();
    } catch (err: any) {
      if (err instanceof ApiError && err.isVersionConflict) {
        useNotificationStore().showWarning('Повторить нельзя: объекты изменены после отмены.');
      } else {
        reportTopologyError(err, 'Ошибка повтора');
      }
      void refreshUndoState();
    } finally {
      redoBusy.value = false;
    }
  };

  /** Уведомление об операции с кнопкой «Отменить» (отмена именно её, по номеру в журнале) */
  const notifyDone = (message: string, operationId?: number | null) => {
    const notify = useNotificationStore();
    if (!operationId) {
      notify.showSuccess(message);
      return;
    }
    notify.showUndo(message, () => undoOperation(operationId));
  };

  /** Отмена операции по номеру (кнопка в уведомлении): 409 — её объекты уже изменены или она не последняя */
  const undoOperation = async (operationId: number) => {
    try {
      await fastApiService.undoTopologyOperation(operationId);
      useNotificationStore().showSuccess('Отменено');
      vertexEditor.stop();
      clearSelection();
      afterTopologyChange();
    } catch (err: any) {
      if (err instanceof ApiError && err.isVersionConflict) {
        useNotificationStore().showWarning('Отменить нельзя: после неё были другие правки этих объектов (или более поздние операции).');
      } else {
        reportTopologyError(err, 'Ошибка отмены');
      }
      void refreshUndoState();
    }
  };

  const undoLastTopologyOperation = async () => {
    const entry = lastTopologyOperation.value;
    if (!entry || undoBusy.value) return;
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
  const vertexEditor = useLineVertexEditor(getMap, {
    onSaved: (res) => {
      notifyDone(`Геометрия участка ${res.line_id} сохранена, длина ${res.new_length} м`, (res as any).operation_id);
      if (selection.value?.kind === 'line' && selection.value.id === res.line_id) {
        select('line', res.line_id, selection.value.fragmentId, selection.value.coords);
        // редактор закрывается после сохранения — в «Выборе» ручки возвращаются на тот же участок
        void Promise.resolve().then(() => syncInlineVertices('line', res.line_id));
      }
      afterTopologyChange();
    },
    onError: (err, reload) => reportTopologyError(err, 'Ошибка сохранения геометрии', reload),
  });

  const confirmDiscardVertices = () =>
    confirmAction({ text: 'Отказаться от несохранённых изменений вершин?', action: 'Отказаться' });

  /** Загрузить участок в правку изломов */
  const loadVertexLine = async (lineId: number) => {
    try {
      await vertexEditor.load(lineId);
    } catch (err: any) {
      reportTopologyError(err, 'Не удалось загрузить геометрию участка');
    }
  };

  /**
   * Сменить инструмент. Несохранённые изломы — подтверждение; уход из инструмента
   * сбрасывает его состояние (выбор для слияния, ввод в здание, трассу).
   * → false, если оператор отказался
   */
  const setTool = async (tool: EditorTool): Promise<boolean> => {
    const prev = activeTool.value;
    if (prev === tool) return true;
    const perms = options.getPermissions?.();
    if (perms && !toolAllowed(tool, perms)) {
      useNotificationStore().showWarning('Нет права на этот инструмент — спросите администратора.');
      return false;
    }
    if (prev === 'vertex' && vertexEditor.dirty.value && !(await confirmDiscardVertices())) return false;
    if (tool === 'entry' && !canStartEntry()) return false;
    activeTool.value = tool;
    if (prev === 'vertex' || prev === 'select') vertexEditor.stop();
    if (prev === 'merge') {
      mergeTargetNodeId.value = null;
      mergeSourceNodeId.value = null;
      showSelection(selection.value);
    }
    if (prev === 'entry') {
      trace.showEntry(null, null);
      entryHover.value = null;
    }
    if (tool === 'merge' || tool === 'vertex' || tool === 'entry') trace.clear();
    if (isEditTopologyMode.value) applyChainMode();
    // «Изломы» на выделенном участке — сразу его правка; «Выбор» — ручки у выделенного участка
    if (tool === 'vertex' && isEditTopologyMode.value && selection.value?.kind === 'line') {
      await loadVertexLine(selection.value.id);
    }
    if (tool === 'select') syncInlineVertices(selection.value?.kind ?? null, selection.value?.id ?? null);
    return true;
  };

  const toggleVertexMode = () => setTool(isVertexMode.value ? 'select' : 'vertex');

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
    notify.showError(formatApiErrorWith(prefix, err));
  };

  const toggleMergeMode = () => setTool(isMergeMode.value ? 'select' : 'merge');

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
      mergePreviewError.value = formatApiError(err, 'Не удалось получить превью');
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
      notifyDone(
        `Узел ${source} слит в ${target}. Перепривязано участков: ${res.merged_lines ?? 0}, перенесено ссылок: ${moved}${removed}`,
        (res as any).operation_id,
      );
      afterTopologyChange();
      mergeConfirmDialogOpen.value = false;
      mergePreviewReport.value = null;
      // целевой узел остаётся выделенным (выделен при выборе в слиянии)
      await setTool('select');
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
      splitPreviewError.value = formatApiError(err, 'Не удалось получить превью');
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
      notifyDone(
        `Участок ${target.lineId} разрезан: узел ${result.new_node_id}, участок ${result.new_line_id}`
        + (movedByOperator ? `; на вторую половину перенесено оборудования: ${movedByOperator}` : ''),
        (result as any).operation_id,
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

  // === Точка трассы по координатам (исполнительная съёмка, привязка по ведомости) ===
  const coordPointOpen = ref(false);
  /**
   * Пересчитать координаты на сервере, показать место (масштаб не мельче 18), обновить индекс привязок
   * и добавить точку в трассу. → пересчитанная точка и как она легла (узел сети или свободная)
   */
  const addTracePointByCoords = async (crs: PointCrs, x: number, y: number) => {
    if (!chainActive()) throw new Error('Включите режим «Трасса» в правке сети');
    const converted = await fastApiService.convertPoint(crs, x, y);
    const map = getMap();
    if (map) {
      map.jumpTo({ center: [converted.lng, converted.lat], zoom: Math.max(map.getZoom(), 18) });
      await snapIndex.reload();
    }
    const point = trace.addCoord([converted.lng, converted.lat]);
    return { converted, point };
  };

  /** Трасса рисуется: правка сети включена, инструмент «Трасса» (или ввод в здание) */
  const chainActive = () => isEditTopologyMode.value && isChainMode.value;

  /** Индекс привязок и двойной клик карты — по режиму трассы */
  const applyChainMode = () => {
    const map = getMap();
    const on = isEditTopologyMode.value && isChainMode.value;
    if (on) {
      snapIndex.start();
      if (contextSnapEnabled.value) contextSnap.start();
      map?.doubleClickZoom?.disable();
    } else {
      trace.clear();
      snapIndex.stop();
      contextSnap.stop();
      map?.doubleClickZoom?.enable();
      chainPreviewOpen.value = false;
    }
  };

  watch(contextSnapEnabled, (on) => {
    try {
      appStorage.setItem(CONTEXT_SNAP_KEY, on ? '1' : '0');
    } catch {
      // удобство: без хранилища действует до перезагрузки
    }
    if (!on) {
      contextSnap.stop();
      if (isEntryMode.value) void setTool('trace');
    } else if (isEditTopologyMode.value && isChainMode.value) {
      contextSnap.start();
    }
    trace.refresh();
  });

  // === Ввод в здание: клик по зданию → врезка в ближайшую трубу + участок + узел у стены ===
  /** трубы дальше этого от здания не предлагаются, м */
  const ENTRY_MAX_M = 150;
  /** realConsumers.name — varchar(50) */
  const ENTRY_NAME_MAX = 50;
  /** что под курсором в режиме ввода — для бейджа */
  const entryHover = ref<{ building: ContextBuilding; plan: BuildingEntryPlan | null } | null>(null);
  /** пояснение в предпросмотре трассы (ввод в здание) */
  const chainNote = ref<string | null>(null);
  /** ввод в здание: подпись потребителя по адресу с карты (null — не ввод); пишется, только если отмечено */
  const entryAddressText = ref<string | null>(null);
  const entryAddressWrite = ref(false);
  let entryHouseNumber: string | null = null;
  const resetEntryAddress = () => {
    entryAddressText.value = null;
    entryAddressWrite.value = false;
    entryHouseNumber = null;
  };
  /** поля карточки потребителя для конечного узла ввода — только с подтверждением оператора */
  const entryCard = (): Record<string, string> | null => {
    const name = entryAddressText.value?.trim();
    if (entryAddressText.value == null || !entryAddressWrite.value) return null;
    const card: Record<string, string> = {};
    if (name) card.name = name;
    if (entryHouseNumber) card.housenumber = entryHouseNumber;
    return Object.keys(card).length ? card : null;
  };

  const entryHint = computed(() => {
    if (!isEntryMode.value) return '';
    const h = entryHover.value;
    if (!h) return 'Ввод в здание: наведите на здание и кликните';
    const house = h.building.number ? `дом ${h.building.number}: ` : '';
    if (!h.plan) return `${house}трубы ближе ${ENTRY_MAX_M} м нет (рабочий фрагмент, окно карты)`;
    const from = h.plan.nodeId != null ? `от узла ${h.plan.nodeId}` : `врезка в уч. ${h.plan.lineId}`;
    return `${house}${from}, ${formatApproxM(h.plan.lengthM)} до стены — клик: предпросмотр`;
  });

  /** Можно ли войти во «Ввод в здание»: здания берутся с подложки MapTiler */
  const canStartEntry = (): boolean => {
    const map = getMap();
    if (!contextSnapEnabled.value) contextSnapEnabled.value = true;
    if (contextSnap.status.value === 'no-key') {
      useNotificationStore().showWarning('Здания подложки недоступны: не задан ключ MapTiler.');
      return false;
    }
    if (map && map.getZoom() < CONTEXT_MIN_MAP_ZOOM) {
      useNotificationStore().showInfo('Приблизьте карту (масштаб 15 и крупнее): здания берутся с подложки.');
    }
    entryHover.value = null;
    return true;
  };

  const toggleEntryMode = () => setTool(isEntryMode.value ? 'trace' : 'entry');

  const entryAt = (e: any): { building: ContextBuilding; plan: BuildingEntryPlan | null } | null => {
    const ctx = contextSnap.index.value;
    const map = getMap();
    if (!ctx || !map || map.getZoom() < CONTEXT_MIN_MAP_ZOOM) return null;
    const building = buildingAt(ctx, [e.lngLat.lng, e.lngLat.lat]);
    if (!building) return null;
    if (entryHover.value?.building.id === building.id) return entryHover.value;
    const idx = snapIndex.index.value;
    return { building, plan: idx ? planBuildingEntry(idx, building, ENTRY_MAX_M, activeFragments()) : null };
  };

  const onEntryMove = (e: any) => {
    const h = entryAt(e);
    entryHover.value = h;
    trace.showEntry(e, h ? { outline: buildingOutline(h.building), link: h.plan ? [h.plan.tap, h.plan.wall] : null } : null);
  };

  const onEntryClick = async (e: any) => {
    const h = entryAt(e);
    const notify = useNotificationStore();
    if (!h) {
      notify.showInfo(
        contextSnap.status.value === 'zoom-in' || (getMap()?.getZoom() ?? 0) < CONTEXT_MIN_MAP_ZOOM
          ? 'Приблизьте карту: здания для ввода — с масштаба 15.'
          : 'Кликните внутри контура здания.',
      );
      return;
    }
    if (!h.plan) {
      notify.showWarning(`Рядом со зданием (до ${ENTRY_MAX_M} м) нет трубы рабочего фрагмента в окне карты.`);
      return;
    }
    if (h.plan.lengthM < 0.3) {
      notify.showWarning('Труба проходит вплотную к зданию или через него — нарисуйте ввод трассой вручную.');
      return;
    }
    const start: TracePoint = h.plan.nodeId != null
      ? { kind: 'node', coord: h.plan.tap, nodeId: h.plan.nodeId }
      : { kind: 'tap', coord: h.plan.tap, lineId: h.plan.lineId };
    const end: TracePoint = { kind: 'new', coord: h.plan.wall, nodeType: 'PR' };
    trace.showEntry(null, null);
    trace.setPoints([start, end]);
    chainPoints = [start, end];
    const ctx = contextSnap.index.value;
    const street = ctx ? buildingStreet(ctx, h.building) : null;
    entryHouseNumber = h.building.number?.trim() || null;
    entryAddressText.value = entryAddress(street, entryHouseNumber).slice(0, ENTRY_NAME_MAX);
    entryAddressWrite.value = false;
    const house = entryAddressText.value
      ? 'Адрес взят с подложки карты — сверьте его, прежде чем записывать в карточку.'
      : 'Адреса на подложке нет — подпись можно ввести вручную.';
    chainNote.value = `Новый узел у стены здания — потребитель (по подложке MapTiler, ориентировочно ${formatApproxM(h.plan.lengthM)} от трубы). ${house}`;
    await previewChain();
  };

  const toggleChainMode = () => setTool(isChainMode.value ? 'select' : 'trace');

  /** Новый узел в точке (клик в пустоту без трассы) + шаблон для новых узлов; новый узел — выделен */
  const createNodeAt = async ([lng, lat]: LngLat) => {
    try {
      const result = await fastApiService.createNode(lng, lat, { nodeType: newNodeType.value });
      const templateNote = await applyNewTemplate(newNodeTemplateId.value, result.id);
      const typeNote = newNodeType.value !== 'US' ? `, тип: ${nodeTypeTitle(newNodeType.value)}` : '';
      notifyDone(`Узел ${result.id} создан (фрагмент ${result.fileid ?? '—'}${typeNote})${templateNote}`, result.operation_id);
      if (result.id) select('node', Number(result.id), result.fileid ?? null, [[lng, lat]]);
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка создания узла');
    }
  };

  const chainBody = (): ChainRequest => {
    const fragments = activeFragments();
    const points: ChainRequestPoint[] = chainRequestPoints(chainPoints);
    const card = entryCard();
    const last = points[points.length - 1];
    if (card && last?.kind === 'new') points[points.length - 1] = { ...last, card };
    return {
      points,
      pipe_mode: pipeMode.value,
      // один фрагмент на карте — он рабочий: трасса в другом фрагменте — ошибка проверки
      fileid: fragments.length === 1 ? fragments[0] : undefined,
    };
  };

  const previewChain = async () => {
    chainPreview.value = null;
    chainPreviewError.value = null;
    chainPreviewLoading.value = true;
    chainPreviewOpen.value = true;
    try {
      chainPreview.value = await fastApiService.createChain(chainBody(), true);
    } catch (err: any) {
      chainPreviewError.value = formatApiError(err, 'Не удалось проверить трассу');
    } finally {
      chainPreviewLoading.value = false;
    }
  };

  /** Enter / двойной клик / клик по узлу или трубе: один узел, разрезание или цепочка */
  const finishTrace = async () => {
    chainNote.value = null;
    resetEntryAddress();
    const outcome = traceOutcome(trace.points.value);
    if (outcome.action === 'none') {
      trace.clear();
      return;
    }
    if (outcome.action === 'node') {
      trace.clear();
      await createNodeAt(outcome.coord);
      return;
    }
    if (outcome.action === 'split') {
      trace.clear();
      await openSplitPreview(outcome.lineId, outcome.coord[0], outcome.coord[1]);
      return;
    }
    chainPoints = outcome.points;
    const last = chainPoints[chainPoints.length - 1];
    if (last?.kind === 'new' && newNodeType.value !== 'US') {
      chainPoints = [...chainPoints.slice(0, -1), { ...last, nodeType: newNodeType.value }];
      chainNote.value = `Конечный новый узел — ${nodeTypeTitle(newNodeType.value).toLowerCase()}: карточка создастся вместе с трассой.`;
    }
    await previewChain();
  };

  const confirmChain = async () => {
    const preview = chainPreview.value;
    if (!preview?.ok) return;
    // оборудование без позиции на трубах врезки остаётся на первой половине (как предупредил предпросмотр)
    const review = Object.fromEntries(
      preview.issues.filter((i) => i.code === 'review' && i.line_id != null).map((i) => [String(i.line_id), {}]),
    );
    chainSaving.value = true;
    try {
      const res = await fastApiService.createChain({
        ...chainBody(),
        review_to_new: Object.keys(review).length ? review : undefined,
      });
      const lines = res.created_lines ?? [];
      const nodes = res.created_nodes ?? [];
      const lineNote = await applyNewTemplate(newLineTemplateId.value, lines);
      const nodeNote = await applyNewTemplate(newNodeTemplateId.value, nodes);
      const taps = res.split_lines?.length ? `, врезка в ${res.split_lines.join(', ')}` : '';
      notifyDone(
        `Создано участков: ${lines.length} (${res.total_length_m.toFixed(2).replace('.', ',')} м), узлов: ${nodes.length}${taps}${lineNote}${nodeNote}`,
        res.operation_id,
      );
      chainPreviewOpen.value = false;
      trace.clear();
      afterTopologyChange();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.data?.issues)) {
        chainPreview.value = { ...preview, ok: false, issues: err.data.issues };
      } else if (err instanceof ApiError && err.isVersionConflict) {
        reportTopologyError(err, 'Ошибка создания трассы', previewChain);
        chainPreviewOpen.value = false;
      } else {
        chainPreviewError.value = formatApiError(err, 'Не удалось создать трассу');
      }
    } finally {
      chainSaving.value = false;
    }
  };

  /** Закрыть предпросмотр и продолжить рисование (точки остаются) */
  const backToTrace = () => {
    chainPreviewOpen.value = false;
  };

  const discardTrace = () => {
    chainPreviewOpen.value = false;
    trace.clear();
  };

  /** Esc: прервать действие → выйти из инструмента в «Выбор» → снять выделение */
  const escape = async () => {
    switch (activeTool.value) {
      case 'vertex':
        if (vertexEditor.active.value) {
          if (vertexEditor.dirty.value && !(await confirmDiscardVertices())) return;
          vertexEditor.stop();
        } else {
          await setTool('select');
        }
        return;
      case 'merge':
        if (mergeTargetNodeId.value != null) {
          mergeTargetNodeId.value = null;
          clearSelection();
        } else {
          await setTool('select');
        }
        return;
      case 'entry':
        await setTool('trace');
        return;
      case 'select':
        clearSelection();
        closeCard();
        return;
      default:
        await setTool('select');
    }
  };

  /** F — показать выделенное */
  const focusSelection = () => {
    const sel = selection.value;
    const map = getMap();
    if (!sel || !map || !sel.coords.length) return;
    if (sel.coords.length === 1) {
      map.flyTo({ center: sel.coords[0]!, zoom: Math.max(map.getZoom(), 18), duration: 500 });
      return;
    }
    const lngs = sel.coords.map((c) => c[0]);
    const lats = sel.coords.map((c) => c[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 120, maxZoom: 19, duration: 500 });
  };

  /** Del — удалить выделенное */
  const deleteSelection = async () => {
    const sel = selection.value;
    if (!sel) {
      useNotificationStore().showInfo('Выделите узел или участок (инструмент «Выбор», V).');
      return;
    }
    const perms = options.getPermissions?.();
    if (perms && !(sel.kind === 'line' ? canDo(perms, 'line', 'delete')
      : (['node', 'consumer', 'source'] as const).some((k) => canDo(perms, k, 'delete')))) {
      useNotificationStore().showWarning('Нет права на удаление — спросите администратора.');
      return;
    }
    await onDeleteFeature(sel.id, undefined, { kind: sel.kind });
  };

  const isTypingTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
  };

  /** Клавиши редактора (utils/editorTools): инструменты, Esc, Del, F, ?, Ctrl+Z / Ctrl+Y; в трассе — её клавиши */
  const onKeyDown = (ev: KeyboardEvent) => {
    if (!isEditTopologyMode.value || isTypingTarget(ev.target)) return;
    if (chainPreviewOpen.value || splitPreviewOpen.value || mergeConfirmDialogOpen.value || hotkeysHelpOpen.value) return;
    const action = editorKeyAction(ev);
    if (action?.type === 'redo') {
      ev.preventDefault();
      void redoLastTopologyOperation();
      return;
    }
    if (action?.type === 'undo') {
      ev.preventDefault();
      if (chainActive() && trace.active.value) trace.removeLast();
      else void undoLastTopologyOperation();
      return;
    }
    // Esc во время перетаскивания узла — узел остаётся на месте
    if (draggedNodeId !== null && ev.key === 'Escape') {
      ev.preventDefault();
      resetNodeDrag();
      suppressTopologyClickUntil = Date.now() + 250;
      return;
    }
    if (chainActive() && trace.active.value) {
      if (ev.key === 'Shift') {
        trace.setShift(true);
        return;
      }
      // длина и угол с клавиатуры: цифры, Tab, Enter со значением
      if (trace.handleKey(ev)) {
        ev.preventDefault();
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        void finishTrace();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        trace.clear();
      } else if (ev.key === 'Backspace') {
        ev.preventDefault();
        trace.removeLast();
      }
      return;
    }
    if (!action) return;
    ev.preventDefault();
    switch (action.type) {
      case 'tool':
        void setTool(action.tool);
        break;
      case 'escape':
        void escape();
        break;
      case 'delete':
        void deleteSelection();
        break;
      case 'focus':
        focusSelection();
        break;
      case 'help':
        hotkeysHelpOpen.value = true;
        break;
      case 'coords':
        void setTool('trace').then((ok) => { if (ok) coordPointOpen.value = true; });
        break;
      case 'save':
        if (isVertexMode.value && vertexEditor.dirty.value) void vertexEditor.save();
        break;
    }
  };

  const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.key === 'Shift') trace.setShift(false);
  };

  const onMapDblClickForTopology = (e: any) => {
    if (!chainActive() || !trace.active.value) return;
    e.preventDefault?.();
    void finishTrace();
  };

  const toggleEditTopologyMode = async () => {
    if (!isEditTopologyMode.value && isDrawActive()) {
      useNotificationStore().showWarning('Сначала завершите рисование или измерение на панели рисования.');
      return;
    }
    if (isEditTopologyMode.value && vertexEditor.dirty.value && !(await confirmDiscardVertices())) return;
    isEditTopologyMode.value = !isEditTopologyMode.value;
    vertexEditor.stop();
    // слияние, изломы и ввод в здание — одноразовые: правка сети открывается с «Выбора» или «Трассы»
    if (!['select', 'trace', 'node'].includes(activeTool.value)) activeTool.value = 'select';
    mergeTargetNodeId.value = null;
    mergeSourceNodeId.value = null;
    clearSelection();
    if (isEditTopologyMode.value) {
      void refreshUndoState();
      isTraceMode.value = false;
      setIdentifyMode(false);
      applyChainMode();
      // подсказки — в строке состояния, справка по клавишам — «?»
    } else {
      setIdentifyMode(true);
      resetNodeDrag();
      setCursor('');
      applyChainMode();
    }
  };

  /** Курсор карты по инструменту и объекту под ним */
  const setCursor = (cursor: string) => {
    const canvas = getMap()?.getCanvas?.();
    if (canvas && canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  };

  /**
   * Объект сети под курсором (QA F53): единый выбор с учётом фрагмента. Один кандидат — он;
   * несколько — меню выбора (chooseCandidate); только объекты чужих фрагментов — отказ.
   * present — под курсором есть объекты этого вида (тогда клик не идёт дальше: ни разрезания,
   * ни нового узла поверх существующего).
   */
  const pickUnderCursor = async (
    e: any,
    pick: PickOptions,
  ): Promise<{ candidate: PickCandidate | null; present: boolean }> => {
    const res = pickNetworkFeature(getMap()?.queryRenderedFeatures(e.point), pick);
    if (res.status === 'single') return { candidate: res.candidate, present: true };
    const what = pick.kind === 'node' ? 'узлов' : 'участков';
    if (res.status === 'ambiguous') {
      if (!options.chooseCandidate) {
        useNotificationStore().showWarning(`Под курсором несколько ${what} — оставьте на карте один фрагмент.`);
        return { candidate: null, present: true };
      }
      const chosen = await options.chooseCandidate(res.candidates, e.point);
      // пока меню было открыто, режим могли выключить — выбор устарел
      return { candidate: isEditTopologyMode.value ? chosen : null, present: true };
    }
    if (res.reason === 'other-fragment') {
      const fragments = [...new Set(res.others.map((c) => c.fragmentId ?? '—'))].join(', ');
      useNotificationStore().showWarning(
        `Под курсором нет ${what} фрагмента ${(pick.fragmentIds || []).join(', ')} (есть только фрагмента ${fragments}) — операция не выполнена.`
      );
      return { candidate: null, present: true };
    }
    return { candidate: null, present: false };
  };

  const onMapMouseDownForTopology = (e: any) => {
    if (!isEditTopologyMode.value || isDrawActive()) return;
    // Режим вершин: перетаскивание вершин вместо узлов
    if (isVertexMode.value) {
      vertexEditor.onMouseDown(e);
      return;
    }
    // «Выбор»: ручки изломов выделенного участка
    if (activeTool.value === 'select' && vertexEditor.active.value && vertexEditor.onMouseDown(e)) return;
    // «Выделил и тяни»: перетаскивается только выделенный узел в инструменте «Выбор»
    // (трасса, слияние, новый узел — клики; случайный сдвиг узла при работе исключён)
    const sel = selection.value;
    if (activeTool.value !== 'select' || sel?.kind !== 'node') return;
    const perms = options.getPermissions?.();
    if (perms && !canMoveNodes(perms)) return;
    // Тянуть можно только однозначный узел активного фрагмента; копии в нескольких
    // фрагментах — без перетаскивания (клик откроет меню выбора)
    const res = pickNetworkFeature(getMap()?.queryRenderedFeatures(e.point), {
      kind: 'node',
      fragmentIds: activeFragments(),
      strictFragment: true,
    });
    if (res.status !== 'single' || res.candidate.id !== sel.id) return;
    const { id, feature } = res.candidate;

    // Prevent default panning
    e.preventDefault();
    getMap()?.dragPan.disable();

    draggedNodeId = id;
    draggedNodeVersion = fetchTopologyVersion('nodes', id);
    dragStartPoint = { x: e.point.x, y: e.point.y };
    dragMoved = false;
    const pointCoordinates = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
    draggedNodeCoords = Array.isArray(pointCoordinates)
      ? [Number(pointCoordinates[0]), Number(pointCoordinates[1])]
      : [e.lngLat.lng, e.lngLat.lat];
    // Маркер не создаётся до начала сдвига: элемент под курсором между mousedown и mouseup
    // (и его удаление на mouseup) съедал click, и узел не выбирался (QA F52)
  };

  /** Привязка в редакторе — только к объектам сети (utils/networkSnap), кроме самого узла */
  const NODE_SNAP_RADIUS_PX = 10;
  const snapToNetwork = (e: any, excludeNodeId: number | null): [number, number] => {
    const map = getMap();
    // Alt — без привязки
    if (!map || e.originalEvent?.altKey) return [e.lngLat.lng, e.lngLat.lat];
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
    if (activeTool.value === 'select' && vertexEditor.onMouseMove(e)) return;
    if (draggedNodeId === null) {
      if (chainActive() && isEntryMode.value && !trace.active.value) onEntryMove(e);
      else if (chainActive()) trace.onMove(e);
      updateHoverCursor(e);
      return;
    }
    if (!dragMoved && dragStartPoint) {
      const dx = e.point.x - dragStartPoint.x;
      const dy = e.point.y - dragStartPoint.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      dragMoved = true;
    }
    if (!draggedNodeMarker) {
      const map = getMap();
      if (!map) return;
      draggedNodeMarker = new maplibregl.Marker({ color: 'red' })
        .setLngLat(draggedNodeCoords ?? [e.lngLat.lng, e.lngLat.lat])
        .addTo(map);
    }
    draggedNodeMarker.setLngLat(snapToNetwork(e, draggedNodeId));
  };

  /** Курсор: «Выбор» — рука над объектом сети, перекрестие-перемещение над выделенным узлом; рисование — прицел */
  const updateHoverCursor = (e: any) => {
    if (activeTool.value === 'trace' || activeTool.value === 'node' || activeTool.value === 'entry') {
      setCursor('crosshair');
      return;
    }
    const features = getMap()?.queryRenderedFeatures?.(e.point);
    const node = pickNetworkFeature(features, { kind: 'node', fragmentIds: activeFragments() });
    if (activeTool.value === 'select' && node.status === 'single'
      && selection.value?.kind === 'node' && node.candidate.id === selection.value.id) {
      setCursor('move');
      return;
    }
    if (node.status !== 'none') {
      setCursor('pointer');
      return;
    }
    const line = activeTool.value === 'merge' ? null : pickNetworkFeature(features, { kind: 'line', fragmentIds: activeFragments() });
    setCursor(line && line.status !== 'none' ? 'pointer' : '');
  };

  const resetNodeDrag = () => {
    getMap()?.dragPan.enable();
    draggedNodeMarker?.remove();
    draggedNodeMarker = null;
    draggedNodeId = null;
    draggedNodeCoords = null;
    draggedNodeVersion = null;
    dragStartPoint = null;
    dragMoved = false;
  };

  const onNodeDragEnd = async () => {
    if (vertexEditor.onMouseUp()) {
      // «Выбор»: излом сохраняется сразу (Ctrl+Z — отмена)
      if (activeTool.value === 'select' && vertexEditor.dirty.value) void vertexEditor.save();
      suppressTopologyClickUntil = Date.now() + 250;
      return;
    }
    if (draggedNodeId === null) return;
    if (!dragMoved || !draggedNodeMarker) {
      // Сдвига не было: это клик — его обработает onMapClickForTopology (выбор узла)
      resetNodeDrag();
      return;
    }

    const lngLat = draggedNodeMarker.getLngLat();
    const id = draggedNodeId;
    const versionPromise = draggedNodeVersion;

    try {
      const expectedVersion = versionPromise ? await versionPromise : undefined;
      const moved = await fastApiService.moveNode(id, lngLat.lng, lngLat.lat, expectedVersion);
      notifyDone(`Узел ${id} перемещён`, (moved as any)?.operation_id);
      if (selection.value?.kind === 'node' && selection.value.id === id) {
        select('node', id, selection.value.fragmentId, [[lngLat.lng, lngLat.lat]]);
      }
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка перемещения узла');
    } finally {
      resetNodeDrag();
      suppressTopologyClickUntil = Date.now() + 250;
    }
  };

  /** Слияние: первый узел — целевой (выделяется), второй — сливаемый → предпросмотр */
  const onMergeNodeClick = async (node: PickCandidate) => {
    const id = node.id;
    if (!mergeTargetNodeId.value) {
      mergeTargetNodeId.value = id;
      mergeTargetFragment = node.fragmentId;
      select('node', id, node.fragmentId, featureCoords(node.feature));
      return;
    }
    if (mergeTargetNodeId.value === id) {
      useNotificationStore().showWarning('Нельзя слить узел с самим собой.');
      return;
    }
    mergeSourceNodeId.value = id;
    await openMergePreview();
  };

  /** Фрагмент, в котором ищется сливаемый узел — как у целевого */
  const nodeContextFragments = (): readonly number[] => {
    const anchor = isMergeMode.value && mergeTargetNodeId.value ? mergeTargetFragment : null;
    return anchor ? [anchor] : activeFragments();
  };

  /**
   * «Выбор» (и «Узел» по объекту): узел важнее участка; пусто — снять выделение.
   * → true, если щелчок пришёлся на объект сети (выбран или отклонён)
   */
  const selectUnderCursor = async (e: any): Promise<boolean> => {
    const node = await pickUnderCursor(e, { kind: 'node', fragmentIds: activeFragments(), strictFragment: true });
    if (node.candidate) {
      select('node', node.candidate.id, node.candidate.fragmentId, featureCoords(node.candidate.feature));
      options.openCard?.(e);
      return true;
    }
    if (node.present) return true;
    const line = await pickUnderCursor(e, { kind: 'line', fragmentIds: activeFragments(), strictFragment: true });
    if (line.candidate) {
      select('line', line.candidate.id, line.candidate.fragmentId, featureCoords(line.candidate.feature));
      options.openCard?.(e);
      return true;
    }
    return line.present;
  };

  const onMapClickForTopology = async (e: any) => {
    if (!isEditTopologyMode.value || isDrawActive()) return;
    if (draggedNodeId !== null || Date.now() < suppressTopologyClickUntil) return;

    switch (activeTool.value) {
      case 'vertex': {
        // клик по участку выбирает его для правки (пока правка не закрыта)
        if (vertexEditor.active.value) return;
        const { candidate, present } = await pickUnderCursor(e, {
          kind: 'line',
          fragmentIds: activeFragments(),
          strictFragment: true,
        });
        if (!candidate) {
          if (!present) useNotificationStore().showInfo('Щёлкните по участку сети.');
          return;
        }
        select('line', candidate.id, candidate.fragmentId, featureCoords(candidate.feature));
        await loadVertexLine(candidate.id);
        return;
      }
      case 'trace':
      case 'entry': {
        if (snapIndex.status.value !== 'ready') {
          useNotificationStore().showWarning(
            snapIndex.status.value === 'zoom-in'
              ? 'Приблизьте карту: привязка к сети работает на окне до 6 км.'
              : 'Данные привязки ещё загружаются — подождите секунду.',
          );
          return;
        }
        if (isEntryMode.value && !trace.active.value) {
          await onEntryClick(e);
          return;
        }
        if (trace.onClick(e)) await finishTrace();
        return;
      }
      case 'merge': {
        const node = await pickUnderCursor(e, { kind: 'node', fragmentIds: nodeContextFragments(), strictFragment: true });
        if (node.candidate) await onMergeNodeClick(node.candidate);
        else if (!node.present) useNotificationStore().showInfo('Слияние: щёлкните по узлу.');
        return;
      }
      case 'node': {
        // по объекту сети — выделить (новый узел поверх существующего не ставится)
        if (await selectUnderCursor(e)) return;
        // Фрагмент, код и признак подачи/обратки сервер берёт у ближайшего узла сети —
        // без них узел не попадёт в расчёт и не сольётся с соседями
        await createNodeAt(snapToNetwork(e, null));
        return;
      }
      default: {
        if (await selectUnderCursor(e)) return;
        clearSelection();
        closeCard();
      }
    }
  };

  // === Контекстное меню (правый щелчок): действия с узлом, участком или точкой карты ===
  const contextMenu = ref<EditorContextTarget | null>(null);
  const contextMenuOpen = ref(false);
  let contextCandidate: PickCandidate | null = null;
  let contextEvent: any = null;

  /** Правый щелчок: в «Изломах» — убрать излом; иначе — выделить объект под курсором и показать меню */
  const onMapContextMenuForTopology = async (e: any) => {
    if (!isEditTopologyMode.value) return;
    if (isVertexMode.value) {
      vertexEditor.onContextMenu(e);
      return;
    }
    if (chainActive() && trace.active.value) return;
    e.preventDefault?.();
    e.originalEvent?.preventDefault?.();
    // правый щелчок по излому выделенного участка — убрать излом (сохраняется сразу)
    if (activeTool.value === 'select' && vertexEditor.active.value && vertexEditor.onContextMenu(e)) {
      void vertexEditor.save();
      return;
    }
    const lngLat: LngLat = [e.lngLat.lng, e.lngLat.lat];
    const pos = { clientX: e.originalEvent?.clientX ?? e.point.x, clientY: e.originalEvent?.clientY ?? e.point.y };
    contextCandidate = null;
    contextEvent = e;
    const node = await pickUnderCursor(e, { kind: 'node', fragmentIds: activeFragments(), strictFragment: true });
    const line = node.candidate || node.present
      ? { candidate: null, present: false }
      : await pickUnderCursor(e, { kind: 'line', fragmentIds: activeFragments(), strictFragment: true });
    const picked = node.candidate ?? line.candidate;
    if (!picked && (node.present || line.present)) return; // отказались в меню выбора / чужой фрагмент
    if (activeTool.value !== 'select') await setTool('select');
    if (picked) {
      const kind = node.candidate ? 'node' : 'line';
      contextCandidate = picked;
      select(kind, picked.id, picked.fragmentId, featureCoords(picked.feature));
      contextMenu.value = { kind, id: picked.id, fragmentId: picked.fragmentId, lngLat,
        coords: featureCoords(picked.feature), ...pos };
    } else {
      contextMenu.value = { kind: 'map', id: null, fragmentId: null, lngLat, coords: [], ...pos };
    }
    contextMenuOpen.value = true;
  };

  /** Окна «Тип узла», «Тип линии», «Отводы» из меню (их же кнопки — в карточке) */
  const objectDialog = ref<ObjectDialog | null>(null);
  const closeObjectDialog = () => {
    objectDialog.value = null;
  };
  const onObjectDialogChanged = (message: string) => {
    useNotificationStore().showSuccess(message);
    afterTopologyChange();
  };
  /** «Открыть карточку» из окна типа — свойства объекта под меню */
  const onObjectDialogEditCard = () => {
    objectDialog.value = null;
    if (contextEvent) options.openCard?.(contextEvent);
  };

  /** Начать трассу из точки (узел — от него, труба — врезкой, карта — новый узел) */
  const traceFrom = async (coord: LngLat) => {
    if (!(await setTool('trace'))) return;
    await snapIndex.reload();
    trace.addCoord(coord);
  };

  const runContextAction = async (action: EditorContextAction) => {
    const m = contextMenu.value;
    contextMenuOpen.value = false;
    if (!m) return;
    const point: LngLat = m.kind === 'node' && m.coords[0] ? m.coords[0] : m.lngLat;
    switch (action) {
      case 'props':
        if (contextEvent) options.openCard?.(contextEvent);
        break;
      case 'trace-from':
        await traceFrom(point);
        break;
      case 'merge-into':
        if (contextCandidate && (await setTool('merge'))) await onMergeNodeClick(contextCandidate);
        break;
      case 'focus':
        focusSelection();
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(`${point[1].toFixed(6)}, ${point[0].toFixed(6)}`);
          useNotificationStore().showSuccess(`Скопировано: ${point[1].toFixed(6)}, ${point[0].toFixed(6)}`);
        } catch {
          useNotificationStore().showWarning('Буфер обмена недоступен');
        }
        break;
      case 'dissolve':
      case 'delete':
        if (m.id != null && m.kind !== 'map') await onDeleteFeature(m.id, undefined, { kind: m.kind });
        break;
      case 'vertices':
        await setTool('vertex');
        break;
      case 'split-here':
        if (m.id != null) await openSplitPreview(m.id, m.lngLat[0], m.lngLat[1]);
        break;
      case 'node-here':
        await createNodeAt(contextEvent ? snapToNetwork(contextEvent, null) : m.lngLat);
        break;
      case 'node-type':
      case 'line-type':
      case 'bends':
        if (m.id != null) objectDialog.value = { kind: action, id: m.id };
        break;
    }
  };

  /**
   * Удаление из карточки: version — версия объекта, запомненная при открытии карточки;
   * meta.kind — вид объекта по карточке (участок/узел), meta.expectedSectionId —
   * heatpipesections.id карточки участка: сервер сверит его с участком (QA F54).
   */
  // === Удаление: окно предпросмотра (DeletePreviewDialog) — «убрать узел, соединив трубы» или с участками ===
  const deleteTarget = ref<DeleteTarget | null>(null);
  const deleteOpen = ref(false);
  /**
   * Удаление из карточки, клавишей Del или из меню: version — версия объекта из карточки;
   * meta.kind — вид объекта, meta.expectedSectionId — heatpipesections.id карточки (QA F54).
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
    deleteTarget.value = { kind, id, version, expectedSectionId: meta?.expectedSectionId ?? null };
    deleteOpen.value = true;
  };

  const onDeleteDone = (done: DeleteDone) => {
    notifyDone(done.message, done.operationId);
    if (selection.value?.id === done.id && selection.value.kind === done.kind) clearSelection();
    closeCard();
    afterTopologyChange();
  };

  const onDeleteFailed = (err: unknown) => reportTopologyError(err, 'Ошибка удаления', () => closeCard());

  /** Подписка на события карты (порядок: mousedown, mousemove, mouseup, click, contextmenu) */
  const attach = (map: maplibregl.Map) => {
    map.on('mousedown', onMapMouseDownForTopology);
    map.on('mousemove', onMapMouseMoveForTopology);
    map.on('mouseup', onNodeDragEnd);
    map.on('click', onMapClickForTopology);
    map.on('contextmenu', onMapContextMenuForTopology);
    map.on('dblclick', onMapDblClickForTopology);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
    }
  };

  const detach = (map: maplibregl.Map | null | undefined) => {
    map?.off('mousedown', onMapMouseDownForTopology);
    map?.off('mousemove', onMapMouseMoveForTopology);
    map?.off('mouseup', onNodeDragEnd);
    map?.off('click', onMapClickForTopology);
    map?.off('contextmenu', onMapContextMenuForTopology);
    map?.off('dblclick', onMapDblClickForTopology);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
    trace.clear();
    snapIndex.stop();
    contextSnap.stop();
    isEntryMode.value = false;
    if (draggedNodeMarker) draggedNodeMarker.remove();
  };

  if (getCurrentInstance()) onBeforeUnmount(() => detach(getMap()));

  /** Строка состояния: что делать дальше в текущем инструменте */
  const statusHint = computed(() => editorStatusHint({
    tool: activeTool.value,
    selection: selection.value ? { kind: selection.value.kind, id: selection.value.id } : null,
    tracing: trace.active.value,
    vertexLineId: vertexEditor.active.value ? (vertexEditor.lineId?.value ?? null) : null,
    vertexDirty: vertexEditor.dirty.value,
    mergeTarget: mergeTargetNodeId.value,
    nodeTypeTitle: nodeTypeTitle(newNodeType.value),
    entryHint: entryHint.value,
  }));

  return {
    isEditTopologyMode,
    activeTool,
    setTool,
    selection,
    clearSelection,
    statusHint,
    hotkeysHelpOpen,
    deleteTarget,
    deleteOpen,
    contextMenu,
    contextMenuOpen,
    runContextAction,
    objectDialog,
    closeObjectDialog,
    onObjectDialogChanged,
    onObjectDialogEditCard,
    onDeleteDone,
    onDeleteFailed,
    undoOperation,
    focusSelection,
    deleteSelection,
    escape,
    isMergeMode,
    newLineTemplateId,
    newNodeTemplateId,
    lineTemplates,
    nodeTemplates,
    loadLineTemplates,
    mergeTargetNodeId,
    mergeSourceNodeId,
    mergeConfirmDialogOpen,
    mergeLoading,
    mergePreviewReport,
    mergePreviewLoading,
    mergePreviewError,
    lastTopologyOperation,
    lastRedoOperation,
    undoBusy,
    redoBusy,
    isChainMode,
    pipeMode,
    polarStep,
    snapIndex,
    contextSnap,
    contextSnapEnabled,
    newNodeType,
    coordPointOpen,
    addTracePointByCoords,
    cadNorms,
    isEntryMode,
    entryHint,
    chainNote,
    entryAddressText,
    entryAddressWrite,
    toggleEntryMode,
    trace,
    chainPreviewOpen,
    chainPreviewLoading,
    chainSaving,
    chainPreview,
    chainPreviewError,
    toggleChainMode,
    finishTrace,
    confirmChain,
    backToTrace,
    discardTrace,
    redoLastTopologyOperation,
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
