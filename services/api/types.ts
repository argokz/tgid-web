/** Типы ответов и запросов API ТГИД (вынесены из services/fastApiService.ts). */
import type { PermAction, PermKind, PermMatrix, PermScope, ServerPermissions } from '~/utils/permissions';
import type { NodeType } from '~/utils/nodeTypes';
import type { ThematicStyle, ThematicTheme } from '~/utils/thematicStyle';
import type { FileJobOptions } from './http';

export interface ColumnTranslation {
  column: string;
  russian_name: string;
  description: string;
}

export interface TranslationCache {
  [column: string]: ColumnTranslation;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  /** Счётчики по состояниям при тех же фильтрах (журналы; старый API поля не отдаёт) */
  state_counts?: { state_id: number | null; count: number }[];
  /** Счётчики признаков при тех же фильтрах (осмотры: с нарушениями, с результатами) */
  facet_counts?: Record<string, number>;
}

export interface JournalSummary {
  id: number;
  longitude: number | null;
  latitude: number | null;
  pressure_min: number | null;
  pressure_max: number | null;
  [key: string]: any;
}

export interface JournalDetails extends JournalSummary {
  attributes: Record<string, any>;
  relations: Record<string, Array<Record<string, any>>>;
}

export type JournalFilters = Record<string, string | number | boolean | null | undefined>;
export type JournalLookups = Record<string, any>;

export type DefectSummary = JournalSummary;
export type DefectDetails = JournalDetails;
export type DefectLookups = JournalLookups;
export type ShurfSummary = JournalSummary;
export type ShurfDetails = JournalDetails;
export type ShurfLookups = JournalLookups;
export type InspectionSummary = JournalSummary;
export type InspectionDetails = JournalDetails;
export type InspectionLookups = JournalLookups;
export type RepairSummary = JournalSummary;
export type RepairDetails = JournalDetails;
export type RepairLookups = JournalLookups;
export type PressureTestSummary = JournalSummary;
export type PressureTestDetails = JournalDetails;
export type PressureTestLookups = JournalLookups;
export type TechnicalConditionSummary = JournalSummary;
export type TechnicalConditionDetails = JournalDetails;
export type TechnicalConditionLookups = JournalLookups;
export type CorrosionIndicatorSummary = JournalSummary;
export type CorrosionIndicatorDetails = JournalDetails;
export type CorrosionIndicatorLookups = JournalLookups;
export type AlsekoLoadSummary = JournalSummary;
export type AlsekoLoadDetails = JournalDetails;
export type AlsekoBuildingSummary = JournalSummary;
export type AlsekoBuildingDetails = JournalDetails;
export interface AlsekoReconciliationKind { kind: string; label: string; desktop_report: string | null; count: number }
export interface AlsekoReconciliationSummary {
  totals: { loads: number; bound_buildings: number; buildings_with_consumer: number };
  kinds: AlsekoReconciliationKind[];
}
export interface AlsekoReconciliationIssues { kind: string; label: string; total: number; items: Record<string, unknown>[] }
export interface AlsekoAddressCandidate {
  microdistrict: string | null; street: string | null; house: string; load_count: number;
  heating_load: number; hot_water_load: number; ventilation_load: number; steam_load: number; total_load: number;
  building_count: number; building_ids: number[] | null;
}
export interface AlsekoAddressCandidates { building: Record<string, unknown> | null; query: string; items: AlsekoAddressCandidate[] }
export interface AlsekoFieldChange { field: string; old: unknown; new: unknown }
export interface AlsekoAddressBindResult {
  building_id: number; dry_run: boolean; action: 'bind' | 'clear'; source: Record<string, unknown> | null;
  changes: AlsekoFieldChange[]; other_buildings_with_address: number[]; change_group_id: string | null;
}
export interface AlsekoConsumerBindResult {
  consumer: { node_id: number; code: string; node_name: string; label: string; consumer_id: number | null };
  dry_run: boolean; assign: { id: number; potrebitel: string | null }[]; unassign: { id: number; potrebitel: string | null }[];
  loads: Record<string, number | null>; warnings: string[]; change_group_id: string | null;
}

export type AlsekoLookups = JournalLookups;

export type ElectricalBindObjectType = 'line' | 'channel' | 'coupling' | 'support' | 'sleeve';
export interface ElectricalReconciliationKind { kind: string; label: string; count: number }
export interface ElectricalReconciliationItem {
  object_type: ElectricalBindObjectType; id: number; name: string | null; issues: string[];
  longitude: number | null; latitude: number | null; tolerance: number | null;
  [key: string]: unknown;
}
export interface ElectricalReconciliation {
  tolerance: number; tables_present: boolean; checked: Record<string, number>;
  kinds: ElectricalReconciliationKind[]; total: number; items: ElectricalReconciliationItem[];
}
export interface ElectricalBindChange { field: string; old: unknown; new: unknown; distance: number | null }
export interface ElectricalBindRecord {
  object_type: ElectricalBindObjectType; table: string; id: number; name: string | null;
  changes: ElectricalBindChange[]; longitude: number | null; latitude: number | null;
}
export interface ElectricalBindResult {
  dry_run: boolean; tolerance: number; overwrite: boolean; snap_points: boolean;
  records: ElectricalBindRecord[]; unresolved: { object_type: string; id: number; issues: string[] }[];
  counts: { records: number; fields: number; unresolved: number }; applied: number; change_group_id: string | null;
}

export type ElectricalObjectType =
  | 'source'
  | 'receiver'
  | 'line'
  | 'channel'
  | 'coupling'
  | 'support'
  | 'sleeve';
export type ElectricalObjectSummary = JournalSummary;
export interface ElectricalObjectDetails extends JournalDetails {
  object_type: ElectricalObjectType;
}
export type ElectricalNetworkLookups = JournalLookups;
export type HeatLossSeasonSummary = JournalSummary;
export type HeatLossSeasonDetails = JournalDetails;
export type HeatLossSourceSummary = JournalSummary;
export type HeatLossSourceDetails = JournalDetails;
export type HeatLossLookups = JournalLookups;

export type ConsumerLoadType = 'generalized' | 'real';
export type ConsumerLoadDiagnosticKind = 'zero_load' | 'closed' | 'disconnected' | 'not_calculated';
export type ConsumerLoadSummary = JournalSummary;
export type ConsumerLoadDetails = JournalDetails;
export type ConsumerLoadLookups = JournalLookups;

export type TemperatureGraphStatus = 'ready' | 'missing' | 'duplicates' | 'incomplete';
export type TemperatureGraphFilters = JournalFilters;
export type TemperatureGraphSourceSummary = JournalSummary;
export interface TemperatureGraphPoint {
  id: number;
  tn: number | null;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  tv: number | null;
  q_otn: number | null;
  t_bn: number | null;
  duplicate_count: number;
  [key: string]: number | null;
}
export interface TemperatureGraphSourceDetails extends JournalDetails {
  points: TemperatureGraphPoint[];
}
export type TemperatureGraphLookups = JournalLookups;

