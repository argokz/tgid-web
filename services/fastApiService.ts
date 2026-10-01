import { reactive } from 'vue';
import type { FeatureData, Fragment } from '~/types';
import type {
  NetworkImportInspect,
  NetworkImportMode,
  NetworkImportParams,
  NetworkImportReport,
} from '~/utils/networkImport';

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

/** Тело запроса без неопределённых полей (версия не передана — сервер её не проверяет) */
const compact = <T extends Record<string, any>>(body: T): T =>
  Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== null)) as T;

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
}

export interface ValveToClose {
  id: number;
  lineid: number;
  display_name: string;
  nominal_diameter: number;
  state_id: number;
  state_name: string;
  lng: number | null;
  lat: number | null;
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

export type UserRole = 'viewer' | 'calculator' | 'editor' | 'admin';

export interface AdminUser {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
  is_admin: boolean;
}

export interface AdminUsersResponse {
  items: AdminUser[];
  can_write: boolean;
  note: string | null;
}

export interface AdminRole {
  role: UserRole;
  level: number;
  description: string;
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


const translationCache: TranslationCache = {};
const pendingTranslationRequests = new Map<string, Promise<ColumnTranslation>>();
const DEFAULT_MAP_API_BASE_URL = 'http://localhost:8000';

const getApiBaseUrl = (): string => {
  try {
    const runtimeConfig = useRuntimeConfig() as any;
    const configured =
      runtimeConfig.public?.mapApiBaseUrl ||
      runtimeConfig.public?.externalApiUrl ||
      DEFAULT_MAP_API_BASE_URL;
    return String(configured).replace(/\/+$/, '');
  } catch {
    return DEFAULT_MAP_API_BASE_URL;
  }
};

const buildApiUrl = (path: string): string => `${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`;

/** Ошибка API с разобранным статусом и текстом для пользователя */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly path: string;
  readonly userMessage: string;
  /** Структурированный detail ответа (например, {code, conflicts} у 409), если он был объектом */
  readonly data: any;
  /** Сервер ответил своим текстом detail (не FastAPI «Not Found») — маршрут существует */
  readonly hasServerDetail: boolean;

  constructor(params: {
    status: number; detail: string; path: string; userMessage: string; data?: any; hasServerDetail?: boolean;
  }) {
    super(params.userMessage);
    this.name = 'ApiError';
    this.status = params.status;
    this.detail = params.detail;
    this.path = params.path;
    this.userMessage = params.userMessage;
    this.data = params.data ?? null;
    this.hasServerDetail = params.hasServerDetail ?? false;
  }

  /** 409: объект изменён/удалён другим пользователем после того, как его прочитали */
  get isVersionConflict(): boolean {
    return this.status === 409 && this.data?.code === 'version_conflict';
  }

  /** Маршрута нет на сервере — обычно развёрнута устаревшая версия API.
   *  404 с кодом или своим текстом в detail (nothing_to_undo, «Фрагмент не найден») —
   *  ответ существующего маршрута. */
  get isRouteMissing(): boolean {
    return this.status === 404 && !this.data?.code && !this.hasServerDetail && !this.path.match(/\/\d+$/);
  }

