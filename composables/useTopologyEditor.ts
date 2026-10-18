import { formatApiError, formatApiErrorWith } from '~/utils/apiError';
import { confirmAction } from '~/composables/useConfirm';
import maplibregl from 'maplibre-gl';
import { getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { ApiError, fastApiService } from '~/services/fastApiService';
import type {
  ChainRequest,
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
import { chainRequestPoints, traceOutcome, type PipeMode, type TracePoint } from '~/utils/cadChain';
import { DEFAULT_POLAR_STEP, POLAR_STEPS } from '~/utils/cadConstraint';
import type { LngLat } from '~/utils/lineVertices';

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
  const topologyStartNode = ref<number | null>(null);
  // Фрагмент начального узла: второй узел участка ищется в нём же (QA F53)
  let topologyStartNodeFragment: number | null = null;
  // Версия начального узла нового участка — запрашивается при его выборе
  let topologyStartNodeVersion: Promise<string | undefined> | null = null;
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

  const isMergeMode = ref(false);
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
  /** Трасса: клики рисуют участки (иначе — прежний режим «узел → узел») */
  const isChainMode = ref(true);
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
  const snapIndex = useSnapIndex(getMap, activeFragments);
  const trace = useTraceDraw(getMap, snapIndex.index, activeFragments, { polarStep });
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
  const isVertexMode = ref(false);
  const vertexEditor = useLineVertexEditor(getMap, {
    onSaved: (res) => {
      useNotificationStore().showSuccess(`Геометрия участка ${res.line_id} сохранена, длина ${res.new_length} м`);
      afterTopologyChange();
    },
    onError: (err, reload) => reportTopologyError(err, 'Ошибка сохранения геометрии', reload),
  });

  const confirmDiscardVertices = () =>
    confirmAction({ text: 'Отказаться от несохранённых изменений вершин?', action: 'Отказаться' });

  const toggleVertexMode = async () => {
    if (isVertexMode.value && vertexEditor.dirty.value && !(await confirmDiscardVertices())) return;
    isVertexMode.value = !isVertexMode.value;
    vertexEditor.stop();
    if (isVertexMode.value) {
      isMergeMode.value = false;
      mergeTargetNodeId.value = null;
      mergeSourceNodeId.value = null;
      topologyStartNode.value = null;
      trace.clear();
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
    notify.showError(formatApiErrorWith(prefix, err));
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
      trace.clear();
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

  /** Трасса рисуется: правка сети включена, не режим вершин и не слияние */
  const chainActive = () => isEditTopologyMode.value && isChainMode.value && !isVertexMode.value && !isMergeMode.value;

  /** Индекс привязок и двойной клик карты — по режиму трассы */
  const applyChainMode = () => {
    const map = getMap();
    const on = isEditTopologyMode.value && isChainMode.value;
    if (on) {
      snapIndex.start();
      map?.doubleClickZoom?.disable();
    } else {
      trace.clear();
      snapIndex.stop();
      map?.doubleClickZoom?.enable();
      chainPreviewOpen.value = false;
    }
  };

  const toggleChainMode = () => {
    isChainMode.value = !isChainMode.value;
    topologyStartNode.value = null;
    applyChainMode();
  };

  /** Новый узел в точке (клик в пустоту без трассы) + шаблон для новых узлов */
  const createNodeAt = async ([lng, lat]: LngLat) => {
    try {
      const result = await fastApiService.createNode(lng, lat);
      const templateNote = await applyNewTemplate(newNodeTemplateId.value, result.id);
      useNotificationStore().showSuccess(`Узел ${result.id} создан (фрагмент ${result.fileid ?? '—'})${templateNote}`);
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка создания узла');
    }
  };

  const chainBody = (): ChainRequest => {
    const fragments = activeFragments();
    return {
      points: chainRequestPoints(chainPoints),
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
      useNotificationStore().showSuccess(
        `Создано участков: ${lines.length} (${res.total_length_m.toFixed(2).replace('.', ',')} м), узлов: ${nodes.length}${taps}${lineNote}${nodeNote}`,
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

  /** Клавиши редактора: Enter/Esc/Backspace — трасса; Ctrl+Z / Ctrl+Y — отмена и повтор */
  const onKeyDown = (ev: KeyboardEvent) => {
    if (!isEditTopologyMode.value) return;
    const target = ev.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (chainPreviewOpen.value || splitPreviewOpen.value || mergeConfirmDialogOpen.value) return;
    const ctrl = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();
    if (ctrl && (key === 'y' || (key === 'z' && ev.shiftKey))) {
      ev.preventDefault();
      void redoLastTopologyOperation();
      return;
    }
    if (ctrl && key === 'z') {
      ev.preventDefault();
      if (chainActive() && trace.active.value) trace.removeLast();
      else void undoLastTopologyOperation();
      return;
    }
    if (!chainActive() || !trace.active.value) return;
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
    isVertexMode.value = false;
    vertexEditor.stop();
    if (isEditTopologyMode.value) {
      void refreshUndoState();
      topologyStartNode.value = null;
      isTraceMode.value = false;
      setIdentifyMode(false);
      applyChainMode();
      useNotificationStore().showSuccess(
        isChainMode.value
          ? 'Редактирование сети: кликайте точки трассы — узел, изломы, узел или труба (врезка). '
            + 'Enter или двойной клик — завершить в пустом месте, Backspace — убрать точку, Esc — сбросить. '
            + 'Перетаскивание узла — переместить.'
          : 'Режим редактирования сети включен. Клик по пустому месту — создать узел. Перетаскивание узла — переместить. Клик по двум узлам — создать участок.'
      );
    } else {
      setIdentifyMode(true);
      resetNodeDrag();
      isMergeMode.value = false;
      mergeTargetNodeId.value = null;
      mergeSourceNodeId.value = null;
      applyChainMode();
    }
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
    // В режиме слияния узлы только выбираются кликом
    if (isMergeMode.value) return;
    // Трасса рисуется — карта не тянет узлы, клики ставят точки
    if (chainActive() && trace.active.value) return;
    // Тянуть можно только однозначный узел активного фрагмента; копии в нескольких
    // фрагментах — без перетаскивания (клик откроет меню выбора)
    const res = pickNetworkFeature(getMap()?.queryRenderedFeatures(e.point), {
      kind: 'node',
      fragmentIds: activeFragments(),
      strictFragment: true,
    });
    if (res.status !== 'single') return;
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
    if (draggedNodeId === null) {
      if (chainActive()) trace.onMove(e);
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
    if (vertexEditor.onMouseUp()) return;
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
      useNotificationStore().showInfo('Сохранение новой позиции...');
      const expectedVersion = versionPromise ? await versionPromise : undefined;
      await fastApiService.moveNode(id, lngLat.lng, lngLat.lat, expectedVersion);
      useNotificationStore().showSuccess('Узел успешно перемещен');
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка перемещения узла');
    } finally {
      resetNodeDrag();
      suppressTopologyClickUntil = Date.now() + 250;
    }
  };

  /** Клик по узлу: выбор для слияния или концов нового участка */
  const onNodeClick = async (node: PickCandidate) => {
    const id = node.id;
    if (isMergeMode.value) {
      if (!mergeTargetNodeId.value) {
        mergeTargetNodeId.value = id;
        mergeTargetFragment = node.fragmentId;
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
      topologyStartNodeFragment = node.fragmentId;
      topologyStartNodeVersion = fetchTopologyVersion('nodes', id);
      useNotificationStore().showSuccess(
        `Узел ${id}${node.fragmentId ? ` (фрагмент ${node.fragmentId})` : ''} выбран. Кликните по другому узлу для создания участка.`
      );
      return;
    }
    if (topologyStartNode.value === id) {
      topologyStartNode.value = null; // deselect
      useNotificationStore().showInfo('Выбор узла отменен.');
      return;
    }
    // Create line
    const startId = topologyStartNode.value;
    try {
      const [startVersion, endVersion] = await Promise.all([
        topologyStartNodeVersion ?? Promise.resolve(undefined),
        fetchTopologyVersion('nodes', id),
      ]);
      const created = await fastApiService.createLine(startId, id, { nodeid1: startVersion, nodeid2: endVersion });
      // Паспорт трубы (диаметр, конструктив) сервер берёт от смежного/ближайшего участка
      const templateLine = created?.passport?.template_line_id;
      const passportNote = templateLine
        ? `; паспорт трубы скопирован с участка ${templateLine}`
        : '; паспорт трубы по умолчанию — проверьте диаметр';
      const templateNote = await applyNewTemplate(newLineTemplateId.value, created?.id);
      useNotificationStore().showSuccess(`Участок между ${startId} и ${id} создан${passportNote}${templateNote}`);
      afterTopologyChange();
    } catch (err: any) {
      reportTopologyError(err, 'Ошибка создания участка');
    } finally {
      topologyStartNode.value = null;
    }
  };

  /** Фрагмент, в котором ищется следующий узел: второй конец участка / источник слияния — как первый */
  const nodeContextFragments = (): readonly number[] => {
    const anchor = isMergeMode.value
      ? (mergeTargetNodeId.value ? mergeTargetFragment : null)
      : (topologyStartNode.value ? topologyStartNodeFragment : null);
    return anchor ? [anchor] : activeFragments();
  };

  const onMapClickForTopology = async (e: any) => {
    if (!isEditTopologyMode.value || isDrawActive()) return;
    if (draggedNodeId !== null || Date.now() < suppressTopologyClickUntil) return;

    // Режим вершин: клик по участку выбирает его для правки (пока правка не закрыта)
    if (isVertexMode.value) {
      if (vertexEditor.active.value) return;
      const { candidate, present } = await pickUnderCursor(e, {
        kind: 'line',
        fragmentIds: activeFragments(),
        strictFragment: true,
      });
      if (!candidate) {
        if (!present) useNotificationStore().showInfo('Кликните по участку сети.');
        return;
      }
      try {
        await vertexEditor.load(candidate.id);
      } catch (err: any) {
        reportTopologyError(err, 'Не удалось загрузить геометрию участка');
      }
      return;
    }

    if (chainActive()) {
      if (snapIndex.status.value !== 'ready') {
        useNotificationStore().showWarning(
          snapIndex.status.value === 'zoom-in'
            ? 'Приблизьте карту: привязка к сети работает на окне до 6 км.'
            : 'Данные привязки ещё загружаются — подождите секунду.',
        );
        return;
      }
      if (trace.onClick(e)) await finishTrace();
      return;
    }

    const node = await pickUnderCursor(e, { kind: 'node', fragmentIds: nodeContextFragments(), strictFragment: true });
    if (node.candidate) {
      await onNodeClick(node.candidate);
      return;
    }
    // Под курсором узлы, но выбор не сделан (чужой фрагмент, отказ в меню) — ничего не делаем
    if (node.present) return;

    if (isMergeMode.value) {
      useNotificationStore().showInfo('Режим слияния: кликните по узлу.');
      return;
    }

    const line = await pickUnderCursor(e, { kind: 'line', fragmentIds: activeFragments(), strictFragment: true });
    if (line.candidate) {
      // Сначала превью (dry-run): показываем, что перенесётся, до записи
      await openSplitPreview(line.candidate.id, e.lngLat.lng, e.lngLat.lat);
      return;
    }
    if (line.present) return;

    // Фрагмент, код и признак подачи/обратки сервер берёт у ближайшего узла сети —
    // без них узел не попадёт в расчёт и не сольётся с соседями
    await createNodeAt(snapToNetwork(e, null));
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
    const tail = kind === 'node' ? ' Прилегающие участки будут удалены вместе с ним.' : '';
    if (!(await confirmAction({ text: `Удалить ${what}?${tail}`, action: 'Удалить' }))) return;
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
    if (draggedNodeMarker) draggedNodeMarker.remove();
  };

  if (getCurrentInstance()) onBeforeUnmount(() => detach(getMap()));

  return {
    isEditTopologyMode,
    topologyStartNode,
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