export type PumpConfigurationStatus =
  | 'configured'
  | 'missing_model'
  | 'coefficients_missing'
  | 'line_missing';
export type PumpCatalogStatus = 'ready' | 'non_monotonic' | 'incomplete';
export type InstalledPumpFilters = JournalFilters;
export type PumpCatalogFilters = JournalFilters;
export type InstalledPumpSummary = JournalSummary;
export interface InstalledPumpDetails extends JournalDetails {
  standard_pump: StandardPumpDetails | null;
  latest_output: Record<string, any> | null;
}
export type StandardPumpSummary = JournalSummary;
export interface StandardPumpDetails extends JournalDetails {
  points: PumpCurvePoint[];
  min_flow: number | null;
  max_flow: number | null;
  has_valid_working_zone: boolean;
}
export type PumpEquipmentLookups = JournalLookups;
export interface PumpCurvePoint {
  flow: number | null;
  head?: number | null;
  power?: number | null;
  efficiency?: number | null;
  [key: string]: any;
}

export type NetworkArmatureType = 'damper' | 'regulating';
export type NetworkArmatureQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'purpose_unknown'
  | 'diameter_suspicious';
export type NetworkArmatureFilters = JournalFilters;
export type StandardDamperFilters = JournalFilters;
export type NetworkArmatureSummary = JournalSummary;
export type NetworkArmatureDetails = JournalDetails;
export type StandardDamperSummary = JournalSummary;
export type StandardDamperDetails = JournalDetails;
export interface NetworkArmatureLookups extends JournalLookups {
  purposes: Array<Record<string, any>>;
}

export type NetworkRegulatorType = 'pressure' | 'flow' | 'differential';
export type NetworkRegulatorQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'control_node_missing'
  | 'setpoint_missing'
  | 'capacity_missing';
export type NetworkRegulatorFilters = JournalFilters;
export type StandardRegulatorFilters = JournalFilters;
export type NetworkRegulatorSummary = JournalSummary;
export type NetworkRegulatorDetails = JournalDetails;
export type StandardRegulatorSummary = JournalSummary;
export type StandardRegulatorDetails = JournalDetails;
export type NetworkRegulatorLookups = JournalLookups;

export type NetworkBypassQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'connection_node_missing'
  | 'setpoint_missing'
  | 'geometry_parameters_invalid';
export type NetworkBypassFilters = JournalFilters;
export type StandardTubeFilters = JournalFilters;
export type NetworkBypassSummary = JournalSummary;
export type NetworkBypassDetails = JournalDetails;
export type StandardTubeSummary = JournalSummary;
export type StandardTubeDetails = JournalDetails;
export type NetworkBypassLookups = JournalLookups;

export type NetworkDiaphragmQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'topology_missing'
  | 'state_missing'
  | 'count_invalid'
  | 'diameter_unresolved';
export type NetworkDiaphragmDiameterMode = 'available' | 'pending_calculation' | 'unresolved';
export type NetworkDiaphragmFilters = JournalFilters;
export type NetworkDiaphragmSummary = JournalSummary;
export type NetworkDiaphragmDetails = JournalDetails;
export type NetworkDiaphragmLookups = JournalLookups;

export type ElevatorQualityStatus =
  | 'ready'
  | 'line_missing'
  | 'line_removed'
  | 'topology_missing'
  | 'state_missing'
  | 'nozzle_unresolved'
  | 'pending_calculation';
export type ElevatorFilters = JournalFilters;
export type ElevatorSummary = JournalSummary;
export type ElevatorDetails = JournalDetails;
export type ElevatorLookups = JournalLookups;

export type RegimeAnalysisKind =
  | 'negative-dp'
  | 'airlock'
  | 'low-temperature'
  | 'closed-sections'
  | 'hydrostatic-zones';

export interface RegimeAnalysisResult {
  query: string;
  title: string;
  fragment_id: number;
  calculation_id?: number | null;
  calculation_date?: string | null;
  tn?: number | null;
  count: number;
  items: Array<Record<string, any> & { longitude?: number | null; latitude?: number | null }>;
  note?: string;
  /** Анализ режима: порядок колонок и колонка с оценкой режима */
  columns?: string[];
  mode_column?: string | null;
  summary?: Record<string, number>;
  object?: 'node' | 'line';
  /** Гидростатические зоны */
  full_static_head_m?: number;
  piezometric_static_head_m?: number;
  min_geo_mark_m?: number;
  min_geo_node?: { node_id: number; code?: string; name?: string };
  max_level_node?: { node_id: number; code?: string; name?: string; level_m: number };
}

export interface PassportSite {
  id: string;
  name: string;
  ms_rs: 'ms' | 'rs';
  site_id: number;
  is_leaf?: boolean;
}

/** Паспорт: фрагменты карты — как -fragments десктопа (без них — копии труб из фрагментов-вариантов) */
export type PassportOptions = FileJobOptions & { fragments?: readonly number[] };

export interface PassportHierarchyGroup {
  id: string;
  name: string;
  children: any[];
}

export interface TopologyDiagnosticFault {
  type: string;
  title?: string;
  object_type: 'node' | 'line';
  object_id: number;
  description: string;
  related_ids?: number[];
  lat: number | null;
  lng: number | null;
}

/** GET api/v1/topology/diagnostics: counts — полные числа, faults — не больше limit на тип */
export interface TopologyDiagnosticsResponse {
  fragment_id: number;
  fragment_name: string | null;
  nodes: number;
  lines: number;
  counts: Record<string, number>;
  total: number;
  limit: number;
  truncated: boolean;
  types: Record<string, string>;
  faults: TopologyDiagnosticFault[];
}

/** Сценарий «что если»: копия фрагмента-основы (GET api/v1/scenarios) */
export interface Scenario {
  id: number;
  name: string;
  note: string | null;
  base_fileid: number;
  base_name: string | null;
  fileid: number;
  fragment_name: string | null;
  created_by: string | null;
  created_at: string;
  status: 'active' | 'archived';
  /** false — фрагмент-копию удалили (например, в десктопе) */
  exists: boolean;
}

export interface ScenarioCreateResult {
  scenario_id: number;
  name: string;
  base_fileid: number;
  base_name: string | null;
  fileid: number;
  tables: Record<string, number>;
  created_nodes: number;
  created_lines: number;
  unresolved_refs: Record<string, number>;
  operation_id?: number | null;
}

export type ScenarioChangeKind =
  | 'changed' | 'added' | 'removed' | 'conflict' | 'base_changed' | 'base_added' | 'base_removed';

