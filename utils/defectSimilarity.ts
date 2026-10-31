/** Похожие аварии и места повторных отказов (itwin-api database/defect_similarity.py): типы и подписи. */

export interface DefectFeatures {
  kind: string | null;
  pipe: 'supply' | 'return' | 'both' | null;
  diameter: number | null;
}

export interface SimilarDefect {
  id: number;
  line_id: number | null;
  detected_at: string | null;
  text: string;
  lon: number | null;
  lat: number | null;
  distance_m: number | null;
  features: DefectFeatures;
  score: number;
  parts: Record<string, number>;
  reasons: string[];
  /** Пересортировка ИИ: насколько похоже (0–100) и почему — словами модели */
  ai_relevance?: number | null;
  ai_reason?: string | null;
}

export interface SimilarResult {
  defect_id?: number;
  reference: DefectFeatures;
  radius_m: number | null;
  candidates: number;
  items: SimilarDefect[];
  /** ai — порядок модели, features — по признакам (ИИ не вызывался или не ответил: ai_error) */
  ranking?: 'ai' | 'features';
  model?: string;
  ai_error?: string;
}

export interface FailureHotspot {
  defects: number[];
  count: number;
  days: number;
  kinds: Record<string, number>;
  first: string | null;
  last: string | null;
  lon: number;
  lat: number;
  replaced_after: boolean;
  linked_in_journal: number;
  line: { id: number; diameter: number | null; length_m: number | null; laid: string | null; distance_m: number } | null;
}

/** Предпросмотр записи участков в журнал нарушений (GET /api/v1/defects/line-binding) */
export interface LineBindingPlan {
  unplaced: number;
  without_place: number;
  to_bind: number;
  far: number;
  snap_m: number;
  with_copies: number;
  by_fragment: Record<string, number>;
  rule: string;
  items: { defect_id: number; line_id: number; fileid: number; fragment: string | null; distance_m: number; copies: number }[];
}

export interface LineBindingResult { bound: number; skipped: number; far: number; change_group_id: string | null }

export interface HotspotResult { years: number; eps_m: number; min_count: number; items: FailureHotspot[] }

const KIND_TEXT: Record<string, string> = {
  rupture: 'порыв', fistula: 'свищ', leak: 'утечка', corrosion: 'коррозия', insulation: 'изоляция',
  valve: 'арматура', chamber: 'камера', reconstruction: 'работы',
};
const PIPE_TEXT = { supply: 'Т1', return: 'Т2', both: 'Т1 и Т2' } as const;

/** Что распознано в тексте образца: «свищ · Т2 · Ду100» */
export function featuresText(f: DefectFeatures): string {
  const parts = [f.kind ? KIND_TEXT[f.kind] ?? f.kind : null, f.pipe ? PIPE_TEXT[f.pipe] : null,
    f.diameter ? `Ду${f.diameter}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'вид, труба и диаметр не распознаны';
}

/** Сходство в процентах для полосы и подписи */
export const scorePct = (score: number): number => Math.round(Math.max(0, Math.min(1, score)) * 100);

/** Скопление одной строкой: «5 отказов, дней с отказами — 2: порыв 4, утечка 1» */
export function hotspotText(h: FailureHotspot): string {
  const kinds = Object.entries(h.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  return `${h.count} отказов, дней с отказами — ${h.days}: ${kinds}`;
}

/** Участок рядом: «Ду150, 9,6 м, проложен 2025» */
export function hotspotLineText(h: FailureHotspot): string {
  if (!h.line) return 'участок теплосети рядом не найден';
  const parts = [h.line.diameter ? `Ду${h.line.diameter}` : null,
    h.line.length_m ? `${h.line.length_m.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м` : null,
    h.line.laid ? `проложен ${h.line.laid.slice(0, 4)}` : 'год прокладки неизвестен'].filter(Boolean);
  return `участок ${h.line.id}: ${parts.join(', ')}`;
}
