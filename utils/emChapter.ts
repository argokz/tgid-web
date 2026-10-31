/** Глава «Электронная модель системы теплоснабжения» (itwin-api database/em_chapter.py): типы и подписи. */

export type EmStatus = 'выполняется' | 'частично' | 'нет данных';

export interface EmTable {
  title: string;
  header: string[];
  rows: (string | number)[][];
}

export interface EmSection {
  key: string;
  title: string;
  status: EmStatus;
  text: string[];
  tables: EmTable[];
}

export interface EmChapter {
  generated_at: string;
  basis: string;
  fragments: { id: number; name: string | null }[];
  /** фрагменты-копии более новых, не вошедшие в модель: доля совпадающих участков */
  copies: { id: number; name: string | null; share: number }[];
  km: number;
  lines: number;
  sections: EmSection[];
}

export const EM_STATUS_COLOR: Record<EmStatus, string> = {
  'выполняется': 'success',
  'частично': 'warning',
  'нет данных': 'error',
};

/** Сколько подпунктов в каждом состоянии — для заголовка сводки */
export function statusCounts(chapter: EmChapter): Record<EmStatus, number> {
  const out: Record<EmStatus, number> = { 'выполняется': 0, 'частично': 0, 'нет данных': 0 };
  for (const s of chapter.sections) out[s.status] += 1;
  return out;
}