export interface ScenarioDiffItem {
  table: string;
  kind: ScenarioChangeKind;
  base_id: number | null;
  copy_id: number | null;
  name: string | null;
  /** {колонка: [в основе, в сценарии]} */
  fields: Record<string, [unknown, unknown]> | null;
  anchor_type: 'node' | 'line' | null;
  anchor_id: number | null;
  lat: number | null;
  lng: number | null;
}

/** GET api/v1/scenarios/{id}/diff: summary — полные числа по таблицам, items — не больше limit */
export interface ScenarioDiff {
  scenario_id: number;
  name: string;
  base_fileid: number;
  fileid: number;
  summary: Record<string, Partial<Record<ScenarioChangeKind, number>>>;
  by_kind: Partial<Record<ScenarioChangeKind, number>>;
  total: number;
  limit: number;
  truncated: boolean;
  kinds: Record<ScenarioChangeKind, string>;
  items: ScenarioDiffItem[];
}

export type ScenarioRegimeKind =
  | 'became_underheated' | 'lost' | 'became_overloaded' | 'became_fast' | 'recovered' | 'relieved' | 'new' | 'changed';

/** Пары [основа, сценарий]; null — нет результата расчёта */
export type ScenarioValuePair = [number | null, number | null];

export interface ScenarioRegimeItem {
  object: 'consumer' | 'line';
  kind: ScenarioRegimeKind;
  base_id: number | null;
  copy_id: number | null;
  anchor_type: 'node' | 'line';
  anchor_id: number;
  name: string | null;
  /** потребитель: располагаемый напор, м; теплообеспеченность, %; расход, т/ч */
  head?: ScenarioValuePair;
  supply?: ScenarioValuePair;
  /** участок: расход, т/ч; скорость, м/с; удельные потери, Па/м */
  flow?: ScenarioValuePair;
  velocity?: ScenarioValuePair;
  loss?: ScenarioValuePair;
  lat: number | null;
  lng: number | null;
}

export interface ScenarioCalcInfo {
  id: number;
  fileid: number;
  tn: number | null;
  name: string | null;
  date: string | null;
  emergency: boolean;
}

/** GET api/v1/scenarios/{id}/compare: режим сценария против основы */
export interface ScenarioRegimeCompare {
  scenario_id: number;
  name: string;
  base_calculation: ScenarioCalcInfo;
  scenario_calculation: ScenarioCalcInfo;
  warnings: string[];
  consumers: {
    base: number; scenario: number; underheated_base: number; underheated_scenario: number;
    load_base: number; load_scenario: number; flow_base: number; flow_scenario: number;
    became_underheated: number; recovered: number; lost: number; new: number; changed: number;
  };
  lines: {
    base: number; scenario: number; overloaded_base: number; overloaded_scenario: number;
    became_overloaded: number; became_fast: number; relieved: number; lost: number; new: number; changed: number;
  };
  thresholds: { underheat_pct: number; head_delta_m: number; spec_loss_pa_m: number; velocity_ms: number };
  kinds: Record<ScenarioRegimeKind, string>;
  total: number;
  truncated: boolean;
  items: ScenarioRegimeItem[];
}

export interface ScenarioSkippedConflict {
  /** «таблица:id копии» — ключ решения конфликта */
  key: string;
  table: string;
  base_id: number;
  copy_id: number;
  fields: Record<string, [unknown, unknown]> | null;
}

/** POST api/v1/scenarios/{id}/merge: отчёт переноса (dry_run — предпросмотр с откатом) */
export interface ScenarioMergeReport {
  dry_run?: boolean;
  scenario_id: number;
  base_fileid: number;
  fileid: number;
  counts: Record<string, Record<string, number>>;
  updated: number;
  inserted: number;
  removed: number;
  skipped_conflicts: ScenarioSkippedConflict[];
  touched_nodes: number[];
  touched_lines: number[];
  check: TopologyAreaCheck;
  operation_id?: number | null;
}

export type TopologyRuleSeverity = 'error' | 'warning';

/** Замечание правил связности: error — sety не рассчитает, warning — подозрительно */
export interface TopologyAreaIssue extends TopologyDiagnosticFault {
  severity: TopologyRuleSeverity;
  component_size?: number;
}

/** Проверка области правки: GET api/v1/topology/operations/{id}/check, POST …/check-area */
export interface TopologyAreaCheck {
  operation_id?: number;
  area: { nodes: number; lines: number };
  truncated: boolean;
  counts: Record<string, number>;
  total: number;
  errors: number;
  rules: Record<string, { title: string; severity: TopologyRuleSeverity }>;
  issues: TopologyAreaIssue[];
}

export interface PiezometerPathNode {
  node_id: number;
  distance: number;
  label: string;
  z: number;
  h_pod: number | null;
  h_obr: number | null;
  t_pod: number | null;
  t_obr: number | null;
  lng: number | null;
  lat: number | null;
  /** Двойной пьезометр: напоры второго расчёта */
  h_pod_2?: number | null;
  h_obr_2?: number | null;
  /** Факт по датчикам телеметрии: напор = отметка + давление датчика, температура; время показания */
  h_pod_fact?: number | null;
  h_obr_fact?: number | null;
  t_pod_fact?: number | null;
  t_obr_fact?: number | null;
  fact_at?: string | null;
  fact_stale?: boolean;
}

/** Статика (gid8 Pjezo m_stat): max(отметка + высота здания) + 5 м по фрагментам маршрута */
export interface PiezometerStaticHead {
  value: number;
  reserve_m: number;
  node_id: number;
  label: string;
  z: number;
  building_height: number;
  fragment_ids: number[];
}

export interface PiezometerRouteResponse {
  path: PiezometerPathNode[];
  waypoints: number[];
  node_count: number;
  total_length: number;
  has_calculation: boolean;
  calculation_id?: number | null;
  calculation_id_2?: number | null;
  has_calculation_2?: boolean;
  fragment_ids?: number[];
  static_head?: PiezometerStaticHead | null;
}

/** Отчёт импорта/слияния фрагментов (dry-run или применение) */
export interface FragmentTransferReport {
  dry_run?: boolean;
  fileid: number | null;
  name?: string;
  tables: Record<string, number>;
  created_nodes: number;
  created_lines: number;
  unresolved_refs?: Record<string, number>;
  skipped_tables?: string[];
  dropped_columns?: Record<string, string[]>;
  geometry?: { nodes_with_shape: number; lines_with_shape: number };
  duplicate_external_codes?: { name: string; ids: number[] }[];
  unified_external_codes?: number;
  coincident_node_positions?: number;
  operation_id?: number | null;
}

/** Сохранённое направление (таблицы десктопа directions / deployeddirections) */
export interface PiezometerDirection {
  id: number;
  name: string;
  fileid: number;
  fragment_name?: string | null;
  node_count: number;
  missing_nodes: number;
}

export interface PiezometerDirectionDetail {
  id: number;
  name: string;
  fileid: number;
  nodes: number[];
  missing_nodes: number[];
}

