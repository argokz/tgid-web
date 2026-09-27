import type { ReportCatalogItem } from '~/services/fastApiService'

/** Порядок групп в диалоге «Отчёты»: сначала отчёты десктопа, сводные ведомости в конце */
export const REPORT_GROUP_ORDER = [
  'Результаты расчёта',
  'Исходные данные',
  'Система теплоснабжения',
  'Сводные ведомости',
]

export interface ReportGroup {
  title: string
  items: ReportCatalogItem[]
}

const norm = (s: string | null | undefined) => (s || '').toLowerCase().replace(/ё/g, 'е')

/** Совпадение с поиском по названию, группе, листам и имени источника в десктопе */
export const matchesReport = (item: ReportCatalogItem, search: string): boolean => {
  const words = norm(search).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = norm(
    [item.title, item.group, item.desktop, item.id, ...item.sheets.map((s) => s.title)].join(' '),
  )
  return words.every((w) => haystack.includes(w))
}

/** Отфильтрованный каталог по группам в порядке REPORT_GROUP_ORDER (неизвестные группы — в конце) */
export const groupReports = (items: ReportCatalogItem[], search = ''): ReportGroup[] => {
  const groups = new Map<string, ReportCatalogItem[]>()
  for (const item of items) {
    if (!matchesReport(item, search)) continue
    const list = groups.get(item.group) ?? []
    list.push(item)
    groups.set(item.group, list)
  }
  const rank = (g: string) => {
    const i = REPORT_GROUP_ORDER.indexOf(g)
    return i === -1 ? REPORT_GROUP_ORDER.length : i
  }
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'ru'))
    .map(([title, list]) => ({ title, items: list }))
}

/** Что нужно заполнить перед скачиванием: для отчётов десктопа — фрагмент */
export const reportNeedsFragment = (item: ReportCatalogItem | null | undefined): boolean =>
  !!item && item.params.fragment_id === 'required'

/** Сохранение Blob как файла (скачивание в браузере) */
export const saveBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
