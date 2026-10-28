import { describe, expect, it } from 'vitest';
import { formatPermalinkHash, parsePermalinkHash } from '~/utils/mapPermalink';

describe('mapPermalink', () => {
  it('собирает и разбирает вид, фрагменты и слои', () => {
    const hash = formatPermalinkHash({
      view: { center: [76.998391, 43.377224], zoom: 16.5, bearing: 12.34, pitch: 0 },
      fragments: [42, 74],
      layers: ['AlmatyGIS:uzel', 'AlmatyGIS:heatpipesections'],
    });
    expect(hash).toBe('#map=16.5/43.37722/76.99839/12.3/0&fr=42,74&ly=AlmatyGIS%3Auzel,AlmatyGIS%3Aheatpipesections');
    expect(parsePermalinkHash(hash)).toEqual({
      view: { center: [76.99839, 43.37722], zoom: 16.5, bearing: 12.3, pitch: 0 },
      fragments: [42, 74],
      layers: ['AlmatyGIS:uzel', 'AlmatyGIS:heatpipesections'],
    });
  });

  it('пустой или чужой адрес — нет ссылки на вид', () => {
    expect(parsePermalinkHash('')).toBeNull();
    expect(parsePermalinkHash('#')).toBeNull();
    expect(parsePermalinkHash('#section-2')).toBeNull();
    expect(formatPermalinkHash({})).toBe('');
  });

  it('вид без поворота и наклона, поворот приводится к 0–360', () => {
    expect(parsePermalinkHash('#map=12/51.13/71.43')?.view).toEqual({ center: [71.43, 51.13], zoom: 12, bearing: 0, pitch: 0 });
    expect(parsePermalinkHash('#map=12/51.13/71.43/-90/30')?.view?.bearing).toBe(270);
  });

  it('неверные части отбрасываются, верные применяются', () => {
    expect(parsePermalinkHash('#map=99/43/76&fr=42')).toEqual({ fragments: [42] });
    expect(parsePermalinkHash('#map=16/95/76')).toBeNull();
    expect(parsePermalinkHash('#map=16/43/76/0/89')).toBeNull();
    expect(parsePermalinkHash('#map=abc/43/76&fr=1,x')).toBeNull();
    expect(parsePermalinkHash('#fr=0,-3')).toBeNull();
    expect(parsePermalinkHash('#fr=5,5,7')).toEqual({ fragments: [5, 7] });
    expect(parsePermalinkHash('#ly=AlmatyGIS:uzel,%3Cscript%3E')).toBeNull();
    expect(parsePermalinkHash('#ly=%E0%A4%A')).toBeNull();
  });
});