export interface TravelTimeSide {
  line_id: number;
  /** +1 — линия ориентирована по маршруту, −1 — против */
  napr: number;
  q: number | null;
  time_min: number | null;
  length_m: number | null;
  calculation_id: number | null;
  /** Накопленное время после участка (как в десктопе); null — «нет движения» */
  cumulative_min: number | null;
}

export interface TravelTimeSummary {
  total_min: number | null;
  text: string;
  no_flow: boolean;
  lines: number;
  sum_segments_min: number;
  mixed_orientation: boolean;
}

export interface TravelTimeResponse {
  query: 'travel_time';
  title: string;
  calculation_ids: number[];
  node_count: number;
  waypoints: number[];
  supply: TravelTimeSummary;
  return: TravelTimeSummary;
  count: number;
  items: Array<{
    index: number;
    node1_id: number;
    node1_label: string;
    node2_id: number;
    node2_label: string;
    supply: TravelTimeSide | null;
    return: TravelTimeSide | null;
  }>;
  note?: string | null;
}

export interface SplitTransferReport {
  /** Реально перенесено на новую половину: {таблица: количество} */
  moved: Record<string, number>;
  /** Оборудование без узла и позиции на участке — половину выбирает оператор */
  review: Record<string, number>;
  /** То же поштучно (превью): опознавательные атрибуты объекта */
  review_items?: Record<string, SplitReviewItem[]>;
  /** Перенесено на новую половину по решению оператора */
  review_moved?: Record<string, number[]>;
  /** Таблицы/колонки, отсутствующие в схеме — пропущены */
  skipped: string[];
}

export interface SplitReviewItem {
  id: number;
  attrs: Record<string, string | number | boolean | null>;
}

/** Решение оператора при разрезании: {таблица: [id]} — на новую (вторую) половину */
export type SplitReviewDecision = Record<string, number[]>;

/** Операция топологии, которую можно отменить (кнопка «Отменить») */
export interface TopologyUndoEntry {
  operation_id: number;
  operation: string;
  created_at: string | null;
  summary: Record<string, any>;
  objects: number;
  undo_supported: boolean;
}

export interface TopologyUndoResult extends TopologyUndoEntry {
  success: boolean;
  restored: Record<string, number>;
  deleted: Record<string, number[]>;
}

/** Проверка цепочки (POST topology/chains): error блокирует сохранение */
export interface ChainIssue {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  point?: number;
  segment?: number;
  node_id?: number;
  line_id?: number;
  lng?: number;
  lat?: number;
  items?: Record<string, { id: number; attrs: Record<string, any> }[]>;
}

export interface ChainRequestPoint {
  kind: 'node' | 'tap' | 'new' | 'vertex';
  node_id?: number;
  line_id?: number;
  lng?: number;
  lat?: number;
  /** тип нового узла (только kind=new): карточка типа создаётся в той же операции */
  node_type?: NodeType;
  /** поля новой карточки (ввод в здание: name, housenumber) */
  card?: Record<string, string>;
}

export interface ChainRequest {
  points: ChainRequestPoint[];
  pipe_mode: 'common' | 'pair' | 'supply' | 'return';
  fileid?: number;
  versions?: TopologyVersionMap;
  /** {line_id: {таблица: [id]}} — оборудование без позиции на трубах врезки ({} — всё на первой половине) */
  review_to_new?: Record<string, SplitReviewDecision>;
}

export interface ChainResult {
  ok: boolean;
  dry_run?: boolean;
  issues: ChainIssue[];
  pipe_mode: string;
  fileid: number | null;
  segments: { segment: number; signs: number[]; sign_names: string[]; length_m: number }[];
  taps: { line_id: number; pair_line_id?: number | null; node_id?: number; new_line_id?: number }[];
  total_length_m: number;
  created_nodes?: number[];
  created_lines?: number[];
  split_lines?: number[];
  lines?: { id: number; segment: number; nodeid1: number; nodeid2: number; sign: number; sign_name: string; length_m: number }[];
  operation_id?: number | null;
}

/** Полная геометрия участка для правки вершин (WGS84) */
export interface LineGeometryResponse {
  line_id: number;
  nodeid1: number;
  nodeid2: number;
  coordinates: [number, number][];
  node1: [number, number] | null;
  node2: [number, number] | null;
  length_m: number | null;
  version: string;
  endpoint_tolerance_m: number;
}

export interface SplitPreview {
  status: string;
  dry_run: boolean;
  new_node_id: number;
  new_line_id: number;
  transferred: SplitTransferReport;
  /** Версии объектов на момент превью: {"line:17": "…#xmin"} — передаются при подтверждении */
  versions: TopologyVersionMap;
}

/** Версии объектов для оптимистичной блокировки: {"node:5": token, "line:17": token} */
export type TopologyVersionMap = Record<string, string>;

export interface TopologyObjectVersion {
  version: string;
  archivechangedate: string | null;
  removed: boolean;
}

export interface TopologyVersionsResponse {
  nodes: Record<string, TopologyObjectVersion>;
  lines: Record<string, TopologyObjectVersion>;
}

/** Участок (linesobj.id) и его паспорт трубы (heatpipesections.id) — GET /topology/line-ref */
export interface LineRef {
  line_id: number;
  section_id: number | null;
  fileid: number | null;
  nodeid1: number | null;
  nodeid2: number | null;
  removed: boolean;
}

/** Превью/результат слияния узлов (dry-run → подтверждение) */
export interface MergeNodesReport {
  dry_run?: boolean;
  success?: boolean;
  target_node_id: number;
  source_node_id: number;
  target_position: { x: number | null; y: number | null; lng: number | null; lat: number | null };
  distance_m: number | null;
  /** Участки источника, которые перепривяжутся к целевому узлу */
  relinked_lines: number[];
  /** Участки между сливаемыми узлами — будут сняты (safe-delete) */
  removed_lines: number[];
  /** Что переносится на целевой узел: {"realconsumers.nodeid": 1} */
  transfer: Record<string, number>;
  /** Результаты расчёта (*_out) — не переносятся */
  results_skipped: Record<string, number>;
  /** Что блокирует слияние; пусто — можно применять */
  blockers: Record<string, any>;
  warnings: { parallel_lines_with?: number[] };
  transferred?: Record<string, number>;
  merged_lines?: number;
  versions: TopologyVersionMap;
}

export interface ReverseNodeBoundItem {
  id: number;
  nodeid: number | null;
  position_before: 'start' | 'end' | 'other';
  position_after: 'start' | 'end' | 'other';
}

