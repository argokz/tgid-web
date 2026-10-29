/** Правка сети (топология, CAD). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { SnapData } from '~/utils/cadSnap';
import type { NodeFlag, NodeFlagResult, NodeType, NodeTypeChangeResult, NodeTypeInfo } from '~/utils/nodeTypes';
import type { LineType, LineTypeChangeResult, LineTypeInfo } from '~/utils/lineTypes';
import type { LineBendsData } from '~/utils/bends';
import type { ConvertedPoint, PointCrs } from '~/utils/pointCrs';
import type { ChainRequest, ChainResult, DissolveResult, LineDeletePreview, LineGeometryResponse, LineRef, MergeNodesReport, NodeDeletePreview, ReverseLineReport, SplitPreview, SplitReviewDecision, TopologyAreaCheck, TopologyDiagnosticsResponse, TopologyHistoryItem, TopologyUndoEntry, TopologyUndoResult, TopologyVersionMap, TopologyVersionsResponse } from './types';
import { compact, encodePath, mutationOptions, request } from './http';

export const topologyApi = {
  /**
   * Версии узлов/участков (оптимистичная блокировка): запоминаются при выборе объекта
   * и передаются в операцию; если объект успели изменить — сервер ответит 409.
   */
  async getTopologyVersions(ids: { nodes?: number[]; lines?: number[] }): Promise<TopologyVersionsResponse> {
    return request<TopologyVersionsResponse>('api/v1/topology/versions', {
      query: compact({
        nodes: ids.nodes?.length ? ids.nodes.join(',') : undefined,
        lines: ids.lines?.length ? ids.lines.join(',') : undefined,
      }),
    });
  },

  async createLine(
    nodeid1: number,
    nodeid2: number,
    versions?: { nodeid1?: string; nodeid2?: string }
  ): Promise<any> {
    return request('api/topology/line', {
      method: 'POST',
      body: compact({ nodeid1, nodeid2, nodeid1_version: versions?.nodeid1, nodeid2_version: versions?.nodeid2 }),
    });
  },

  /**
   * Удаление участка. expectedSectionId — heatpipesections.id из карточки: сервер сверит,
   * что это паспорт именно этого участка (иначе 409 object_mismatch, QA F54).
   */
  async deleteLine(
    lineId: number, expectedVersion?: string, expectedSectionId?: number | null, includePair = false,
  ): Promise<any> {
    const query = compact({
      expected_version: expectedVersion,
      expected_section_id: expectedSectionId ?? undefined,
      include_pair: includePair ? 'true' : undefined,
    });
    return request(`api/topology/line/${encodePath(lineId)}`, {
      method: 'DELETE',
      ...(Object.keys(query).length ? { query } : {}),
    });
  },

  /** Ссылка участок ↔ паспорт: по linesobj.id (lineId) или heatpipesections.id (sectionId) */
  async resolveLineRef(ref: { lineId?: number; sectionId?: number }): Promise<LineRef> {
    return request<LineRef>('api/v1/topology/line-ref', {
      query: compact({ line_id: ref.lineId, section_id: ref.sectionId }),
    });
  },

  /**
   * Разрезание. reviewToNew — решение по оборудованию без узла/позиции (из превью):
   * без него при наличии такого оборудования сервер отвечает 409 requires_resolution.
   */
  async splitLine(
    lineId: number,
    lng: number,
    lat: number,
    expectedVersion?: string,
    reviewToNew?: SplitReviewDecision
  ): Promise<any> {
    return request('api/topology/split-line', {
      method: 'POST',
      body: compact({ line_id: lineId, lng, lat, expected_version: expectedVersion, review_to_new: reviewToNew }),
    });
  },

  /** Превью разрезания участка: что будет перенесено/помечено, без сохранения */
  async previewSplitLine(lineId: number, lng: number, lat: number): Promise<SplitPreview> {
    return request<SplitPreview>('api/topology/split-line', {
      method: 'POST',
      body: { line_id: lineId, lng, lat, dry_run: true },
    });
  },

  async moveNode(id: number, lng: number, lat: number, expectedVersion?: string): Promise<any> {
    return request(`api/topology/node/${encodePath(id)}/move`, {
      method: 'PUT',
      body: compact({ lng, lat, expected_version: expectedVersion }),
    });
  },

  /**
   * Новый узел. Фрагмент/код/признак сервер берёт у узла-образца (nearNodeId / nearLineId)
   * или у ближайшего узла сети; fileid — явный фрагмент.
   */
  async createNode(
    lng: number,
    lat: number,
    ref: { fileid?: number; nearNodeId?: number; nearLineId?: number; nodeType?: NodeType } = {}
  ): Promise<{ success: boolean; id: number; fileid: number | null; node_type?: NodeType; operation_id?: number | null }> {
    return request('api/topology/node', {
      method: 'POST',
      body: compact({
        lng, lat, fileid: ref.fileid, near_node_id: ref.nearNodeId, near_line_id: ref.nearLineId,
        node_type: ref.nodeType && ref.nodeType !== 'US' ? ref.nodeType : undefined,
      }),
    });
  },

  /** Расчётный тип узла, его карточки и дополнения (заданный напор, подпитка) */
  async getNodeType(nodeId: number): Promise<NodeTypeInfo> {
    return request<NodeTypeInfo>(`api/v1/topology/node/${encodePath(nodeId)}/type`);
  },

  /** Смена типа узла; dryRun — что удалится (карточка старого типа, внутренняя схема) */
  async changeNodeType(nodeId: number, nodeType: NodeType, opts: { dryRun?: boolean; version?: string | null } = {}): Promise<NodeTypeChangeResult> {
    return request<NodeTypeChangeResult>(`api/v1/topology/node/${encodePath(nodeId)}/type`, {
      method: 'POST',
      body: compact({ node_type: nodeType, dry_run: Boolean(opts.dryRun), expected_version: opts.version ?? undefined }),
    });
  },

  /** Заданный напор / подпитка: добавить (on) или удалить */
  async setNodeFlag(nodeId: number, flag: NodeFlag, on: boolean, version?: string | null): Promise<NodeFlagResult> {
    return request<NodeFlagResult>(`api/v1/topology/node/${encodePath(nodeId)}/flag`, {
      method: 'POST',
      body: compact({ flag, on, expected_version: version ?? undefined }),
    });
  },

  /** Тип линии (участок или оборудование), её карточки и парная труба */
  async getLineType(lineId: number): Promise<LineTypeInfo> {
    return request<LineTypeInfo>(`api/v1/topology/line/${encodePath(lineId)}/type`);
  },

  /** Точка по координатам (WGS84, местная система 9998, x/y десктопа) → во всех трёх системах */
  async convertPoint(crs: PointCrs, x: number, y: number): Promise<ConvertedPoint> {
    return request<ConvertedPoint>('api/v1/topology/convert-point', { method: 'POST', body: { crs, x, y } });
  },

  /** Отводы участка по геометрии и местные сопротивления его паспортов (и парной трубы) */
  async getLineBends(lineId: number): Promise<LineBendsData> {
    return request<LineBendsData>(`api/v1/topology/line/${encodePath(lineId)}/bends`);
  },

  /** Смена типа линии (вместе с парной трубой); dryRun — какие карточки удалятся */
  async changeLineType(lineId: number, lineType: LineType, opts: { dryRun?: boolean; version?: string | null } = {}): Promise<LineTypeChangeResult> {
    return request<LineTypeChangeResult>(`api/v1/topology/line/${encodePath(lineId)}/type`, {
      method: 'POST',
      body: compact({ line_type: lineType, dry_run: Boolean(opts.dryRun), expected_version: opts.version ?? undefined }),
    });
  },

  /** Полная геометрия участка и его версия (тайлы обрезаны и упрощены — для правки не годятся) */
  async getLineGeometry(lineId: number): Promise<LineGeometryResponse> {
    return request<LineGeometryResponse>(`api/topology/line/${encodePath(lineId)}/geometry`);
  },

  /** Последняя операция топологии пользователя, которую можно отменить (null — нечего) */
  async getLastTopologyOperation(): Promise<TopologyUndoEntry | null> {
    const res = await request<{ operation: TopologyUndoEntry | null }>('api/topology/undo');
    return res.operation;
  },

  /** Отмена последней операции. 409 version_conflict — объекты изменены после неё; 404 — нечего отменять */
  async undoTopologyOperation(operationId?: number): Promise<TopologyUndoResult> {
    return request<TopologyUndoResult>('api/topology/undo', {
      method: 'POST',
      body: compact({ operation_id: operationId }),
    });
  },

  /** Узлы и участки основной сети в окне карты с полной точностью — для привязки при рисовании */
  async getSnapData(bbox: [number, number, number, number], fragmentIds: readonly number[] = []): Promise<SnapData> {
    return request<SnapData>('api/v1/topology/snap-data', {
      query: compact({ bbox: bbox.join(','), fragments: fragmentIds.length ? fragmentIds.join(',') : undefined }),
    });
  },

  /** Цепочка участков: dry_run — проверки и отчёт; 422 validation — ошибки при сохранении */
  async createChain(body: ChainRequest, dryRun = false): Promise<ChainResult> {
    return request<ChainResult>('api/v1/topology/chains', {
      method: 'POST',
      body: { ...compact(body as any), dry_run: dryRun },
    });
  },

  /** Последняя отменённая операция, которую можно повторить (null — нечего) */
  async getLastRedoOperation(): Promise<TopologyUndoEntry | null> {
    const res = await request<{ operation: TopologyUndoEntry | null }>('api/v1/topology/redo');
    return res.operation;
  },

  /** Повтор последней отменённой операции. 409 — объекты изменены после отмены */
  async redoTopologyOperation(operationId?: number): Promise<TopologyUndoResult> {
    return request<TopologyUndoResult>('api/v1/topology/redo', {
      method: 'POST',
      body: compact({ operation_id: operationId }),
    });
  },

  /** cascade — вместе с участками узла (иначе сервер откажет, если они есть) */
  async deleteNode(id: number, expectedVersion?: string, cascade = false): Promise<any> {
    const query = compact({ expected_version: expectedVersion, cascade: cascade ? 'true' : undefined });
    return request(`api/topology/node/${encodePath(id)}`, {
      method: 'DELETE',
      ...(Object.keys(query).length ? { query } : {}),
    });
  },

  /** «История»: последние операции пользователя (сеть и карточки), новые сверху */
  async getTopologyHistory(limit = 30): Promise<{ items: TopologyHistoryItem[] }> {
    return request('api/v1/topology/history', { ...mutationOptions('GET'), query: { limit } });
  },

  /** Откатить свои операции от последней до выбранной включительно */
  async undoTo(operationId: number): Promise<{
    undone: number[]; complete: boolean; stopped: { reason: string } | null; target: number;
  }> {
    return request('api/v1/topology/undo-to', { method: 'POST', body: { operation_id: operationId } });
  },

  /** Окно удаления узла: участки, ссылки, можно ли убрать узел, соединив трубы */
  async getNodeDeletePreview(id: number): Promise<NodeDeletePreview> {
    return request(`api/v1/topology/node/${encodePath(id)}/delete-preview`, mutationOptions('GET'));
  },

  /** Окно удаления участка: паспорт, оборудование, парная труба П/О */
  async getLineDeletePreview(id: number): Promise<LineDeletePreview> {
    return request(`api/v1/topology/line/${encodePath(id)}/delete-preview`, mutationOptions('GET'));
  },

  /** Убрать узел, соединив его трубы в одну (dry_run — план) */
  async dissolveNode(id: number, dryRun = false, expectedVersion?: string): Promise<DissolveResult> {
    return request(`api/v1/topology/node/${encodePath(id)}/dissolve`, {
      method: 'POST',
      body: { dry_run: dryRun, expected_version: expectedVersion },
    });
  },

  async getTopologyDiagnostics(fragmentId: number, limit = 200): Promise<TopologyDiagnosticsResponse> {
    return request('api/v1/topology/diagnostics', { query: { fragment_id: fragmentId, limit } });
  },

  /** Проверка после правки: правила связности для области операции журнала (узлы, участки и соседи) */
  async checkTopologyOperation(operationId: number): Promise<TopologyAreaCheck> {
    return request<TopologyAreaCheck>(`api/v1/topology/operations/${encodePath(operationId)}/check`);
  },

  /** Правила связности для произвольных узлов и участков (не больше 500 каждого) */
  async checkTopologyArea(ids: { nodes?: number[]; lines?: number[] }): Promise<TopologyAreaCheck> {
    return request<TopologyAreaCheck>('api/v1/topology/check-area', {
      method: 'POST',
      body: { node_ids: ids.nodes ?? [], line_ids: ids.lines ?? [] },
    });
  },

  /** Превью разворота участка: узлы, геометрия, оборудование по классам, версия участка */
  async previewReverseLine(lineId: number, expectedSectionId?: number | null): Promise<ReverseLineReport> {
    return request<ReverseLineReport>('api/topology/reverse-line', {
      method: 'POST',
      body: compact({ line_id: lineId, dry_run: true, expected_section_id: expectedSectionId ?? undefined }),
    });
  },

  /**
   * Разворот участка. 409 blocked — нужен acceptDirectionChange (насосы/клапаны/регуляторы),
   * 409 version_conflict — участок изменён после превью.
   */
  async reverseLine(
    lineId: number,
    options: {
      expectedVersion?: string;
      acceptDirectionChange?: boolean;
      /** Пара из превью (разворачивается вместе); includePair=false — только этот участок */
      pairLineId?: number | null;
      pairVersion?: string;
      includePair?: boolean;
      /** heatpipesections.id карточки — сервер сверит участок и паспорт (409 object_mismatch) */
      expectedSectionId?: number | null;
    } = {}
  ): Promise<ReverseLineReport> {
    return request('api/topology/reverse-line', {
      method: 'POST',
      body: compact({
        line_id: lineId,
        expected_version: options.expectedVersion,
        accept_direction_change: options.acceptDirectionChange || undefined,
        pair_line_id: options.pairLineId ?? undefined,
        pair_version: options.pairVersion,
        include_pair: options.includePair === false ? false : undefined,
        expected_section_id: options.expectedSectionId ?? undefined,
      }),
    });
  },

  /** Превью слияния: что и куда будет перенесено, что блокирует (ничего не сохраняет) */
  async previewMergeNodes(params: { target_node_id: number; source_node_id: number }): Promise<MergeNodesReport> {
    return request<MergeNodesReport>('api/topology/merge-nodes', {
      method: 'POST',
      body: { ...params, dry_run: true },
    });
  },

  /** 409 — слияние заблокировано (detail.blockers) или узлы изменены после превью (version_conflict) */
  async mergeNodes(params: {
    target_node_id: number;
    source_node_id: number;
    target_version?: string;
    source_version?: string;
  }): Promise<MergeNodesReport> {
    return request('api/topology/merge-nodes', {
      method: 'POST',
      body: compact(params),
    });
  },

  async updateLineGeometry(
    lineId: number,
    coordinates: number[][],
    expectedVersion?: string
  ): Promise<{ success: boolean; line_id: number; new_length: number; versions: TopologyVersionMap }> {
    return request(`api/topology/line/${encodePath(lineId)}/geometry`, {
      method: 'PUT',
      body: compact({ coordinates, expected_version: expectedVersion }),
    });
  },
};
