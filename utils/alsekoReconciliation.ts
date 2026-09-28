/** Сверка АЛСЕКО (API /api/alseko/reconciliation*): подписи колонок и разбор ввода. */

/** Виды несоответствий, где строка — здание (клик открывает карточку здания). */
export const ALSEKO_BUILDING_KINDS = new Set(['unassigned_building', 'stale_address', 'load_mismatch', 'unknown_consumer'])
/** Виды, где строка — договорный объект nagruzki. */
export const ALSEKO_LOAD_KINDS = new Set(['unmatched_apartment', 'unmatched_other'])

const TITLES: Record<string, string> = {
  id: 'ID',
  source_address: 'Адрес/КСК/лиц. счёт',
  microdistrict: 'Микрорайон',
  street: 'Улица',
  house: 'Дом',
  customer_type: 'Тип',
  owner: 'Контрагент',
  contract_number: '№ договора',
  registry_number: '№ объекта',
  operation_district: 'Экспл. район',
  administrative_district: 'Адм. район',
  operation_site: 'Участок',
  heat_source: 'Источник',
  temperature_graph: 'Темп. график',
  heating_load: 'Отопление',
  hot_water_load: 'ГВС',
  ventilation_load: 'Вентиляция',
  steam_load: 'Пар',
  total_load: 'Сумма',
  total_load_gcal: 'Сумма, Гкал/ч',
  consumer: 'Потребитель',
  geo_microdistrict: 'Геоадрес: мкр',
  geo_street: 'Геоадрес: улица',
  geo_house: 'Геоадрес: дом',
  load_count: 'Договоров',
  building_count: 'Зданий',
  building_ids: 'ID зданий',
  source_heating_load: 'АЛСЕКО: отопление',
  source_hot_water_load: 'АЛСЕКО: ГВС',
  source_ventilation_load: 'АЛСЕКО: вент.',
  source_steam_load: 'АЛСЕКО: пар'
}

export function alsekoColumnTitle(column: string): string {
  return TITLES[column] || column
}

/** «1, 2 3;4» → [1, 2, 3, 4] без повторов и мусора. */
export function parseIdList(raw: string): number[] {
  const out: number[] = []
  for (const part of String(raw || '').split(/[\s,;]+/)) {
    const n = Number(part)
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n)
  }
  return out
}