/** Превью/результат разворота участка */
export interface ReverseLineReport {
  dry_run?: boolean;
  success?: boolean;
  line_id: number;
  nodeid1: number;
  nodeid2: number;
  before: { nodeid1: number; nodeid2: number; externalsignlineid: number | null };
  after: { nodeid1: number; nodeid2: number; externalsignlineid: number | null };
  geometry: { reversed: boolean; points: number | null; length_m: number | null };
  equipment: {
    /** Направление действия меняется вместе с участком (насосы, клапаны, регуляторы) */
    directional: Record<string, number>;
    /** Привязаны к узлу: узел сохраняется, меняется положение начало ↔ конец */
    node_bound: Record<string, ReverseNodeBoundItem[]>;
    /** От направления не зависят */
    neutral: Record<string, number>;
    /** Места установки диафрагм (функциональные, не начало/конец) */
    diaphragm_locations: Record<string, number>;
  };
  requires_confirmation: boolean;
  versions: TopologyVersionMap;
  /** Парная труба (подача ↔ обратка), разворачивается вместе — как в десктопе */
  pair?: (ReverseLineReport & { matched_by: 'coords' | 'geometry'; deviation_m: number | null }) | null;
  pair_line_id?: number | null;
  operation_id?: number | null;
}


export interface OutageSimulationSummary {
  isolated_lines_count: number;
  isolated_nodes_count: number;
  valves_count: number;
  valves_already_closed_count?: number;
  boundary_nodes_count?: number;
  consumers_count: number;
  total_heating_load_gcal_h: number;
  total_gvs_load_gcal_h: number;
  total_vent_load_gcal_h: number;
  total_load_gcal_h: number;
  total_pipe_length_m: number;
  total_pipe_volume_m3: number;
  /** Полная модель (оценка): узлы/участки/потребители, потерявшие связь с источниками */
  downstream_nodes_count?: number;
  downstream_lines_count?: number;
  downstream_consumers_count?: number;
  downstream_load_gcal_h?: number;
  total_with_downstream_load_gcal_h?: number;
  sources_count?: number;
  /** Mincut: задвижки, за которыми после отключения остаётся питание */
  valves_required_count?: number;
  failed_valves_count?: number;
  feed_points_in_zone_count?: number;
}

/** supply — отсекает питание; no_supply — за ней питания нет; inside_zone — на аварийном участке */
export type ValveIsolationReason = 'supply' | 'no_supply' | 'inside_zone';

export interface ValveToClose {
  id: number;
  lineid: number;
  /** Узел-камера, во внутренней схеме которой стоит задвижка */
  owner_node_id?: number | null;
  display_name: string;
  nominal_diameter: number;
  state_id: number;
  state_name: string;
  lng: number | null;
  lat: number | null;
  required?: boolean;
  reason?: ValveIsolationReason;
}

export interface AffectedConsumer {
  id: number;
  consumer_type: 'generalized' | 'real';
  node_id: number;
  name: string;
  heating_load: number;
  ventilation_load: number;
  hot_water_load: number;
  total_load: number;
  longitude: number | null;
  latitude: number | null;
}

export interface OutageSimulationResponse {
  success: boolean;
  target: { line_id?: number | null; node_id?: number | null };
  summary: OutageSimulationSummary;
  valves_to_close: ValveToClose[];
  /** Уже закрытые задвижки на границе зоны — закрывать не нужно */
  valves_already_closed: ValveToClose[];
  /** Задвижки из запроса «не держит», через которые прошла зона */
  failed_valves?: ValveToClose[];
  /** Питающие точки внутри зоны — задвижками не отсечь, отключать на источнике или вводе */
  feed_points_in_zone?: NetworkFeedPoint[];
  /** Камеры/ТРП с задвижками во внутренней схеме, на которых остановлена зона */
  boundary_nodes: number[];
  affected_consumers: AffectedConsumer[];
  /** Потребители ниже закрытых задвижек (вне зоны, без связи с источниками) — оценка */
  downstream_consumers?: AffectedConsumer[];
  model?: string;
  estimate?: boolean;
  estimate_note?: string;
  geojson: {
    isolated_pipes: any;
    valves_to_close: any;
    affected_consumers: any;
    downstream_pipes?: any;
    downstream_consumers?: any;
  };
}

/** Трассировка сети по топологии (POST api/analysis/trace) — фаза 1 модернизации */
export type NetworkTraceType = 'connected' | 'upstream' | 'downstream' | 'subnetwork';

/** Барьеры по условию: обход останавливается на объектах этого вида (у «связанных» и «зоны») */
export type NetworkStopKind = 'valves' | 'pumpstations' | 'setpress' | 'sources';

export interface NetworkTraceRequest {
  /** Тип — явно или из именованной настройки config_id */
  trace_type?: NetworkTraceType;
  config_id?: string;
  stop_at?: NetworkStopKind[];
  start_line_ids?: number[];
  start_node_ids?: number[];
  barrier_line_ids?: number[];
  barrier_node_ids?: number[];
  /** Остановить обход на задвижках (участок с задвижкой, камера с задвижками во внутренней схеме) */
  stop_at_valves?: boolean;
  include_geometry?: boolean;
}

/** Питающая точка: источник или узел заданного напора (вход квартальной сети из магистрали) */
export interface NetworkFeedPoint {
  node_id: number;
  kind: 'heat_source' | 'set_pressure';
}

export interface NetworkTraceValve {
  id: number;
  lineid: number;
  owner_node_id: number | null;
  display_name: string;
  state_name: string;
  lng: number | null;
  lat: number | null;
}

export interface NetworkTraceResponse {
  success: boolean;
  trace_type: NetworkTraceType;
  model: 'topology';
  start: { line_ids: number[]; node_ids: number[] };
  summary: {
    nodes_count: number;
    lines_count: number;
    sources_count: number;
    valves_count: number;
    consumers_count: number;
    total_load_gcal_h: number;
    total_pipe_length_m: number;
    total_pipe_volume_m3: number;
    stopped_at_count: number;
  };
  source_node_ids: number[];
  sources: NetworkFeedPoint[];
  node_ids: number[];
  line_ids: number[];
  stopped_at_node_ids: number[];
  valves: NetworkTraceValve[];
  consumers: AffectedConsumer[];
  consumers_truncated: boolean;
  /** Участков больше предела — геометрия не отдана, только id */
  geometry_truncated: boolean;
  geojson: { lines: GeoJSON.FeatureCollection; consumers: GeoJSON.FeatureCollection };
  /** Барьеры по условию, с которыми выполнена трассировка */
  stop_at?: NetworkStopKind[];
  /** Именованная настройка, если трассировка запущена по ней */
  config?: { id: string; name: string };
}

/** Именованная настройка трассировки (api/v1/trace-configs): тип и барьеры по условию */
export interface TraceConfig {
  id: string;
  name: string;
  params: { trace_type: NetworkTraceType; stop_at: NetworkStopKind[] };
  author: string | null;
  shared: boolean;
  builtin: boolean;
}