  /** Сеть/сервер недоступны */
  get isUnavailable(): boolean {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;
/** Excel-отчёты по всему фрагменту: запросы ограничены на сервере 60 с, плюс сборка книги */
const REPORT_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

/** Ретраим только то, что имеет шанс пройти со второй попытки */
const isRetriableStatus = (status: number) =>
  status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600);

const extractStatus = (error: any): number =>
  Number(error?.statusCode ?? error?.status ?? error?.response?.status ?? 0) || 0;

const BLOCKER_LABELS: Record<string, string> = {
  references: 'ссылки на узел',
  incident_lines: 'инцидентные участки',
  internal_scheme_lines: 'линии внутренней схемы узла',
  connecting_lines: 'соединяющие участки с оборудованием',
  equipment: 'оборудование, зависящее от направления',
  requires_confirmation: 'требуется подтверждение в превью',
  different_fragments: 'узлы из разных фрагментов',
  different_internal_scheme: 'узлы из разных внутренних схем',
  target_without_geometry: 'у целевого узла нет геометрии',
  conflicting_references: 'у обоих узлов есть единичные объекты',
};

const OBJECT_KIND_LABELS: Record<string, string> = {
  node: 'узел',
  line: 'участок',
  // конфликты отмены: строки таблиц, затронутые операцией
  nodes: 'узел',
  linesobj: 'участок',
  heatpipesections: 'паспорт трубы',
  operation: 'последняя операция',
};

/** 409 version_conflict: {conflicts: {"node:5": {removed, changed_at}}} → «узел 5 (изменён 27.09 15:51)» */
export const formatVersionConflict = (detail: { message?: string; conflicts?: Record<string, any> }): string => {
  const parts = Object.entries(detail.conflicts || {}).map(([key, info]) => {
    const [kind, id] = key.split(':');
    const label = id ? `${OBJECT_KIND_LABELS[kind] || kind} ${id}` : OBJECT_KIND_LABELS[kind] || kind;
    if (info?.removed) return `${label} удалён`;
    const at = info?.changed_at ? new Date(info.changed_at) : null;
    return at && !Number.isNaN(at.getTime())
      ? `${label} изменён ${at.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
      : `${label} изменён`;
  });
  return [detail.message || 'Объект изменён другим пользователем', parts.join('; ')].filter(Boolean).join(': ');
};

const formatBlockerValue = (value: any): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => (v && typeof v === 'object' ? `${k}: ${formatBlockerValue(v)}` : `${k} ×${v}`))
      .join('; ');
  }
  return String(value);
};

/** 409 топологии: {message, blockers} → «сообщение: ссылки на узел — pressregulators.nodeid ×1» */
export const formatTopologyBlockers = (detail: { message?: string; blockers?: Record<string, any> }): string => {
  const parts = Object.entries(detail.blockers || {}).map(
    ([key, value]) => `${BLOCKER_LABELS[key] || key} — ${formatBlockerValue(value)}`
  );
  return [detail.message, parts.join('; ')].filter(Boolean).join(': ');
};

const extractDetail = (error: any): string => {
  const data = error?.data ?? error?.response?._data;
  if (typeof data === 'string') return data;
  if (data?.detail) {
    if (typeof data.detail === 'string') return data.detail;
    if (data.detail.code === 'version_conflict') return formatVersionConflict(data.detail);
    if (data.detail.blockers) return formatTopologyBlockers(data.detail);
    return JSON.stringify(data.detail);
  }
  return error?.message || 'неизвестная ошибка';
};

const userMessageFor = (status: number, detail: string, path: string): string => {
  if (status === 0) return 'Сервер API недоступен. Проверьте подключение к сети.';
  if (status === 401) return 'Требуется авторизация.';
  if (status === 403) return 'Недостаточно прав для этой операции.';
  if (status === 404) {
    return path.match(/\/\d+$/)
      ? 'Запись не найдена.'
      : 'Маршрут отсутствует на сервере API — вероятно, развёрнута устаревшая версия.';
  }
  if (status === 408 || status === 504) return 'Сервер не ответил вовремя. Попробуйте ещё раз.';
  if (status === 422) return `Некорректные параметры запроса: ${detail}`;
  if (status === 429) return 'Слишком много запросов, попробуйте позже.';
  if (status >= 500) return `Ошибка на сервере: ${detail}`;
  return detail;
};

/** Доступность API — для индикатора деградации в интерфейсе */
export const apiHealth = reactive({
  reachable: true,
  outdatedRoutes: false,
  redisOk: true,
  lastError: '' as string,
});

/** Итог последнего /health: устаревший API или Redis — баннер держится, пока health не скажет иначе */
const healthState = { outdated: false, note: '' };

/** Успешный ответ: снять «недоступен» и разовое «маршрут отсутствует», вернуть текст health (QA F76) */
const markApiResponded = () => {
  apiHealth.reachable = true;
  apiHealth.outdatedRoutes = healthState.outdated;
  apiHealth.lastError = healthState.note;
};

export const refreshApiHealth = async () => {
  try {
    const health = await fastApiService.getHealth();
    healthState.outdated = (health.routes || 0) < 80;
    apiHealth.redisOk = health.redis?.ok !== false;
    if (healthState.outdated) {
      healthState.note =
        `На сервере устаревший API (${health.routes} маршрутов). Нужен деплой актуального itwin-api.`;
    } else if (!apiHealth.redisOk) {
      healthState.note =
        health.redis?.note ||
        'Redis недоступен: расчёт sety и запуск теплопотерь не будут работать.';
    } else {
      healthState.note = '';
    }
    markApiResponded();
  } catch (e: any) {
    apiHealth.reachable = false;
    apiHealth.lastError = e?.message || 'API недоступен';
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ACCESS_TOKEN_KEY = 'itwin_access_token';

const authHeaders = (): Record<string, string> => {
  if (typeof localStorage === 'undefined') return {};
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Единая точка сетевых вызовов: таймаут, ретраи с экспоненциальной паузой
 * только для сетевых сбоев и 5xx, нормализация ошибки.
 * Мутации (POST/PUT/DELETE) не повторяются — чтобы не задвоить запись.
 */
const request = async <T>(path: string, options?: any): Promise<T> => {
  const url = buildApiUrl(path.startsWith('/') ? path.slice(1) : path);
  const method = String(options?.method || 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';
  const maxAttempts = isMutation ? 1 : MAX_RETRIES + 1;

  // JWT уходит со всеми вызовами API: при AUTH_REQUIRED_GET сервер закрывает
  // и POST-расчёты (пьезометр, калькуляторы, локализация), не только чтение
  const headers = { ...authHeaders(), ...(options?.headers || {}) };

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await $fetch<T>(url, {
        timeout: DEFAULT_TIMEOUT_MS,
        ...(options || {}),
        headers,
      });
      markApiResponded();
      return result;
    } catch (error: any) {
      lastError = error;
      const status = extractStatus(error);

      if (attempt < maxAttempts && isRetriableStatus(status)) {
        // экспоненциальная пауза с джиттером — чтобы не «долбить» сервер синхронно
        const backoff = 400 * 2 ** (attempt - 1) + Math.random() * 200;
        console.warn(`[api] ${method} ${path} → ${status}, повтор через ${Math.round(backoff)}ms`);
        await sleep(backoff);
        continue;
      }

      const detail = extractDetail(error);
      const rawDetail = (error?.data ?? error?.response?._data)?.detail;
      const hasServerDetail = typeof rawDetail === 'string' && rawDetail !== '' && rawDetail !== 'Not Found';
      const apiError = new ApiError({
        status,
        detail,
        path,
        userMessage: status === 404 && hasServerDetail ? detail : userMessageFor(status, detail, path),
        data: rawDetail && typeof rawDetail === 'object' ? rawDetail : null,
        hasServerDetail,
      });

      if (apiError.isUnavailable) {
        apiHealth.reachable = false;
        apiHealth.lastError = apiError.userMessage;
      } else if (apiError.isRouteMissing) {
        apiHealth.outdatedRoutes = true;
        apiHealth.lastError = apiError.userMessage;
      }

      throw apiError;
    }
  }

  throw lastError;
};

/** Совместимость: раньше использовался отдельный хелпер с ретраями */
const fetchWithRetry = <T>(url: string, options: any = {}): Promise<T> =>
  request<T>(url.replace(getApiBaseUrl(), ''), options);

const encodePath = (value: string | number): string => encodeURIComponent(String(value));

const mutationOptions = (method: string, body?: any): Record<string, any> => {
  const options: Record<string, any> = { method, headers: authHeaders() };
  if (body !== undefined) options.body = body;
  return options;
};

const mutationWithFallback = async <T>(
  primaryPath: string,
  fallbackPath: string,
  options: Record<string, any>
): Promise<T> => {
  try {
    return await request<T>(primaryPath, options);
  } catch {
    return request<T>(fallbackPath, options);
  }
};

/** Виды фоновых файлов API (database/file_jobs.py) */
export type FileJobKind =
  | 'passport'
  | 'report_excel'
  | 'catalog_report'
  | 'alseko_reconciliation'
  | 'electrical_reconciliation';

/** Статус фоновой выгрузки (GET api/v1/file-jobs/{task_id}) */
export interface FileJobStatus {
  task_id: string;
  state: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | string;
  ready: boolean;
  success: boolean | null;
  message: string | null;
  kind?: string | null;
  filename?: string;
  size?: number;
  elapsed_s?: number | null;
  status_code?: number | null;
}

export interface FileJobProgress {
  phase: 'queued' | 'running' | 'downloading' | 'fallback';
  elapsedMs: number;
  message: string;
}

export interface FileJobOptions {
  onProgress?: (progress: FileJobProgress) => void;
  signal?: AbortSignal;
  /** Сколько ждать, пока воркер возьмёт задачу, прежде чем перейти на синхронный эндпоинт */
  pendingFallbackMs?: number;
  timeoutMs?: number;
  pollMs?: number;
}

/** Текст прогресса фоновой выгрузки для UI: «Формирование файла… 7 с» */
export const describeFileJobProgress = (p: FileJobProgress | null | undefined): string =>
  p ? `${p.message} ${Math.round(p.elapsedMs / 1000)} с` : '';

const FILE_JOB_PENDING_FALLBACK_MS = 30_000;
const FILE_JOB_TIMEOUT_MS = 10 * 60_000;

const filenameFromDisposition = (header: string | null | undefined): string | null => {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* ниже — ASCII-имя */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
};

/** Полнота сводной ведомости Excel (заголовки X-Report-Rows/Total/Truncated/Fragments, QA F14) */
export interface ExcelReportMeta {
  rows: number;
  total: number;
  truncated: boolean;
  fragments: number[];
}

type HeaderGetter = (name: string) => string | null | undefined;

export const parseExcelReportMeta = (get: HeaderGetter): ExcelReportMeta | undefined => {
  const rows = Number(get('x-report-rows'));
  const totalRaw = get('x-report-total');
  if (totalRaw == null || totalRaw === '' || !Number.isFinite(rows)) return undefined;
  const total = Number(totalRaw);
  if (!Number.isFinite(total)) return undefined;
  const fragments = String(get('x-report-fragments') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return { rows, total, truncated: get('x-report-truncated') === '1' || total > rows, fragments };
};

/** Текст предупреждения о неполной ведомости или null, если выгружено всё */
export const describeExcelReportTruncation = (meta: ExcelReportMeta | undefined): string | null =>
  meta?.truncated
    ? `Ведомость неполная: выгружено ${meta.rows} из ${meta.total} строк. ` +
      (meta.fragments.length ? 'Сузьте выбор фрагментов.' : 'Выберите фрагмент на карте, чтобы выгрузить её полностью.')
    : null;

/**
 * Единый путь тяжёлых выгрузок: задача Celery → опрос статуса → скачивание файла из Redis.
 * Если фоновые файлы недоступны (старый API, нет Redis, воркер не берёт задачу) — вызывается
 * `fallback` (синхронный эндпоинт того же файла). `onHeaders` получает заголовки ответа со скачанным файлом.
 */
const runFileJob = async (
  kind: FileJobKind,
  params: Record<string, unknown>,
  fallback: (() => Promise<{ blob: Blob; filename: string }>) | null,
  options: FileJobOptions = {},
  onHeaders?: (get: HeaderGetter) => void,
): Promise<{ blob: Blob; filename: string }> => {
  const started = Date.now();
  const report = (phase: FileJobProgress['phase'], message: string) =>
    options.onProgress?.({ phase, message, elapsedMs: Date.now() - started });
  const pendingLimit = options.pendingFallbackMs ?? FILE_JOB_PENDING_FALLBACK_MS;
  const timeout = options.timeoutMs ?? FILE_JOB_TIMEOUT_MS;
  const pollMs = options.pollMs ?? 1000;
  const runFallback = async (reason: string) => {
    if (!fallback) throw new Error(reason);
    report('fallback', 'Формирование файла на сервере (синхронно)…');
    return fallback();
  };

  let taskId: string;
  try {
    const job = await request<{ task_id: string }>('api/v1/file-jobs', mutationOptions('POST', { kind, params }));
    taskId = job.task_id;
  } catch (e: any) {
    // 4xx по параметрам — ошибка пользователя; 404/5xx/сеть — фоновые файлы недоступны
    if (e instanceof ApiError && e.status && e.status >= 400 && e.status < 500 && e.status !== 404) throw e;
    return runFallback(e?.message || 'Фоновые выгрузки недоступны');
  }
  report('queued', 'Задача в очереди…');

  for (;;) {
    if (options.signal?.aborted) throw new Error('Отменено');
    await sleep(pollMs);
    const status = await request<FileJobStatus>(`api/v1/file-jobs/${encodePath(taskId)}`);
    const elapsed = Date.now() - started;
    if (status.state === 'PENDING') {
      if (elapsed > pendingLimit) {
        if (fallback) return runFallback('Воркер не взял задачу');
        throw new Error('Воркер не взял задачу формирования файла');
      }
      report('queued', 'Задача в очереди…');
      continue;
    }
    if (!status.ready) {
      report('running', status.message || 'Формирование файла…');
      if (elapsed > timeout) throw new Error('Формирование файла не уложилось в отведённое время');
      continue;
    }
    if (!status.success) throw new Error(status.message || 'Не удалось сформировать файл');
    report('downloading', 'Скачивание…');
    const url = buildApiUrl(`api/v1/file-jobs/${encodePath(taskId)}/download`);
    let disposition: string | null = null;
    const blob = await $fetch<Blob>(url, {
      responseType: 'blob',
      timeout: REPORT_TIMEOUT_MS,
      headers: authHeaders(),
      onResponse({ response }: any) {
        disposition = response?.headers?.get?.('content-disposition') ?? null;
        if (onHeaders && response?.headers?.get) onHeaders((name) => response.headers.get(name));
      },
    });
    return { blob, filename: filenameFromDisposition(disposition) || status.filename || `${kind}.xlsx` };
  }
};

export const fastApiService = {
  request,

  /** Фоновая выгрузка файла: задача → статус → скачивание (см. runFileJob) */
  runFileJob(
    kind: FileJobKind,
    params: Record<string, unknown>,
    options: FileJobOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    return runFileJob(kind, params, null, options);
  },
  async startFileJob(kind: FileJobKind, params: Record<string, unknown>): Promise<{ task_id: string }> {
    return request('api/v1/file-jobs', mutationOptions('POST', { kind, params }));
  },
  async getFileJobStatus(taskId: string): Promise<FileJobStatus> {
    return request(`api/v1/file-jobs/${encodePath(taskId)}`);
  },

  async getObjectData(
    typeObject: string,
    nameObject: string,
    id: string | number
  ): Promise<FeatureData> {
    return fetchWithRetry<FeatureData>(
      buildApiUrl(`${encodePath(typeObject)}/${encodePath(nameObject)}/${encodePath(id)}`)
    );
  },

  async getFragments(): Promise<{ data: Fragment[] }> {
    return fetchWithRetry<{ data: Fragment[] }>(buildApiUrl('fragments'));
  },

  /** Экспорт фрагмента в .tgid десктопа (zip с tgid.txt) */
  async exportFragmentTgid(fileId: number): Promise<Blob> {
    return request<Blob>(`api/v1/fragments/${encodePath(fileId)}/export`, {
      ...mutationOptions('GET'),
      responseType: 'blob',
    });
  },

  /** Импорт .tgid новым фрагментом: dry_run — превью в откатываемой транзакции */
  async importFragmentTgid(file: File, opts: { name?: string; dryRun: boolean }): Promise<FragmentTransferReport> {
    const form = new FormData();
    form.append('file', file);
    if (opts.name) form.append('name', opts.name);
    form.append('dry_run', String(opts.dryRun));
    return request<FragmentTransferReport>('api/v1/fragments/import', mutationOptions('POST', form));
  },

  /** Слияние фрагментов (десктоп unite_tgid): копии сводятся в новый фрагмент */
  async mergeFragments(body: {
    fragment_ids: number[];
    name?: string;
    unify_external_codes?: boolean;
    dry_run: boolean;
  }): Promise<FragmentTransferReport> {
    return request<FragmentTransferReport>('api/v1/fragments/merge', mutationOptions('POST', body));
  },

  async postRunSetyCmd(params: string): Promise<any> {
    return request('run-sety-cmd', mutationOptions('POST', { params }));
  },

  async login(
    username: string,
    password: string,
    role?: string
  ): Promise<{
    access_token: string;
    token_type: string;
    role: string;
    username: string;
  }> {
    const body: Record<string, string> = { username, password };
    if (role) body.role = role;
    return request('api/v1/auth/login', {
      method: 'POST',
      body,
    });
  },

  async getAuthConfig(): Promise<{
    auth_disabled: boolean;
    dev_login_enabled: boolean;
    strict_auth: boolean;
    mutations_enabled: boolean;
    topology_mutations_enabled: boolean;
  }> {
    return request('api/v1/auth/config');
  },

  async authMe(): Promise<{
    sub: string;
    username: string;
    role: string;
    mutations_enabled: boolean;
    topology_mutations_enabled: boolean;
    auth_disabled: boolean;
    dev_login_enabled?: boolean;
    strict_auth?: boolean;
  }> {
    return request('api/v1/auth/me', mutationOptions('GET'));
  },

  async getTaskStatus(taskId: string): Promise<any> {
    return request(`task/${encodePath(taskId)}`);
  },

  async getPiezometerPath(start: number, end: number): Promise<any> {
    return request('piezometer/path', { query: { start, end } });
  },

  /** Маршрут пьезометра через последовательность узлов (waypoints) */
  async buildPiezometerRoute(nodes: number[], calculationId2?: number | null): Promise<PiezometerRouteResponse> {
    return request<PiezometerRouteResponse>('piezometer/route', {
      method: 'POST',
      body: calculationId2 ? { nodes, calculation_id_2: calculationId2 } : { nodes },
    });
  },

  /** Сохранённые направления пьезометра (десктоп «Список направлений») */
  async listPiezometerDirections(fileIds?: number[]): Promise<{ items: PiezometerDirection[]; count: number }> {
    return request('piezometer/directions', fileIds?.length ? { query: { fileid: fileIds } } : {});
  },

  async getPiezometerDirection(id: number): Promise<PiezometerDirectionDetail> {
    return request(`piezometer/directions/${encodePath(id)}`);
  },

  async savePiezometerDirection(body: { name: string; nodes: number[]; fileid?: number | null; replace?: boolean }): Promise<PiezometerDirectionDetail & { replaced: number[] }> {
    return request('piezometer/directions', mutationOptions('POST', body));
  },

  async deletePiezometerDirection(id: number): Promise<{ deleted: number }> {
    return request(`piezometer/directions/${encodePath(id)}`, mutationOptions('DELETE'));
  },

  /** Время прохождения потока по маршруту (десктоп OnTimePr) — те же waypoints, что у пьезометра */
  async getTravelTime(nodes: number[], calculationId?: number): Promise<TravelTimeResponse> {
    return request<TravelTimeResponse>('api/analysis/travel-time', {
      method: 'POST',
      body: { nodes, ...(calculationId ? { calculation_id: calculationId } : {}) },
    });
  },

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
  async deleteLine(lineId: number, expectedVersion?: string, expectedSectionId?: number | null): Promise<any> {
    const query = compact({ expected_version: expectedVersion, expected_section_id: expectedSectionId ?? undefined });
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
    ref: { fileid?: number; nearNodeId?: number; nearLineId?: number } = {}
  ): Promise<{ success: boolean; id: number; fileid: number | null; operation_id?: number | null }> {
    return request('api/topology/node', {
      method: 'POST',
      body: compact({ lng, lat, fileid: ref.fileid, near_node_id: ref.nearNodeId, near_line_id: ref.nearLineId }),
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

  async deleteNode(id: number, expectedVersion?: string): Promise<any> {
    return request(`api/topology/node/${encodePath(id)}`, {
      method: 'DELETE',
      ...(expectedVersion ? { query: { expected_version: expectedVersion } } : {}),
    });
  },

  async getDefects(filters: JournalFilters = {}): Promise<PaginatedResponse<DefectSummary>> {
    return request('api/defects', { query: filters });
  },
  async getDefect(id: number): Promise<DefectDetails> {
    return request(`api/defects/${encodePath(id)}`);
  },
  async getDefectLookups(): Promise<DefectLookups> {
    return request('api/defects/lookups');
  },

  async getShurfs(filters: JournalFilters = {}): Promise<PaginatedResponse<ShurfSummary>> {
    return request('api/shurfs', { query: filters });
  },
  async getShurf(id: number): Promise<ShurfDetails> {
    return request(`api/shurfs/${encodePath(id)}`);
  },
  async getShurfLookups(): Promise<ShurfLookups> {
    return request('api/shurfs/lookups');
  },

  async getInspections(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<InspectionSummary>> {
    return request('api/inspections', { query: filters });
  },
  async getInspection(id: number): Promise<InspectionDetails> {
    return request(`api/inspections/${encodePath(id)}`);
  },
  async getInspectionLookups(): Promise<InspectionLookups> {
    return request('api/inspections/lookups');
  },

  async getRepairs(filters: JournalFilters = {}): Promise<PaginatedResponse<RepairSummary>> {
    return request('api/repairs', { query: filters });
  },
  async getRepair(id: number): Promise<RepairDetails> {
    return request(`api/repairs/${encodePath(id)}`);
  },
  async getRepairLookups(): Promise<RepairLookups> {
    return request('api/repairs/lookups');
  },

  async getPressureTests(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<PressureTestSummary>> {
    return request('api/pressure-tests', { query: filters });
  },
  async getPressureTest(id: number): Promise<PressureTestDetails> {
    return request(`api/pressure-tests/${encodePath(id)}`);
  },
  async getPressureTestLookups(): Promise<PressureTestLookups> {
    return request('api/pressure-tests/lookups');
  },

  async getTechnicalConditions(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<TechnicalConditionSummary>> {
    return request('api/technical-conditions', { query: filters });
  },
  async getTechnicalCondition(id: number): Promise<TechnicalConditionDetails> {
    return request(`api/technical-conditions/${encodePath(id)}`);
  },
  async getTechnicalConditionLookups(): Promise<TechnicalConditionLookups> {
    return request('api/technical-conditions/lookups');
  },
  async getTechnicalConditionBalance(year?: number): Promise<{
    year: number | null;
    capacity_year?: number | null;
    notes?: string | null;
    items: Array<Record<string, number | string>>;
    totals: Record<string, number>;
  }> {
    return request('api/technical-conditions/balance', {
      query: year ? { year } : {},
    });
  },
  async createTechnicalCondition(fields: Record<string, any>): Promise<{ id: number }> {
    return request(
      'api/v1/technical-conditions',
      mutationOptions('POST', { fields })
    );
  },
  async updateTechnicalCondition(
    id: number,
    fields: Record<string, any>
  ): Promise<{ success: boolean }> {
    return request(
      `api/v1/technical-conditions/${encodePath(id)}`,
      mutationOptions('PUT', { fields })
    );
  },
  async deleteTechnicalCondition(id: number): Promise<{ success: boolean }> {
    return request(
      `api/v1/technical-conditions/${encodePath(id)}`,
      mutationOptions('DELETE')
    );
  },

  async getCorrosionIndicators(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<CorrosionIndicatorSummary>> {
    return request('api/corrosion-indicators', { query: filters });
  },
  async getCorrosionIndicator(id: number): Promise<CorrosionIndicatorDetails> {
    return request(`api/corrosion-indicators/${encodePath(id)}`);
  },
  async getCorrosionIndicatorLookups(): Promise<CorrosionIndicatorLookups> {
    return request('api/corrosion-indicators/lookups');
  },

  async getAlsekoLoads(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<AlsekoLoadSummary>> {
    return request('api/alseko/loads', { query: filters });
  },
  async getAlsekoLoad(id: number): Promise<AlsekoLoadDetails> {
    return request(`api/alseko/loads/${encodePath(id)}`);
  },
  async getAlsekoBuilding(id: number): Promise<AlsekoBuildingDetails> {
    return request(`api/alseko/buildings/${encodePath(id)}`);
  },
  async getAlsekoLookups(): Promise<AlsekoLookups> {
    return request('api/alseko/lookups');
  },
  async getUnassignedAlsekoBuildings(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<AlsekoBuildingSummary>> {
    return request('api/alseko/buildings/unassigned', { query: filters });
  },

  /** Сверка АЛСЕКО: количество несоответствий по видам (десктоп nenaid1–3 и др.) */
  async getAlsekoReconciliation(): Promise<AlsekoReconciliationSummary> {
    return request('api/alseko/reconciliation');
  },
  async getAlsekoReconciliationIssues(kind: string, limit = 50, offset = 0): Promise<AlsekoReconciliationIssues> {
    return request('api/alseko/reconciliation/issues', { query: { kind, limit, offset } });
  },
  async downloadAlsekoReconciliationReport(kinds?: string[], options: FileJobOptions = {}): Promise<Blob> {
    const sync = async () => ({
      blob: await request<Blob>('api/alseko/reconciliation/report.xlsx', {
        ...mutationOptions('GET'),
        query: kinds?.length ? { kinds: kinds.join(',') } : undefined,
        responseType: 'blob',
        timeout: REPORT_TIMEOUT_MS,
      }),
      filename: 'alseko_reconciliation.xlsx',
    });
    return (await runFileJob('alseko_reconciliation', { kinds: kinds?.length ? kinds : null }, sync, options)).blob;
  },
  async getAlsekoAddresses(params: { q?: string; building_id?: number; limit?: number }): Promise<AlsekoAddressCandidates> {
    return request('api/alseko/addresses', { query: params });
  },
  /** Привязка здания к адресу АЛСЕКО; house пустой — снять привязку; dry_run — предпросмотр */
  async bindAlsekoBuildingAddress(
    buildingId: number,
    body: { microdistrict?: string | null; street?: string | null; house?: string | null; dry_run: boolean }
  ): Promise<AlsekoAddressBindResult> {
    return request(`api/alseko/buildings/${encodePath(buildingId)}/address`, mutationOptions('POST', body));
  },
  /** Назначить зданиям потребителя (zdaniya_2.potrebitel = «код узел») */
  async bindAlsekoConsumerBuildings(
    nodeId: number,
    body: { building_ids: number[]; dry_run: boolean }
  ): Promise<AlsekoConsumerBindResult> {
    return request(`api/alseko/consumers/${encodePath(nodeId)}/buildings`, mutationOptions('POST', body));
  },

  async getElectricalObjects(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<ElectricalObjectSummary>> {
    return request('api/electrical-network/objects', { query: filters });
  },
  async getElectricalObject(
    type: ElectricalObjectType,
    id: number
  ): Promise<ElectricalObjectDetails> {
    return request(`api/electrical-network/objects/${encodePath(type)}/${encodePath(id)}`);
  },
  async getElectricalNetworkLookups(): Promise<ElectricalNetworkLookups> {
    return request('api/electrical-network/lookups');
  },
  /** Сверка привязки электросети: концы ЛЭП ↔ источник/приёмник, точечные объекты ↔ ЛЭП */
  async getElectricalReconciliation(params: { tolerance?: number; kind?: string; object_type?: string; limit?: number; offset?: number } = {}): Promise<ElectricalReconciliation> {
    return request('api/electrical-network/reconciliation', { query: params });
  },
  async downloadElectricalReconciliationReport(tolerance?: number, options: FileJobOptions = {}): Promise<Blob> {
    const sync = async () => ({
      blob: await request<Blob>('api/electrical-network/reconciliation/report.xlsx', {
        ...mutationOptions('GET'),
        query: tolerance ? { tolerance } : undefined,
        responseType: 'blob',
        timeout: REPORT_TIMEOUT_MS,
      }),
      filename: 'electrical_reconciliation.xlsx',
    });
    return (await runFileJob('electrical_reconciliation', tolerance ? { tolerance } : {}, sync, options)).blob;
  },
  /** Привязка по правилам десктопа (editor+, запись — MUTATIONS_ENABLED); dry_run — план «было → станет» */
  async bindElectricalNetwork(body: {
    tolerance?: number; overwrite?: boolean; snap_points?: boolean;
    items?: { object_type: ElectricalBindObjectType; id: number }[] | null; dry_run: boolean
  }): Promise<ElectricalBindResult> {
    return request('api/electrical-network/binding', mutationOptions('POST', body));
  },

  async getHeatLossSeasons(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<HeatLossSeasonSummary>> {
    return request('api/heat-losses/seasons', { query: filters });
  },
  async getHeatLossSources(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<HeatLossSourceSummary>> {
    return request('api/heat-losses/sources', { query: filters });
  },
  async getHeatLossLookups(): Promise<HeatLossLookups> {
    return request('api/heat-losses/lookups');
  },
  async getHeatLossSeason(id: number): Promise<HeatLossSeasonDetails> {
    return request(`api/heat-losses/seasons/${encodePath(id)}`);
  },
  async getHeatLossSource(id: number): Promise<HeatLossSourceDetails> {
    return request(`api/heat-losses/sources/${encodePath(id)}`);
  },
  async runHeatLosses(
    fragmentId: number,
    extraParams = ''
  ): Promise<{ task_id: string; params: string; success: boolean }> {
    return request(
      'api/v1/heat-losses/run',
      mutationOptions('POST', {
        fragment_id: fragmentId,
        extra_params: extraParams,
      })
    );
  },

  async getHeatLossNormScope(
    seasonId: number,
    fragmentId?: number | null,
    losesType: HeatLossLosesType = 'norm'
  ): Promise<HeatLossNormScope> {
    return request('api/v1/heat-losses/norm/scope', {
      query: { season_id: seasonId, loses_type: losesType, ...(fragmentId ? { fragment_id: fragmentId } : {}) },
    });
  },
  async getHeatLossNormSeasons(
    losesType: HeatLossLosesType = 'norm'
  ): Promise<{ loses_type: HeatLossLosesType; items: HeatLossNormSeason[] }> {
    return request('api/v1/heat-losses/norm/seasons', { query: { loses_type: losesType } });
  },
  async prepareHeatLossWorkConditions(
    sourceId: number,
    body: { season_id: number; tx?: Record<number, number>; t_percent?: number; dry_run?: boolean }
  ): Promise<{ months: Record<string, any>[]; creates_source_parameters: boolean; dry_run: boolean }> {
    return request(
      `api/v1/heat-losses/sources/${encodePath(sourceId)}/work-conditions`,
      mutationOptions('POST', body)
    );
  },
  async runHeatLossNorm(body: {
    season_id: number;
    loses_type?: HeatLossLosesType;
    fragment_id?: number | null;
    heat_source_ids?: number[] | null;
  }): Promise<{ success: boolean; task_id: string }> {
    return request('api/v1/heat-losses/norm/run', mutationOptions('POST', body));
  },
  async getHeatLossNormResults(
    filters: { fragment_id?: number | null; limit?: number; offset?: number } = {}
  ): Promise<{ total: number; items: HeatLossNormRunSummary[] }> {
    const query: Record<string, number> = {};
    if (filters.fragment_id) query.fragment_id = filters.fragment_id;
    if (filters.limit) query.limit = filters.limit;
    if (filters.offset) query.offset = filters.offset;
    return request('api/v1/heat-losses/norm/results', { query });
  },
  async getHeatLossNormResult(id: number, includeSheets = true): Promise<HeatLossNormRun> {
    return request(`api/v1/heat-losses/norm/results/${encodePath(id)}`, {
      query: { include_sheets: includeSheets },
    });
  },
  async getHeatLossNormSections(
    id: number,
    filters: { heat_source_id?: number | null; line_id?: number | null; page?: number; page_size?: number } = {}
  ): Promise<{ total: number; page: number; page_size: number; items: HeatLossNormSection[] }> {
    const query: Record<string, number> = {};
    for (const [key, value] of Object.entries(filters)) if (value) query[key] = Number(value);
    return request(`api/v1/heat-losses/norm/results/${encodePath(id)}/sections`, { query });
  },
  async downloadHeatLossNormExcel(id: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`api/v1/heat-losses/norm/results/${encodePath(id)}/excel`, {
      responseType: 'blob',
    });
    return { blob, filename: `heat_losses_${id}.xlsx` };
  },

  async getConsumerLoadDiagnostics(
    filters: JournalFilters = {}
  ): Promise<PaginatedResponse<ConsumerLoadSummary>> {
    return request('api/consumer-load-diagnostics/consumers', { query: filters });
  },
  async getConsumerLoadLookups(): Promise<ConsumerLoadLookups> {
    return request('api/consumer-load-diagnostics/lookups');
  },
  async getConsumerLoadDiagnostic(
    type: ConsumerLoadType,
    id: number
  ): Promise<ConsumerLoadDetails> {
    return request(`api/consumer-load-diagnostics/consumers/${encodePath(type)}/${encodePath(id)}`);
  },

  async getTemperatureGraphSources(
    filters: TemperatureGraphFilters = {}
  ): Promise<PaginatedResponse<TemperatureGraphSourceSummary>> {
    return request('api/temperature-graphs/sources', { query: filters });
  },
  async getTemperatureGraphLookups(): Promise<TemperatureGraphLookups> {
    return request('api/temperature-graphs/lookups');
  },
  async getTemperatureGraphSource(id: number): Promise<TemperatureGraphSourceDetails> {
    return request(`api/temperature-graphs/sources/${encodePath(id)}`);
  },
  async recalculateTemperatureGraph(
    sourceId: number,
    mode: TemperatureGraphMode = 'otop'
  ): Promise<{ success: boolean; points: number; mode?: string }> {
    return request(
      `api/temperature-graphs/sources/${encodePath(sourceId)}/recalculate?mode=${encodeURIComponent(mode)}`,
      mutationOptions('POST', {})
    );
  },
  async previewTemperatureGraph(
    sourceId: number,
    mode: TemperatureGraphMode = 'auto'
  ): Promise<TemperatureGraphPreview> {
    return request(`api/temperature-graphs/sources/${encodePath(sourceId)}/preview`, { query: { mode } });
  },
  async applyStationaryTemperatureGraph(
    sourceId: number,
    body: { t1: number; t2: number; t3: number; tv: number }
  ): Promise<{ success: boolean; updated_points: number }> {
    return request(
      `api/temperature-graphs/sources/${encodePath(sourceId)}/stationary`,
      mutationOptions('POST', body)
    );
  },

  async getInstalledPumps(
    filters: InstalledPumpFilters = {}
  ): Promise<PaginatedResponse<InstalledPumpSummary>> {
    return request('api/pump-equipment/pumps', { query: filters });
  },
  async getPumpCatalog(
    filters: PumpCatalogFilters = {}
  ): Promise<PaginatedResponse<StandardPumpSummary>> {
    return request('api/pump-equipment/catalog', { query: filters });
  },
  async getPumpEquipmentLookups(): Promise<PumpEquipmentLookups> {
    return request('api/pump-equipment/lookups');
  },
  async getInstalledPump(id: number): Promise<InstalledPumpDetails> {
    return request(`api/pump-equipment/pumps/${encodePath(id)}`);
  },
  async getStandardPump(id: number): Promise<StandardPumpDetails> {
    return request(`api/pump-equipment/catalog/${encodePath(id)}`);
  },

  async getNetworkArmatures(
    filters: NetworkArmatureFilters = {}
  ): Promise<PaginatedResponse<NetworkArmatureSummary>> {
    return request('api/network-armatures/items', { query: filters });
  },
  async getStandardDampers(
    filters: StandardDamperFilters = {}
  ): Promise<PaginatedResponse<StandardDamperSummary>> {
    return request('api/network-armatures/catalog', { query: filters });
  },
  async getNetworkArmatureLookups(): Promise<NetworkArmatureLookups> {
    return request('api/network-armatures/lookups');
  },
  async getNetworkArmature(type: NetworkArmatureType, id: number): Promise<NetworkArmatureDetails> {
    return request(`api/network-armatures/items/${encodePath(type)}/${encodePath(id)}`);
  },
  async getStandardDamper(id: number): Promise<StandardDamperDetails> {
    return request(`api/network-armatures/catalog/${encodePath(id)}`);
  },

  async getNetworkRegulators(
    filters: NetworkRegulatorFilters = {}
  ): Promise<PaginatedResponse<NetworkRegulatorSummary>> {
    return request('api/network-regulators/items', { query: filters });
  },
  async getRegulatorCatalog(
    filters: StandardRegulatorFilters = {}
  ): Promise<PaginatedResponse<StandardRegulatorSummary>> {
    return request('api/network-regulators/catalog', { query: filters });
  },
  async getNetworkRegulatorLookups(): Promise<NetworkRegulatorLookups> {
    return request('api/network-regulators/lookups');
  },
  async getNetworkRegulator(
    type: NetworkRegulatorType,
    id: number
  ): Promise<NetworkRegulatorDetails> {
    return request(`api/network-regulators/items/${encodePath(type)}/${encodePath(id)}`);
  },
  async getRegulatorCatalogItem(
    type: NetworkRegulatorType,
    id: number
  ): Promise<StandardRegulatorDetails> {
    return request(`api/network-regulators/catalog/${encodePath(type)}/${encodePath(id)}`);
  },

  async getNetworkBypasses(
    filters: NetworkBypassFilters = {}
  ): Promise<PaginatedResponse<NetworkBypassSummary>> {
    return request('api/network-bypasses/items', { query: filters });
  },
  async getStandardTubes(
    filters: StandardTubeFilters = {}
  ): Promise<PaginatedResponse<StandardTubeSummary>> {
    return request('api/network-bypasses/tubes', { query: filters });
  },
  async getNetworkBypassLookups(): Promise<NetworkBypassLookups> {
    return request('api/network-bypasses/lookups');
  },
  async getNetworkBypass(id: number): Promise<NetworkBypassDetails> {
    return request(`api/network-bypasses/items/${encodePath(id)}`);
  },
  async getStandardTube(id: number): Promise<StandardTubeDetails> {
    return request(`api/network-bypasses/tubes/${encodePath(id)}`);
  },

  async getNetworkDiaphragms(
    filters: NetworkDiaphragmFilters = {}
  ): Promise<PaginatedResponse<NetworkDiaphragmSummary>> {
    return request('api/network-diaphragms/items', { query: filters });
  },
  async getNetworkDiaphragmLookups(): Promise<NetworkDiaphragmLookups> {
    return request('api/network-diaphragms/lookups');
  },
  async getNetworkDiaphragm(id: number): Promise<NetworkDiaphragmDetails> {
    return request(`api/network-diaphragms/items/${encodePath(id)}`);
  },

  async getElevators(
    filters: ElevatorFilters = {}
  ): Promise<PaginatedResponse<ElevatorSummary>> {
    return request('api/elevators', { query: filters });
  },
  async getElevatorLookups(): Promise<ElevatorLookups> {
    return request('api/elevators/lookups');
  },
  async getElevator(id: number): Promise<ElevatorDetails> {
    return request(`api/elevators/${encodePath(id)}`);
  },

  async createObject(table: string, fields: Record<string, any>): Promise<any> {
    const safeTable = encodePath(table);
    return mutationWithFallback(
      `api/v1/create/${safeTable}`,
      `create/${safeTable}`,
      mutationOptions('POST', { fields })
    );
  },

  async updateObjectAttributes(
    table: string,
    id: string | number,
    fields: Record<string, any>
  ): Promise<any> {
    const safeTable = encodePath(table);
    const safeId = encodePath(id);
    return mutationWithFallback(
      `api/v1/update/${safeTable}/${safeId}`,
      `update/${safeTable}/${safeId}`,
      mutationOptions('PUT', { fields })
    );
  },

  async deleteObject(table: string, id: string | number): Promise<any> {
    const safeTable = encodePath(table);
    const safeId = encodePath(id);
    return mutationWithFallback(
      `api/v1/delete/${safeTable}/${safeId}`,
      `delete/${safeTable}/${safeId}`,
      mutationOptions('DELETE')
    );
  },

  async getColumnTranslation(column: string): Promise<ColumnTranslation> {
    if (translationCache[column]) return translationCache[column];
    if (pendingTranslationRequests.has(column)) return pendingTranslationRequests.get(column)!;

    const pending = this.fetchColumnTranslation(column);
    pendingTranslationRequests.set(column, pending);
    try {
      const translation = await pending;
      translationCache[column] = translation;
      return translation;
    } finally {
      pendingTranslationRequests.delete(column);
    }
  },

  async fetchColumnTranslation(column: string): Promise<ColumnTranslation> {
    try {
      return await request(`russian-names/column/${encodePath(column)}`);
    } catch (error) {
      console.error(`Error fetching translation for column "${column}":`, error);
      return { column, russian_name: column, description: '' };
    }
  },

  async getMultipleTranslations(columns: string[]): Promise<Record<string, ColumnTranslation>> {
    const results: Record<string, ColumnTranslation> = {};
    const uncached = columns.filter((column) => {
      if (!translationCache[column]) return true;
      results[column] = translationCache[column];
      return false;
    });

    if (!uncached.length) return results;
    try {
      const batch = await $fetch<Record<string, ColumnTranslation>>('/api/translations-batch', {
        method: 'POST',
        body: { columns: uncached },
      });
      for (const [column, translation] of Object.entries(batch)) {
        translationCache[column] = translation;
        results[column] = translation;
      }
    } catch {
      await Promise.all(
        uncached.map(async (column) => {
          results[column] = await this.getColumnTranslation(column);
        })
      );
    }
    return results;
  },

  async getRussianName(column: string): Promise<string> {
    try {
      return (await this.getColumnTranslation(column)).russian_name || column;
    } catch {
      return column;
    }
  },

  async getRussianNames(columns: string[]): Promise<Record<string, string>> {
    const translations = await this.getMultipleTranslations(columns);
    return Object.fromEntries(
      Object.entries(translations).map(([column, translation]) => [
        column,
        translation.russian_name || column,
      ])
    );
  },

  getCachedRussianName(column: string): string {
    return translationCache[column]?.russian_name || column;
  },

  getCachedDescription(column: string): string {
    return translationCache[column]?.description || '';
  },

  isTranslationLoaded(column: string): boolean {
    return Boolean(translationCache[column]);
  },

  clearTranslationCache(): void {
    Object.keys(translationCache).forEach((key) => delete translationCache[key]);
    pendingTranslationRequests.clear();
  },

  getTranslationCacheSize(): number {
    return Object.keys(translationCache).length;
  },

  async preloadCommonTranslations(): Promise<void> {
    const columns = [
      'id',
      'name',
      'type',
      'status',
      'length',
      'diameter',
      'material',
      'pressure',
      'temperature',
      'flow_rate',
      'created_at',
      'updated_at',
      'externalsignlineid',
      'gid',
      'objectid',
      'objecttype',
    ];
    try {
      const batch = await $fetch<Record<string, ColumnTranslation>>('/api/translations-batch', {
        method: 'POST',
        body: { columns },
      });
      Object.assign(translationCache, batch);
    } catch {
      await this.getMultipleTranslations(columns);
    }
  },

  async getDefectsGeoJSON(): Promise<any> {
    return request('api/defects/geojson');
  },

  async getLatestCalculations(limit = 20): Promise<CalculationSummaryItem[]> {
    return request<CalculationSummaryItem[]>('api/calculations/latest', { query: { limit } });
  },

  /** Расчёт в режиме десктопа: плановый / аварийный, один фрагмент или по списку */
  async runSetyMode(body: SetyRunRequest): Promise<SetyRunResponse> {
    return request<SetyRunResponse>('api/v1/calculations/run', mutationOptions('POST', body));
  },

  /** Допустимая Tн расчёта (heatSystem: t_or … t_vnew); вне диапазона sety откажет */
  async getCalculationTemperatureRange(): Promise<CalculationTemperatureRange> {
    return request<CalculationTemperatureRange>('api/v1/calculations/temperature-range');
  },

  async listCalculations(filter: CalculationListFilter = {}): Promise<CalculationListResponse> {
    const query: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined && value !== '') query[key] = value as string | number;
    }
    return request<CalculationListResponse>('api/v1/calculations', { query });
  },

  /** Администрирование пользователей UsersDB (только admin) */
  async getAdminRoles(): Promise<{ items: AdminRole[] }> {
    return request('api/v1/admin/roles', mutationOptions('GET'));
  },

  async getAdminUsers(): Promise<AdminUsersResponse> {
    return request<AdminUsersResponse>('api/v1/admin/users', mutationOptions('GET'));
  },

  async createAdminUser(body: { username: string; password: string; role: UserRole }): Promise<AdminUser> {
    return request<AdminUser>('api/v1/admin/users', mutationOptions('POST', body));
  },

  async updateAdminUser(userId: number, body: { role?: UserRole; is_active?: boolean }): Promise<AdminUser> {
    return request<AdminUser>(`api/v1/admin/users/${encodePath(userId)}`, mutationOptions('PATCH', body));
  },

  async setAdminUserPassword(userId: number, password: string): Promise<{ success: boolean; id: number }> {
    return request(`api/v1/admin/users/${encodePath(userId)}/password`, mutationOptions('PUT', { password }));
  },

  /** История правок audit_log с фильтрами */
  async getAuditLog(filter: AuditLogFilter = {}): Promise<AuditLogResponse> {
    const query: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined && value !== '') query[key] = value as string | number;
    }
    return request<AuditLogResponse>('api/v1/audit-log', { query });
  },

  async getAuditLogEntry(logId: number): Promise<AuditLogItem> {
    return request<AuditLogItem>(`api/v1/audit-log/${encodePath(logId)}`);
  },

  async getAuditLookups(): Promise<AuditLookups> {
    return request<AuditLookups>('api/v1/audit-log/lookups');
  },

  /** Удаляет расчёт и его *_out-строки (только при MUTATIONS_ENABLED) */
  async deleteCalculation(calculationId: number): Promise<CalculationDeleteResponse> {
    return request<CalculationDeleteResponse>(
      `api/v1/calculations/${encodePath(calculationId)}`,
      mutationOptions('DELETE'),
    );
  },

  async getCalculationResultsGeoJSON(calculationId: number): Promise<CalculationGeoJsonResponse> {
    return request<CalculationGeoJsonResponse>(`api/calculations/${encodePath(calculationId)}/results/geojson`);
  },

  async getCalculationResultsGeoJson(calculationId: number): Promise<CalculationGeoJsonResponse> {
    return this.getCalculationResultsGeoJSON(calculationId);
  },

  async getCorrosionIndicatorsGeoJSON(): Promise<any> {
    return request('api/corrosion-indicators/geojson');
  },

  async getTopologyDiagnostics(fragmentId: number, limit = 200): Promise<TopologyDiagnosticsResponse> {
    return request('api/v1/topology/diagnostics', { query: { fragment_id: fragmentId, limit } });
  },

  getFormReportUrl(formId: string, search?: string): string {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return buildApiUrl(`api/reports/html/${encodePath(formId)}${query}`);
  },

  async downloadWordReport(defectId: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`reports/word/defect/${encodePath(defectId)}`, {
      responseType: 'blob',
    });
    return { blob, filename: `defect_${defectId}.docx` };
  },

  async downloadOpsWordReport(
    journal: 'shurf' | 'osmotr' | 'remont' | 'opres',
    recordId: number
  ): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`reports/word/${encodePath(journal)}/${encodePath(recordId)}`, {
      responseType: 'blob',
    });
    return { blob, filename: `${journal}_${recordId}.docx` };
  },

  async downloadShpExport(fragmentIds?: number[]): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>('api/export/shp', {
      responseType: 'blob',
      query: fragmentIds?.length
        ? fragmentIds.length === 1
          ? { fragment_id: fragmentIds[0] }
          : { fragments: fragmentIds.join(',') }
        : undefined,
    });
    const suffix = fragmentIds?.length === 1 ? `_f${fragmentIds[0]}` : fragmentIds?.length ? '_frag' : '';
    return { blob, filename: `network_export${suffix}.zip` };
  },

  async downloadDxfExport(fragmentIds?: number[]): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>('api/export/dxf', {
      responseType: 'blob',
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : undefined,
    });
    const suffix = fragmentIds?.length === 1 ? `_f${fragmentIds[0]}` : fragmentIds?.length ? '_frag' : '';
    return { blob, filename: `network${suffix}.dxf` };
  },

  /**
   * GeoJSON участков (WGS84). withAttrs — «GeoJSON с атрибутами» (Sys, L, D, K_E — короткие имена
   * для загрузки в ZuluGIS/QGIS; раньше назывался «Zulu»-экспортом, API /api/export/zulugis — алиас).
   */
  async downloadGeoJsonExport(fragmentIds?: number[], withAttrs = false): Promise<{ blob: Blob; filename: string }> {
    const data = await request<unknown>(withAttrs ? 'api/export/geojson-attrs' : 'api/export/geojson', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(','), limit: 50000 } : { limit: 50000 },
    });
    const blob = new Blob([JSON.stringify(data)], { type: 'application/geo+json' });
    const suffix = fragmentIds?.length === 1 ? `_f${fragmentIds[0]}` : fragmentIds?.length ? '_frag' : '';
    return { blob, filename: `network${withAttrs ? '_attrs' : ''}${suffix}.geojson` };
  },

  /** Импорт (этап 10): разбор файла — колонки, образец, поля назначения, предложенное сопоставление */
  async inspectNetworkImport(
    files: File[],
    mode: NetworkImportMode,
    opts: { encoding?: string; sheet?: string } = {}
  ): Promise<NetworkImportInspect> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('mode', mode);
    if (opts.encoding) form.append('encoding', opts.encoding);
    if (opts.sheet) form.append('sheet', opts.sheet);
    return request<NetworkImportInspect>('api/v1/import/inspect', mutationOptions('POST', form));
  },

  /** Превью (dryRun) или применение импорта; 422 row_errors — отчёт в detail.report */
  async runNetworkImport(files: File[], params: NetworkImportParams, dryRun: boolean): Promise<NetworkImportReport> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('params', JSON.stringify(params));
    form.append('dry_run', dryRun ? 'true' : 'false');
    return request<NetworkImportReport>('api/v1/import/run', mutationOptions('POST', form));
  },

  async getNetworkQueryVolume(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/volume', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  async getNetworkQueryLength(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/length', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  async getNetworkQueryLengthByDiameter(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/length-by-diameter', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  /** Zap3; system: closed — Zap4 (закрытые системы), open — Zap5 (открытые). */
  async getNetworkQueryHeatConsumption(fragmentIds?: number[], system?: 'closed' | 'open'): Promise<any> {
    return request('api/network-queries/heat-consumption', {
      query: {
        ...(fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {}),
        ...(system ? { system } : {}),
      },
    });
  },
  /** Zap6: закрытые (физически отключённые) потребители. */
  async getNetworkQueryClosedConsumers(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/closed-consumers', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  /** Zap7_1: длина по диаметрам и способам прокладки. */
  async getNetworkQueryLengthByDiameterLaying(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/length-by-diameter-laying', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },

  /** Анализ режима по последнему расчёту фрагмента (десктоп «Анализ»). */
  async getRegimeAnalysis(
    kind: RegimeAnalysisKind,
    fragmentId: number,
    options: { calculationId?: number; includeUncalculated?: boolean } = {},
  ): Promise<RegimeAnalysisResult> {
    return request<RegimeAnalysisResult>(`api/analysis/regime/${kind}`, {
      query: {
        fragment_id: fragmentId,
        ...(options.calculationId ? { calculation_id: options.calculationId } : {}),
        ...(options.includeUncalculated ? { include_uncalculated: true } : {}),
      },
    });
  },
  async getAdmissibilityCatalog(): Promise<{ id: number; title: string; object: 'node' | 'line' }[]> {
    return request('api/analysis/admissibility');
  },
  async getAdmissibility(queryId: number, fragmentId: number): Promise<RegimeAnalysisResult> {
    return request<RegimeAnalysisResult>(`api/analysis/admissibility/${queryId}`, {
      query: { fragment_id: fragmentId },
    });
  },

  async getOcheredOpressovok(page = 1, pageSize = 50): Promise<any> {
    return request('api/ochered-opressovok', {
      query: { page, page_size: pageSize },
    });
  },

  /**
   * Сводная ведомость Excel. fragmentIds — отбор по фрагментам (как экспорт SHP/GeoJSON; пусто —
   * вся сеть). meta — полнота выгрузки из заголовков X-Report-* (ведомость не режется молча, QA F14).
   */
  async downloadExcelReport(
    docType: string,
    query?: Record<string, string | number | boolean | undefined | null>,
    options: FileJobOptions = {},
    fragmentIds?: number[],
  ): Promise<{ blob: Blob; filename: string; meta?: ExcelReportMeta }> {
    const year = query?.year;
    const frags = [...new Set((fragmentIds || []).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
    let suffix = year != null && year !== '' ? `_${year}` : '';
    if (frags.length) suffix += frags.length === 1 ? `_f${frags[0]}` : '_frag';
    let meta: ExcelReportMeta | undefined;
    const onHeaders = (get: HeaderGetter) => {
      meta = parseExcelReportMeta(get);
    };
    const sync = async () => ({
      blob: await request<Blob>(`api/reports/excel/${encodePath(docType)}`, {
        responseType: 'blob',
        query: frags.length ? { ...(query || {}), fragments: frags.join(',') } : query,
        timeout: REPORT_TIMEOUT_MS,
        onResponse({ response }: any) {
          if (response?.headers?.get) onHeaders((name) => response.headers.get(name));
        },
      }),
      filename: `report_${docType}${suffix}.xlsx`,
    });
    const params: Record<string, unknown> = { doc_type: docType, year: year != null && year !== '' ? Number(year) : null };
    if (frags.length) params.fragments = frags;
    const result = await runFileJob('report_excel', params, sync, options, onHeaders);
    return meta ? { ...result, meta } : result;
  },

  /** Каталог Excel-отчётов: отчёты десктопа gid6 (excel2) и сводные ведомости веба */
  async getReportsCatalog(): Promise<ReportsCatalog> {
    return request<ReportsCatalog>('api/reports/catalog');
  },

  /** Excel-отчёт десктопа по шаблону gid6: фрагмент обязателен, расчёт — последний, если не задан */
  async downloadCatalogReport(
    report: Pick<ReportCatalogItem, 'id' | 'title'>,
    params: { fragment_id: number; calculation_id?: number | null },
    options: FileJobOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const query: Record<string, number> = { fragment_id: params.fragment_id };
    if (params.calculation_id) query.calculation_id = params.calculation_id;
    const sync = async () => ({
      blob: await request<Blob>(`api/reports/catalog/${encodePath(report.id)}/excel`, {
        responseType: 'blob',
        query,
        timeout: REPORT_TIMEOUT_MS,
      }),
      filename: '',
    });
    const { blob } = await runFileJob(
      'catalog_report',
      { report_id: report.id, fragment_id: params.fragment_id, calculation_id: params.calculation_id || null },
      sync,
      options,
    );
    const safeTitle = report.title.replace(/[\\/:*?"<>|]+/g, ' ').trim();
    return { blob, filename: `${safeTitle} ф${params.fragment_id}.xlsx` };
  },

  async downloadCalculationExcel(calculationId: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(
      `api/calculations/${encodePath(calculationId)}/results/excel`,
      { responseType: 'blob' }
    );
    return { blob, filename: `calculation_${calculationId}_results.xlsx` };
  },

  async getPassportHierarchy(): Promise<PassportHierarchyGroup[]> {
    return request('api/passports/hierarchy');
  },

  async getPassportDiagnostics(): Promise<{
    ready_for_passport: boolean;
    blockers: string[];
    counts: Record<string, number>;
    remediation?: string[];
  }> {
    return request('api/passports/diagnostics');
  },

  async getHealth(): Promise<{
    status: string;
    routes: number;
    database: { ok: boolean; latency_ms?: number; error?: string | null };
    redis?: { ok: boolean; latency_ms?: number; error?: string | null; note?: string | null };
    flags?: Record<string, boolean>;
  }> {
    return request('health');
  },

  async downloadPassport(
    msRs: PassportSite['ms_rs'],
    id: number,
    options: FileJobOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    return fastApiService.downloadObjectPassport(`uchastok_${msRs}`, id, options);
  },

  async downloadObjectPassport(
    table: string,
    id: number,
    options: FileJobOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const sync = async () => ({
      blob: await request<Blob>(`api/db/object/${encodePath(table)}/${encodePath(id)}`, {
        method: 'POST',
        responseType: 'blob',
        timeout: REPORT_TIMEOUT_MS,
      }),
      filename: `Passport_${table}_${id}.xlsx`,
    });
    // имя с сервера — по участку (Passport_ms_12.xlsx), даже если паспорт открыт по трубе/узлу
    return runFileJob('passport', { table, obj_id: id }, sync, options);
  },

  formatAttributeValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    return String(value);
  },

  async simulateValveIsolation(params: {
    line_id?: number | null;
    node_id?: number | null;
  }): Promise<OutageSimulationResponse> {
    return request<OutageSimulationResponse>('api/analysis/valve-isolation', {
      method: 'POST',
      body: params,
    });
  },

  async calculateOrificePlate(params: OrificePlateParams): Promise<OrificePlateResult> {
    return request<OrificePlateResult>('api/calc/orifice-plate', {
      method: 'POST',
      body: params,
    });
  },

  async calculateElevatorNozzle(params: ElevatorNozzleParams): Promise<ElevatorNozzleResult> {
    return request<ElevatorNozzleResult>('api/calc/elevator-nozzle', {
      method: 'POST',
      body: params,
    });
  },

  async calculateGvsCirculationDiaphragm(params: GvsCirculationParams): Promise<GvsCirculationResult> {
    return request<GvsCirculationResult>('api/calc/gvs-circulation-diaphragm', { method: 'POST', body: params });
  },

  async calculateElevatorEngine(params: ElevatorEngineParams): Promise<ElevatorEngineResult> {
    return request<ElevatorEngineResult>('api/calc/elevator-engine', { method: 'POST', body: params });
  },

  async downloadThrottlingSheet(params: ThrottlingSheetParams): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>('api/calc/throttling-sheet', {
      method: 'POST',
      body: params,
      responseType: 'blob',
    });
    return { blob, filename: `Расчет_дросселирования_${Date.now()}.xlsx` };
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

  async downloadPiezometerExcel(
    waypoints: number[],
    opts: { calculationId2?: number | null; includeStatic?: boolean } = {}
  ): Promise<{ blob: Blob; filename: string }> {
    const body: Record<string, any> = { waypoints };
    if (opts.calculationId2) body.calculation_id_2 = opts.calculationId2;
    if (opts.includeStatic === false) body.include_static = false;
    const blob = await request<Blob>('api/piezometer/excel', {
      method: 'POST',
      body,
      responseType: 'blob',
    });
    return { blob, filename: `Piezometer_Profile_${Date.now()}.xlsx` };
  },
};
