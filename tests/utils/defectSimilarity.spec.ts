import { describe, expect, it } from 'vitest';
import { featuresText, hotspotLineText, hotspotText, scorePct, type FailureHotspot } from '~/utils/defectSimilarity';

describe('defectSimilarity', () => {
  it('featuresText и scorePct', () => {
    expect(featuresText({ kind: 'fistula', pipe: 'return', diameter: 100 })).toBe('свищ · Т2 · Ду100');
    expect(featuresText({ kind: null, pipe: null, diameter: null })).toBe('вид, труба и диаметр не распознаны');
    expect(scorePct(0.725)).toBe(73);
    expect(scorePct(1.4)).toBe(100);
  });

  it('скопление и участок рядом', () => {
    const h: FailureHotspot = {
      defects: [1, 2, 3, 4, 5], count: 5, days: 4, kinds: { утечка: 1, порыв: 4 }, first: '2023-07-19',
      last: '2024-07-17', lon: 71.4, lat: 51.1, replaced_after: true, linked_in_journal: 4,
      line: { id: 33266217, diameter: 150, length_m: 9.6, laid: '2025-07-10', distance_m: 0.2 },
    };
    expect(hotspotText(h)).toBe('5 отказов, дней с отказами — 4: порыв 4, утечка 1');
    expect(hotspotLineText(h)).toBe('участок 33266217: Ду150, 9,6 м, проложен 2025');
    expect(hotspotLineText({ ...h, line: null })).toBe('участок теплосети рядом не найден');
  });
});