export interface TraceConfigList {
  configs: TraceConfig[];
  /** Может ли пользователь сохранять общие настройки (право «Справочники и шаблоны») */
  can_shared: boolean;
}

/** Тематическая карта участков (api/v1/thematic/pipes): значение темы v у каждого участка */
export interface ThematicPipesResponse {
  theme: ThematicTheme;
  /** Расчёт-источник (износ, теплопотери) для подписи легенды */
  source_run: { id: number; label: string } | null;
  summary: {
    count: number;
    with_value: number;
    min?: number;
    max?: number;
    /** темы-справочники: коды по убыванию числа участков */
    categories?: { value: number; label: string; count: number }[];
  };
  /** Участков больше предела — показана часть */
  truncated: boolean;
  geojson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString,
    { id: number; fileid: number; v: number | null }>;
}

/** Сохранённый стиль тематической карты (api/v1/layer-styles) */
export interface LayerStyle {
  id: string;
  name: string;
  style: ThematicStyle;
  /** растёт при каждом сохранении; PUT с прежней — 409 */
  revision: number;
  author: string | null;
  shared: boolean;
  updated_at: string | null;
}

export interface LayerStyleList {
  styles: LayerStyle[];
  can_shared: boolean;
}

/** Выборка объектов сети по условиям (api/v1/network-select, itwin-api database/network_select.py) */
export type SelectTarget = 'lines' | 'nodes';
export type SelectOp = 'lt' | 'le' | 'gt' | 'ge' | 'eq' | 'ne' | 'between' | 'in' | 'not_in' | 'is_null' | 'not_null' | 'contains';
export type SelectValue = number | string;

export interface SelectCondition {
  field: string;
  op: SelectOp;
  value?: SelectValue | null;
  value2?: number | null;
  values?: SelectValue[];
}

/** «В N м от социальных объектов» (itwin-api database/poi.py); пустые категории — все */
export interface SelectNearPoi {
  categories: string[];
  meters: number;
}

export interface SelectNear {
  node_id?: number | null;
  node_name?: string | null;
  lon?: number | null;
  lat?: number | null;
  meters: number;
}

export interface SelectSpec {
  target: SelectTarget;
  conditions: SelectCondition[];
  match: 'all' | 'any';
  near?: SelectNear | null;
  near_poi?: SelectNearPoi | null;
  in_view: boolean;
  /** null — все фрагменты */
  fragment_ids?: number[] | null;
  order_by?: string | null;
  order_desc: boolean;
  limit: number;
}

export interface SelectFieldChoice {
  value: SelectValue;
  label: string;
}

export interface SelectField {
  key: string;
  label: string;
  kind: 'number' | 'category' | 'text';
  units: string;
  /** passport | calc | wear | heat_losses | node */
  source: string;
  hint: string;
  ops: SelectOp[];
  choices: SelectFieldChoice[];
}

export interface SelectFields {
  targets: Array<{ key: SelectTarget; label: string; fields: SelectField[] }>;
  op_labels: Record<SelectOp, string>;
  max_limit: number;
  max_near_m: number;
  /** Категории социальных объектов и сколько их загружено */
  poi_categories?: Array<{ value: string; label: string; count: number }>;
}

export interface SelectItem {
  id: number;
  fileid: number | null;
  title: string;
  length?: number | null;
  node_type?: string | null;
  card_type?: string | null;
  distance_m?: number;
  values: Record<string, SelectValue | null>;
  lon: number | null;
  lat: number | null;
}

export interface SelectResult {
  spec: SelectSpec;
  /** Запрос словами — как его понял сервер */
  description: string;
  target: SelectTarget;
  columns: Array<{ key: string; label: string; units: string }>;
  total: number;
  truncated: boolean;
  items: SelectItem[];
  total_length_m?: number;
  near_center?: { lon: number; lat: number; meters: number };
  geojson?: GeoJSON.FeatureCollection;
}

/** Вопрос → выборка (api/v1/ai/select): запрос модели и результат; error — запрос не прошёл проверку */
export interface AiSelectResult extends Partial<Omit<SelectResult, 'spec'>> {
  spec: SelectSpec;
  confidence: number;
  note: string;
  description: string;
  items: SelectItem[];
  total: number;
  error?: string;
}

export interface NetworkZone {
  zone: number;
  nodes_count: number;
  lines_count: number;
  source_node_ids: number[];
  sources: NetworkFeedPoint[];
  has_source: boolean;
  sample_node_id: number;
}

export interface NetworkZonesResponse {
  success: boolean;
  model: 'topology';
  zones_count: number;
  zones_with_source: number;
  islands_count: number;
  islands_nodes_count: number;
  zones: NetworkZone[];
}

/** Схемы установки шайбы бланка dross.py (поправка к располагаемому напору) */
export type OrificeScheme =
  | 'bezelevator' // безэлеваторный ввод, Нрас − 5
  | 'pump_mix' // перед насосами смешения, Нрас − 2
  | 'pre_nozzle' // перед соплом элеватора, Нрас
  | 'nozzle' // сопло элеватора (коэффициент 9.6), Нрас
  | 'ventilation' // на вентиляцию, Нрас − 5
  | 'heater' // перед водоводяным подогревателем, Нрас − 5
  | 'gvs_circulation'; // на циркуляционную линию ГВС, Нрас − 5

/** Расход — flow_g или нагрузка q_heating_*; напор — delta_h или p1/p2 */
export interface OrificePlateParams {
  flow_g?: number; // т/ч
  delta_h?: number; // располагаемый напор, м
  p1?: number; // атм
  p2?: number; // атм
  q_heating_gcal?: number; // Гкал/ч
  q_heating_kcal?: number; // ккал/ч
  t_supply?: number; // °С
  t_return?: number; // °С
  scheme?: OrificeScheme;
}

export interface OrificePlateResult {
  /** null — гасимого напора нет, шайба не рассчитывается (см. warning) */
  diameter_orifice_mm: number | null;
  recommended_standard_diameter: number | null;
  flow_g: number;
  available_head_m: number;
  head_loss_dissipated: number;
  scheme: OrificeScheme;
  warning: string | null;
}

/** Диафрагма циркуляционной линии открытой ГВС по движку sety (drvary1 b39–b41) */
export interface GvsCirculationParams {
  circulation_flow: number; // т/ч
  required_head: number; // a12, м
  circulation_loss: number; // a11, м
  return_head: number; // напор в обратном трубопроводе узла, м
  draw_from?: 'supply' | 'return';
  min_diameter?: number; // a15, мм
}

export interface EngineDiaphragm {
  diameter_mm: number;
  count: number;
  head_one_m: number;
  head_dissipated_m: number;
  head_residual_m: number;
  min_diameter_limited: boolean;
  flow_t_h: number;
  reason?: string;
}

