import { describe, expect, it } from 'vitest';
import { EM_STATUS_COLOR, statusCounts, type EmChapter, type EmStatus } from '~/utils/emChapter';

const section = (key: string, status: EmStatus) => ({ key, title: key, status, text: [], tables: [] });

describe('emChapter', () => {
  it('statusCounts считает подпункты по состоянию', () => {
    const chapter: EmChapter = {
      generated_at: '', basis: '', fragments: [], copies: [], km: 0, lines: 0,
      sections: [section('а', 'выполняется'), section('б', 'частично'), section('в', 'частично'),
        section('г', 'нет данных')],
    };
    expect(statusCounts(chapter)).toEqual({ 'выполняется': 1, 'частично': 2, 'нет данных': 1 });
  });

  it('у каждого состояния свой цвет', () => {
    expect(new Set(Object.values(EM_STATUS_COLOR)).size).toBe(3);
  });
});
