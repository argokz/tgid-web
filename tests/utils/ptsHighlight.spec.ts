import { describe, expect, it } from 'vitest';
import type { PtsSiteItem } from '~/services/ptsService';
import { buildViewparams, chiefTree, hiddenHighlightFragments, highlightViewparam } from '~/utils/ptsHighlight';

const site = (id: number, nach: number | null, name = `Участок ${id}`): PtsSiteItem => ({
  id, name, ue_id: null, ue_name: null, nach_id: nach, nach_name: nach ? `Начальник ${nach}` : null,
  magistral_id: null, magistral_name: null, pipes: 1, length: 1,
});

describe('ptsHighlight', () => {
  it('без выбора подсветки нет (раньше всегда nach:2)', () => {
    expect(highlightViewparam(null)).toBe('nach:0;');
    expect(highlightViewparam({ kind: 'rs', id: 0, title: '' })).toBe('nach:0;');
    expect(highlightViewparam({ kind: 'ms', id: 19, title: 'МС 19' })).toBe('ms:19;');
    expect(highlightViewparam({ kind: 'nach', id: 1028, title: 'Начальник' })).toBe('nach:1028;');
  });

  it('viewparams: фрагменты, подписи, подсветка — как прежняя строка', () => {
    expect(buildViewparams([2, 3], 'NAPOR:on;RAS:on', null)).toBe('fragments:2_3;NAPOR:on;RAS:on;nach:0;');
    expect(buildViewparams([], 'NAPOR:on;', { kind: 'rs', id: 227, title: '' })).toBe('NAPOR:on;rs:227;');
    expect(buildViewparams([5], '', { kind: 'nach', id: 2, title: '' })).toBe('fragments:5;nach:2;');
  });

  it('дерево: начальник → его МС и РС, без начальника — в конце, поиск по участку', () => {
    const tree = chiefTree([site(1, 7), site(2, null)], [site(10, 7), site(11, 3)]);
    expect(tree.map((n) => [n.title, n.ms.map((s) => s.id), n.rs.map((s) => s.id)])).toEqual([
      ['Начальник 3', [], [11]],
      ['Начальник 7', [1], [10]],
      ['Без начальника участка', [2], []],
    ]);
    const found = chiefTree([site(1, 7)], [site(10, 7, 'Кенесары')], 'кенес');
    expect(found).toHaveLength(1);
    expect(found[0].ms).toEqual([]);
    expect(found[0].rs.map((s) => s.id)).toEqual([10]);
  });

  it('предупреждает о фрагментах, только если на карте нет ни одной трубы подсветки', () => {
    expect(hiddenHighlightFragments([6, 7, 3179], [2, 3, 3179])).toEqual([]);
    expect(hiddenHighlightFragments([6, 7], [2, 3])).toEqual([6, 7]);
    expect(hiddenHighlightFragments([6, 7], [])).toEqual([]); // пустой выбор — все фрагменты
    expect(hiddenHighlightFragments([], [2])).toEqual([]);
  });
});