export interface GvsCirculationResult extends Partial<Omit<EngineDiaphragm, 'diameter_mm'>> {
  available_head_m: number;
  draw_from: 'supply' | 'return';
  diameter_mm: number | null;
  warnings: string[];
}

/** Элеватор и диафрагма перед соплом по движку sety (drvary1, элеваторный ввод) */
export interface ElevatorEngineParams {
  available_head: number;
  heating_flow: number;
  mixing_ratio: number;
  system_loss: number;
  min_nozzle_diameter?: number;
  min_diameter?: number;
  regime?: number;
  circulation_head?: number;
  gvs_heater_loss?: number;
  gvs_sequential_flow?: number;
  graph_otop?: boolean;
  street_share?: number;
}

export interface ElevatorEngineResult {
  required_head_m: number;
  flow_t_h: number;
  nozzle_diameter_mm: number | null;
  nozzle_head_m: number | null;
  mixing_chamber_diameter_mm?: number;
  elevator_number: number | null;
  pre_nozzle: EngineDiaphragm | null;
  yard_facade: EngineDiaphragm | null;
  gvs_heater: EngineDiaphragm | null;
  warnings: string[];
}

/** Нормативные теплопотери (перенос desktop poteriNewPg) */
export interface HeatLossNormScopeSource {
  id: number;
  name: string | null;
  sourcename: string | null;
  sections: number;
  pipe_length: number | null;
  has_months: boolean;
  has_parameters: boolean;
  has_temp_graph: boolean;
}

export type HeatLossLosesType = 'norm' | 'fact';

export interface HeatLossNormSeason {
  id: number;
  name: string | null;
  city: string | null;
  d1: string | null;
  d2: string | null;
  a: number | null;
}

export interface HeatLossNormScope {
  season: { id: number; city: string | null; d1: string | null; d2: string | null; a: number | null };
  fragment_id: number | null;
  loses_type?: HeatLossLosesType;
  sources: HeatLossNormScopeSource[];
}

export type HeatLossPeriodTotals = Record<'potnp' | 'potno' | 'potpodz' | 'potall' | 'v1' | 'vall', number>;
export type HeatLossTotals = Record<'heating' | 'summer' | 'year', HeatLossPeriodTotals>;

export interface HeatLossNormRunSummary {
  id: number;
  name: string;
  user_gid: string | null;
  calculated_at: string | null;
  params: {
    season_id?: number;
    season?: string;
    loses_type?: HeatLossLosesType;
    fragment_id?: number | null;
    heat_source_ids?: number[];
    ready_source_ids?: number[];
    section_rows?: number;
    totals?: HeatLossTotals;
  };
}

export interface HeatLossNormRun extends HeatLossNormRunSummary {
  sources: { id: number; name: string | null; sourcename: string | null; has_months: boolean; sections: number }[];
  totals: HeatLossTotals;
  source_totals: Record<string, HeatLossTotals>;
  section_counts: { rows?: number; lines?: number; length?: number };
  sheets?: Record<string, Record<string, any>[]>;
}

export interface HeatLossNormSection {
  id: number;
  lineid: number;
  truba: number;
  name_typ: string | null;
  diametr: number | null;
  diametr_usl: number | null;
  dlina: number | null;
  year: number | null;
  kolwork: number | null;
  kti: number | null;
  beta: number | null;
  q: number | null;
  kod_ist: string | null;
  loss_gcal_h: number | null;
  loss_gcal_year: number | null;
  longitude: number | null;
  latitude: number | null;
  [key: string]: any;
}

export type TemperatureGraphMode = 'auto' | 'otop' | 'pov' | 'skk_pov' | 'skk_pon';

export interface TemperatureGraphPreview {
  mode: Exclude<TemperatureGraphMode, 'auto'>;
  name: string | null;
  points: Record<string, number>[];
  errors: number[];
  message: string | null;
}

export interface ElevatorNozzleParams {
  q_heating_gcal?: number; // Гкал/ч
  flow_g?: number; // т/ч
  p1: number; // атм
  p2: number; // атм
  t1?: number; // °C
  t2?: number; // °C
  t3?: number; // °C
  delta_h_system?: number; // м.в.ст
}

export interface ElevatorNozzleResult {
  mixing_ratio_u: number;
  nozzle_diameter_mm: number;
  mixing_chamber_diameter_mm: number;
  elevator_number: number;
  available_head_m: number;
  dissipated_head_m: number;
  /** ≈ 1.4·hс·(1+u)² — ниже него элеватор не обеспечит смешение */
  required_head_m: number;
  flow_g: number;
  t1: number;
  t2: number;
  t3: number;
  warnings: string[];
}

export interface ThrottlingSheetParams {
  district?: string;
  site_name?: string;
  consumer_name?: string;
  address?: string;
  p1: number; // атм
  p2: number; // атм
  q_heating_gcal?: number;
  q_vent_gcal?: number;
  q_gvs_gcal?: number; // максимальная нагрузка ГВС
  t1?: number;
  t2?: number;
  t3?: number;
  signers?: { position?: string; name?: string }[];
  organization?: string;
}

export interface CalculationSummaryItem {
  id: number;
  name: string;
  calculated_at: string;
  fileid: number | null;
}

/** plan — плановый (десктоп «Плановый…», sety с -dross); emergency — аварийный/фактический (без -dross) */
export type SetyCalcMode = 'plan' | 'emergency';

/** Тело POST api/v1/calculations/run; несколько fragment_ids — «по списку» (по очереди) */
export interface SetyRunRequest {
  mode: SetyCalcMode;
  fragment_ids: number[];
  name?: string;
  tn: number;
  sopr?: number;
  ro_p?: number;
  ro_o?: number;
  ro_temp?: boolean;
  char_sety?: boolean;
  mag_fragment?: boolean;
  use_kv?: boolean;
  veter?: boolean;
  avtomat?: boolean;
  // только плановый
  tg?: boolean;
  teplopoter?: boolean;
  uf_calc?: boolean;
  save_uf_new?: boolean;
  teplovyd?: boolean;
  dross_yes?: boolean;
  save_po?: boolean;
  utechki?: boolean;
  trtp?: number;
  iter?: number;
  // только аварийный
  consumer_resistance?: 'detailed' | 'equivalent';
  leto?: boolean;
  save_leto?: boolean;
}

export interface SetyRunResponse {
  message: string;
  task_id: string;
  request_id: string;
  mode: SetyCalcMode;
  fragment_ids: number[];
  params: string;
}

export interface CalculationTemperatureRange {
  t_or: number | null;
  t_vnew: number | null;
}

export interface CalculationListItem {
  id: number;
  fileid: number | null;
  fragment_name: string | null;
  calculated_at: string | null;
  tn: number | null;
  name: string | null;
  user_gid: string | null;
  calc_plan: number | null;
  is_latest: boolean;
  has_results: boolean;
  mode: SetyCalcMode | null;
  params: Record<string, number | string> | null;
}

