/**
 * Правка карточек реестров (индикаторы коррозии, ТУ), которые пишутся не через
 * /api/v1/journals, а через свои маршруты или универсальный CRUD.
 *
 * Карточка читается с ключами API (installation_place, issued_on…), а CRUD пишет колонки
 * таблицы (mesto_ustanovki…): ключи переводятся по карте «ключ API → колонка». В карте —
 * только поля самой таблицы; производные (адрес из улицы и дома, диаметр трубы) не пишутся.
 */

type Values = Record<string, unknown>;

/** Пустая строка/undefined из поля формы → null (очистка значения) */
export const emptyToNull = (value: unknown): unknown =>
  value === '' || value === undefined ? null : value;

/** Изменённые поля формы в колонках таблицы; неизвестные ключи (вычисляемые поля карточки) пропускаются */
export function changedColumns(original: Values | null | undefined, edited: Values, columnByKey: Record<string, string>): Values {
  const result: Values = {};
  for (const [key, column] of Object.entries(columnByKey)) {
    if (!(key in edited)) continue;
    const next = emptyToNull(edited[key]);
    const prev = emptyToNull(original?.[key]);
    if (next !== prev) result[column] = next;
  }
  return result;
}

/** Заполненные поля новой записи в колонках таблицы */
export function filledColumns(values: Values, columnByKey: Record<string, string>): Values {
  const result: Values = {};
  for (const [key, column] of Object.entries(columnByKey)) {
    const value = emptyToNull(values[key]);
    if (value !== null) result[column] = value;
  }
  return result;
}

/** Тождественная карта для маршрутов, которые сами принимают ключи API (ТУ) */
export const identityColumns = (keys: Iterable<string>): Record<string, string> =>
  Object.fromEntries([...keys].map((key) => [key, key]));

/** Ключ API индикатора коррозии (database/corrosion_indicators.py) → колонка indikator_korrozii */
export const CORROSION_COLUMN_BY_KEY: Record<string, string> = {
  number: 'nomer_indikatora_korrozii',
  phase_id: 'sostoyanie',
  installation_place: 'mesto_ustanovki',
  line_id: 'lineid',
  node_id: 'nodeid',
  pipeline_sign_id: 'truboprovod',
  coolant_type_id: 'teplonositel',
  heat_source_name: 'istochnik_tepla',
  operation_site_name: 'uchastok_ekspluatatsii',
  network_name: 'magistral_raspredset',
  site_manager_name: 'nachalnik_uchastka',
  planned_on: 'data_planirovaniya',
  installed_on: 'data_ustanovki',
  extracted_on: 'data_izvlecheniya',
  rod_state_id: 'stateindid',
  responsible_id: 'responsibleid',
  plate_count: 'kolichestvo_plastin_v_sborke',
  initial_plate_weight: 'sredniy_ves_plastiny_pri_ustanovke__g',
  plate_radius: 'radius_krugloy_plastiny__mm',
  bush_radius: 'radius_vtulki__mm',
  plate_thickness: 'tolschina_plastiny__mm',
  final_plate_weight: 'sredniy_ves_plastiny_posle_ispytaniy__g',
  acid_treatment_mass_loss: 'poterya_massy_srednyaya_pri_kislotnoy_obraboke__g',
  corrosion_rate: 'srednyaya_skorost_korrozii__mm_god',
  process_mark_id: 'otsenka_korrozionnogo_protsessa',
  water_aggressiveness_id: 'agressivnost_setevoy_vody',
  plate_external_view: 'vneshniy_vid_plastin',
  note: 'primechanie',
  start_chamber_name: 'nachalnaya_kamera',
  start_chamber_code: 'kod_rs_nachalnoy_kamery',
  end_chamber_name: 'konechnaya_kamera',
  end_chamber_code: 'kod_rs_konechnoy_kamery',
  nearest_chamber_name: 'blizhayshaya_kamera',
  nearest_chamber_code: 'kod_rs_blizhayshey_kamery',
  chamber_distance: 'rasstoyanie_do_kamery__m',
  commissioned_on: 'god_vvoda_v_ekspluatatsiyu',
  flow_diameter: 'diametr_truby_podayuschiy__uslovn__mm',
  return_diameter: 'diametr_truby_obratnyy__uslovn__mm',
};

/**
 * Поля сезона: карточка показывает значение последней записи истории по сезонам
 * (COALESCE(latest.*, indicator.*)), поэтому при наличии истории правка самой карточки
 * не была бы видна — такие поля правятся в истории сезонов, в карточке они только для чтения.
 */
export const CORROSION_SEASON_KEYS: ReadonlySet<string> = new Set([
  'phase_id', 'rod_state_id', 'planned_on', 'installed_on', 'extracted_on', 'plate_count',
  'initial_plate_weight', 'plate_radius', 'bush_radius', 'plate_thickness', 'final_plate_weight',
  'acid_treatment_mass_loss', 'corrosion_rate', 'process_mark_id', 'water_aggressiveness_id',
  'plate_external_view', 'note',
]);

/** Ключ поля можно править в карточке индикатора (с учётом истории сезонов) */
export function corrosionEditableKey(key: string, historyCount: number): string | undefined {
  if (!(key in CORROSION_COLUMN_BY_KEY)) return undefined;
  if (historyCount > 0 && CORROSION_SEASON_KEYS.has(key)) return undefined;
  return key;
}
