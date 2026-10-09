/**
 * Подсветка участков ПТС на карте — как «Перейти к участку» дока ПТС десктопа
 * (gid8 docks/DockPTS.cpp → CGraph2::vydMS/vydRS: трубы участка рисуются жёлтой подложкой).
 * Слой участков GeoServer считает поле warning по параметрам view nach / ms / rs
 * (scripts/geoserver/gid_desktop_style.py); стиль рисует warning=1 жёлтым под трубами.
 */
import type { PtsSiteItem } from '~/services/ptsService';

export type PtsHighlightKind = 'nach' | 'ms' | 'rs';

export interface PtsHighlight {
  kind: PtsHighlightKind;
  id: number;
  title: string;
}

/** Без выбора — nach:0: view ничего не подсвечивает (раньше веб всегда передавал nach:2) */
export function highlightViewparam(highlight: PtsHighlight | null | undefined): string {
  if (highlight && Number.isInteger(highlight.id) && highlight.id > 0) return `${highlight.kind}:${highlight.id};`;
  return 'nach:0;';
}

/** viewparams слоёв GeoServer: фрагменты, подписи, подсветка */
export function buildViewparams(
  fragmentIds: readonly number[],
  fields: string,
  highlight: PtsHighlight | null | undefined,
): string {
  const fragmentsPart = fragmentIds.length ? `fragments:${encodeURIComponent(fragmentIds.join('_'))};` : '';
  const fieldsPart = fields && !fields.endsWith(';') ? `${fields};` : fields;
  return `${fragmentsPart}${fieldsPart}${highlightViewparam(highlight)}`;
}

export interface ChiefNode {
  key: string;
  nachId: number | null;
  title: string;
  ms: PtsSiteItem[];
  rs: PtsSiteItem[];
}

/** Дерево дока ПТС: начальник участка → его участки МС и РС (порядок сервера сохраняется) */
export function chiefTree(ms: PtsSiteItem[], rs: PtsSiteItem[], query = ''): ChiefNode[] {
  const q = query.trim().toLowerCase();
  const nodes = new Map<string, ChiefNode>();
  const add = (item: PtsSiteItem, kind: 'ms' | 'rs') => {
    const key = item.nach_id ? `n${item.nach_id}` : 'none';
    let node = nodes.get(key);
    if (!node) {
      node = { key, nachId: item.nach_id, title: item.nach_name || 'Без начальника участка', ms: [], rs: [] };
      nodes.set(key, node);
    }
    if (q) {
      const hay = `${kind} ${item.id} ${item.name || ''} ${item.magistral_name || ''} ${item.nach_name || ''}`.toLowerCase();
      if (!hay.includes(q)) return;
    }
    node[kind].push(item);
  };
  ms.forEach((item) => add(item, 'ms'));
  rs.forEach((item) => add(item, 'rs'));
  const list = [...nodes.values()].filter((n) => n.ms.length || n.rs.length);
  // «Без начальника» — в конце, остальные по ФИО
  return list.sort((a, b) => Number(!a.nachId) - Number(!b.nachId) || a.title.localeCompare(b.title, 'ru'));
}

/**
 * Фрагменты подсветки, которых нет на карте, — только если на карте не видно ни одной её трубы
 * (десктоп в этом случае говорит «фрагмент не подключен»).
 */
export function hiddenHighlightFragments(fragmentIds: readonly number[], visible: readonly number[]): number[] {
  if (!fragmentIds.length || !visible.length) return [];
  const shown = new Set(visible);
  return fragmentIds.some((id) => shown.has(id)) ? [] : [...fragmentIds];
}