export interface CalculationListResponse {
  total: number;
  items: CalculationListItem[];
}

export interface CalculationListFilter {
  file_id?: number | null;
  mode?: SetyCalcMode | null;
  author?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  limit?: number;
  offset?: number;
}

/** Пункт каталога Excel-отчётов (GET api/reports/catalog) */
export interface ReportCatalogItem {
  id: string;
  title: string;
  group: string;
  /** desktop — шаблон и SQL gid6 excel2; summary — сводная ведомость веба (api/reports/excel) */
  kind: 'desktop' | 'summary';
  desktop: string | null;
  note: string | null;
  uses_calculation: boolean;
  params: {
    fragment_id: 'required' | null;
    calculation_id: 'optional' | null;
    year?: 'optional' | null;
  };
  sheets: { title: string; sql: string | null }[];
}

export interface ReportsCatalog {
  items: ReportCatalogItem[];
  not_ported: { sql: string; reason: string }[];
}

export type UserRole = 'viewer' | 'calculator' | 'operator' | 'editor' | 'admin';

export interface AdminUser {
  /** UsersDB — число; AUTH_BACKEND=pg — имя роли tgid_u_<логин> */
  id: number | string;
  username: string;
  role: UserRole;
  is_active: boolean;
  is_admin?: boolean;
  /** AUTH_BACKEND=pg (docs/pg-auth.md) */
  role_name?: string;
  display_name?: string | null;
  full_name?: string | null;
  caps?: string[];
  /** Фрагменты правки; [] — вся сеть */
  fragments?: number[];
  web_access?: boolean;
  /** UsersDB: отличия прав от шаблона роли и действующие права (itwin-api permissions.py) */
  permissions?: ServerPermissionsDiff;
  effective?: ServerPermissions;
  password_set?: boolean;
  must_change_password?: boolean;
  legacy_right?: number | null;
  /** UsersDB: коды городов с доступом; null — все города */
  cities?: string[] | null;
}

/** Город (база ТГИД): код, название, путь веба (/tgid/astana/) */
export interface CityItem {
  code: string;
  label: string;
  path: string;
}

export interface AdminUserUpdate {
  role?: UserRole;
  is_active?: boolean;
  caps?: string[];
  fragments?: number[];
  display_name?: string | null;
  full_name?: string | null;
  web_access?: boolean;
  /** null — все города */
  cities?: string[] | null;
  /** UsersDB: отличия прав от шаблона роли; null — права роли как есть */
  permissions?: ServerPermissionsDiff | null;
}

/** Отличия прав пользователя от шаблона роли (users.permissions) */
export interface ServerPermissionsDiff {
  matrix?: PermMatrix;
  general?: Record<string, boolean>;
}

/** Модель прав для админки (permissions.catalog) */
export interface PermissionsModel {
  kinds: { kind: PermKind; label: string; actions: PermAction[] }[];
  actions: { action: PermAction; label: string }[];
  scopes: { scope: PermScope; label: string }[];
  general: { key: string; label: string }[];
  roles: { role: UserRole; label: string; description: string; permissions: Required<ServerPermissions> }[];
}

export interface AdminCap {
  cap: string;
  description: string;
}

export interface AdminUsersResponse {
  items: AdminUser[];
  can_write: boolean;
  note: string | null;
  /** Логин мастер-учётки владельца (вне списка; удалить и заблокировать нельзя); null — не настроена */
  master_login?: string | null;
  /** Справочник городов и город этого API (доступ пользователей UsersDB к городам) */
  cities_catalog?: CityItem[];
  current_city?: string;
}

export interface AdminRole {
  role: UserRole;
  level: number;
  description: string;
  label?: string;
}

export interface TopologyHistoryItem {
  operation_id: number;
  operation: string;
  created_at: string | null;
  undone_at: string | null;
  redone_at: string | null;
  summary: Record<string, any>;
  objects: number;
  undo_supported: boolean;
  /** [minLng, minLat, maxLng, maxLat] — «Показать на карте» */
  bbox: number[] | null;
}

export interface DissolveJoin {
  keep: number;
  remove: number;
  length_m: number;
  sign: number;
}

export interface NodeDeletePreview {
  node_id: number;
  node_type: string;
  lines: { id: number; other: number; sign: number; length_m: number | null; du: number | null }[];
  references: Record<string, number>;
  dissolve: { ok: boolean; reasons: string[]; joins: DissolveJoin[] };
}

export interface LineDeletePreview {
  id: number;
  nodeid1: number;
  nodeid2: number;
  sign: number;
  length_m: number | null;
  passport_id: number | null;
  du: number | null;
  equipment: Record<string, number>;
  pair_line_id: number | null;
  pair_equipment: Record<string, number>;
}

export interface DissolveResult {
  node_id: number;
  ok: boolean;
  joined?: { line_id: number; removed_line_id: number; length_m: number }[];
  reasons?: string[];
  line_id?: number;
  removed_lines?: number[];
  operation_id?: number | null;
}

export interface ActivityLogItem {
  id: number;
  at: string | null;
  username: string | null;
  city: string | null;
  action: string;
  action_label: string;
  method: string | null;
  path: string | null;
  status: number | null;
  duration_ms: number | null;
  ip: string | null;
  user_agent: string | null;
  details: string | null;
}

export interface ActivityLogQuery {
  username?: string;
  action?: string;
  city?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
  failed?: boolean;
}

export interface ActivityLogResponse {
  items: ActivityLogItem[];
  total: number;
  page: number;
  page_size: number;
  lookups: { users: string[]; cities: string[]; actions: { value: string; title: string }[] };
}


export interface AuditChange {
  field: string;
  old: any;
  new: any;
}

export interface AuditLogItem {
  log_id: number;
  changed_at: string | null;
  changed_by: string | null;
  operation: string | null;
  table_name: string | null;
  record_id: number | null;
  changes: AuditChange[];
  comment?: string | null;
  node_id?: number | null;
  change_group_id?: string | null;
  is_rolled_back?: boolean | null;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
}

export interface AuditLogFilter {
  table?: string | null;
  record_id?: number | null;
  changed_by?: string | null;
  operation?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  change_group_id?: string | null;
  page?: number;
  page_size?: number;
}

export interface AuditLogResponse extends PaginatedResponse<AuditLogItem> {
  note?: string;
}

export interface AuditLookups {
  tables: { name: string; count: number }[];
  users: { name: string; count: number }[];
  operations: { name: string; count: number }[];
}

export interface CalculationDeleteResponse {
  success: boolean;
  calculation_id: number;
  deleted_rows: Record<string, number>;
}

export interface CalculationGeoJsonResponse {
  type: 'FeatureCollection';
  summary?: {
    calculation_id: number;
    lines_count: number;
    nodes_count: number;
    high_velocity_count: number;
    over_resistance_count: number;
  };
  features: any[];
}
