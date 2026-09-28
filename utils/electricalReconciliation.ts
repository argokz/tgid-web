/** Подписи и тексты для вкладки «Сверка и привязка» электросети (API /api/electrical-network/reconciliation). */

export const ELECTRICAL_TYPE_TITLES: Record<string, string> = {
  line: 'ЛЭП',
  channel: 'Кабельный канал',
  coupling: 'Муфта',
  support: 'Опора',
  sleeve: 'Гильза',
};

export const ELECTRICAL_FIELD_TITLES: Record<string, string> = {
  naimenovanie_istochnika: 'Источник',
  naimenovanie_priemnika: 'Приёмник',
  naimenovanie_lep: 'ЛЭП',
  shape: 'Геометрия',
};

type Row = Record<string, unknown> & { object_type: string };

function ref(prefix: string, id: unknown, distance?: unknown): string {
  if (id === null || id === undefined) return `${prefix} —`;
  const d = distance === null || distance === undefined ? '' : ` (${Number(distance).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м)`;
  return `${prefix} ${id}${d}`;
}

/** Текущая привязка: источник/приёмник ЛЭП или ЛЭП точечного объекта с расстоянием до неё. */
export function electricalCurrentText(item: Row): string {
  if (item.object_type === 'line') {
    return `${ref('ист.', item.source_id, item.source_distance)}; ${ref('пр.', item.receiver_id, item.receiver_distance)}`;
  }
  return ref('ЛЭП', item.line_id, item.line_distance);
}

/** Что найдено по геометрии в допуске (кандидат для привязки) и ближайшая ЛЭП. */
export function electricalCandidateText(item: Row): string {
  if (item.object_type === 'line') {
    return `${ref('ист.', item.candidate_source_id, item.candidate_source_distance)}; ${ref('пр.', item.candidate_receiver_id, item.candidate_receiver_distance)}`;
  }
  const candidate = ref('ЛЭП', item.candidate_line_id, item.candidate_line_distance);
  if (item.candidate_line_id == null && item.nearest_line_id != null) {
    return `${candidate}; ближайшая ${ref('ЛЭП', item.nearest_line_id, item.nearest_line_distance)}`;
  }
  return candidate;
}
