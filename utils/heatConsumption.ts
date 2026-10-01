/**
 * Итоги теплопотребления Zap3/Zap4/Zap5 (gid6 zap.cpp Add + TeplopotrBox.cpp).
 *
 * totals из API: n_* — полученная тепловая нагрузка (PT_OUT Qotz, Qotn, dop12, dop18, dop19,
 * dop20, dop17), Гкал/ч; q_* — полученный расход сетевой воды (a4, a5, a6, a12, a13, a14, a15), т/ч.
 * Подписи строк — как в окне десктопа (единица в подписи строки, столбец «Общие»).
 */
export interface HeatConsumptionRow {
  key: string;
  label: string;
  value: number | null;
}

const HEAT_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['n_otz', 'Нагрузка на отопление, зависимое присоед., Гкал/ч'],
  ['n_otn', 'Нагрузка на отопление, независимое присоед., Гкал/ч'],
  ['n_vn', 'Нагрузка на вентиляцию, Гкал/ч'],
  ['n_gvop', 'Нагрузка на ГВ в открытых системах из подающего, Гкал/ч'],
  ['n_gvoo', 'Нагрузка на ГВ в открытых системах из обратного, Гкал/ч'],
  ['n_rez', 'Нагрузка на рециркуляцию в открытых ГВ, Гкал/ч'],
  ['n_gvz', 'Нагрузка на ГВ в закрытых системах, Гкал/ч'],
  ['q_otz', 'Расход на отопление, зависимое присоед., т/ч'],
  ['q_otn', 'Расход на отопление, независимое присоед., т/ч'],
  ['q_vn', 'Расход на вентиляцию, т/ч'],
  ['q_gvop', 'Расход на ГВ в открытых системах из подающего, т/ч'],
  ['q_gvoo', 'Расход на ГВ в открытых системах из обратного, т/ч'],
  ['q_rez', 'Расход на рециркуляцию в открытых ГВ, т/ч'],
  ['q_gvz', 'Расход в закрытых системах, т/ч'],
]

export function heatConsumptionRows(totals: Record<string, number | null | undefined> | null | undefined): HeatConsumptionRow[] {
  const t = totals || {}
  return HEAT_ROWS.map(([key, label]) => ({ key, label, value: t[key] ?? null }))
}
