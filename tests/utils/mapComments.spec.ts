import { describe, expect, it } from 'vitest';
import {
  COMMENT_COLORS,
  COMMENT_PIN_LAYER,
  addMention,
  hitsCommentPin,
  splitMentions,
  threadFromHash,
  threadLink,
  threadMapFeatures,
  timeAgo,
} from '~/utils/mapComments';

describe('комментарии на карте: упоминания', () => {
  it('подсвечиваются только упоминания, которые сервер признал', () => {
    const body = 'Здесь парит, @ivanov и @Петров. Почта a@b.kz — не упоминание; @чужой тоже нет';
    const segs = splitMentions(body, ['ivanov', 'петров']);
    expect(segs.filter((s) => s.mention).map((s) => s.text)).toEqual(['@ivanov', '@Петров']);
    expect(segs.map((s) => s.text).join('')).toBe(body);
    expect(splitMentions('без упоминаний', [])).toEqual([{ text: 'без упоминаний', mention: false }]);
  });

  it('вставка упоминания — с пробелами, без повтора', () => {
    expect(addMention('', 'ivanov')).toBe('@ivanov ');
    expect(addMention('Глянь', 'ivanov')).toBe('Глянь @ivanov ');
    expect(addMention('Глянь @ivanov ', 'ivanov')).toBe('Глянь @ivanov ');
  });
});

describe('комментарии на карте: ссылка и карта', () => {
  it('ссылка на ветку открывает карту в её точке, номер ветки читается из адреса', () => {
    const link = threadLink('https://gis.example/itwin-map/#map=12/43/76/0/0&fr=74', { id: 12, lon: 76.88212, lat: 43.23853, zoom: 16.5 });
    expect(link).toBe('https://gis.example/itwin-map/#map=16.5/43.238530/76.882120/0/0&c=12');
    expect(threadFromHash(new URL(link).hash)).toBe(12);
    expect(threadFromHash('#map=16/43/76/0/0')).toBeNull();
    expect(threadFromHash('#c=abc')).toBeNull();
    expect(threadLink('https://x/', { id: 3, lon: 1, lat: 2, zoom: null })).toContain('#map=17/');
  });

  it('цвет точки: решено, есть новое, открыта; подпись — число сообщений', () => {
    const fc = threadMapFeatures({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { id: 1, count: 3, resolved: false, unread: true } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { id: 2, count: 1, resolved: true, unread: true } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { id: 3, count: 2, resolved: false, unread: false } },
    ] });
    expect(fc.features.map((f) => f.properties?.color)).toEqual([COMMENT_COLORS.unread, COMMENT_COLORS.resolved, COMMENT_COLORS.open]);
    expect(fc.features[0]!.properties?.label).toBe('3');
  });

  it('клик по точке ветки не выбирает объект сети', () => {
    const map = (hits: number, layer = true) => ({
      getLayer: (id: string) => (layer && id === COMMENT_PIN_LAYER ? {} : undefined),
      queryRenderedFeatures: () => new Array(hits).fill({}),
    });
    expect(hitsCommentPin(map(1), { x: 1, y: 1 })).toBe(true);
    expect(hitsCommentPin(map(0), { x: 1, y: 1 })).toBe(false);
    expect(hitsCommentPin(map(1, false), { x: 1, y: 1 })).toBe(false);
    expect(hitsCommentPin(null, { x: 1, y: 1 })).toBe(false);
  });

  it('давность', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    expect(timeAgo('2026-10-30T11:59:40Z', now)).toBe('только что');
    expect(timeAgo('2026-10-30T11:45:00Z', now)).toBe('15 мин назад');
    expect(timeAgo('2026-10-30T09:00:00Z', now)).toBe('3 ч назад');
    expect(timeAgo('2026-10-27T09:00:00Z', now)).toBe(new Date('2026-10-27T09:00:00Z').toLocaleDateString('ru-RU'));
    expect(timeAgo('вчера', now)).toBe('');
  });
});
