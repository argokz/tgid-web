import { describe, expect, it } from 'vitest';
import { matchScore, pushRecent, rankCommands, readRecent, RECENT_LIMIT, type RecentEntry } from '~/utils/commandPalette';
import { findNodesUrl, geometryCenter, getNodeSubtitle, getNodeTitle, nodeGeometryUrl, viewParamValue } from '~/utils/nodeSearch';

const memStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
};

describe('палитра команд — ранжирование', () => {
  const items = [
    { title: 'Опрессовки', subtitle: 'Испытания и акты' },
    { title: 'Очередь опрессовок', subtitle: 'Реестр очередей' },
    { title: 'Нарушения', subtitle: 'Журнал дефектов', keywords: 'Эксплуатация' },
    { title: 'Ремонты' },
  ];

  it('начало названия выше слова в названии, выше подстроки, выше описания; регистр и ё не важны', () => {
    expect(rankCommands('опрес', items).map((i) => i.title)).toEqual(['Опрессовки', 'Очередь опрессовок']);
    expect(rankCommands('дефект', items).map((i) => i.title)).toEqual(['Нарушения']);
    expect(rankCommands('эксплуат', items).map((i) => i.title)).toEqual(['Нарушения']);
    expect(rankCommands('xyz', items)).toEqual([]);
    expect(matchScore('', items[0])).toBe(1);
    expect(matchScore('ОПР', items[0])).toBe(100);
    expect(matchScore('очерёдь', { title: 'Очередь' })).toBe(100);
  });

  it('пустой запрос оставляет всё в исходном порядке', () => {
    expect(rankCommands('', items).map((i) => i.title)).toEqual(items.map((i) => i.title));
  });
});

describe('палитра команд — недавние', () => {
  it('LRU: свежая первая, повтор поднимает наверх, не больше лимита, мусор в хранилище игнорируется', () => {
    const s = memStorage();
    const entry = (id: string): RecentEntry => ({ id, kind: 'tool', title: id });
    for (let i = 0; i < RECENT_LIMIT + 3; i++) pushRecent(s, entry(`t${i}`));
    const list = readRecent(s);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0].id).toBe(`t${RECENT_LIMIT + 2}`);
    pushRecent(s, entry('t5'));
    expect(readRecent(s)[0].id).toBe('t5');
    expect(readRecent(s).filter((e) => e.id === 't5')).toHaveLength(1);
    s.setItem('commandPalette.recent', '{"bad": true}');
    expect(readRecent(s)).toEqual([]);
    s.setItem('commandPalette.recent', 'не json');
    expect(readRecent(s)).toEqual([]);
  });
});

describe('поиск узлов — подписи и адреса WFS', () => {
  it('URL поиска и геометрии, заголовок и подзаголовок узла', () => {
    expect(findNodesUrl('http://gs/geoserver/', 'AlmatyGIS', ' ТК-12 ')).toBe(
      'http://gs/geoserver/AlmatyGIS/ows?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&typeName=AlmatyGIS:find_node&viewparams=text%3A%D0%A2%D0%9A-12',
    );
    expect(nodeGeometryUrl('http://gs/geoserver', 'AlmatyGIS', 42)).toContain('typeName=AlmatyGIS:id_nodes&viewparams=id%3A42');
    // разделители viewparams GeoServer экранируются, чужой параметр через «;» не подсунуть
    expect(viewParamValue('a,b;id:1\\')).toBe('a\\,b\\;id:1\\\\');
    expect(decodeURIComponent(findNodesUrl('http://gs', 'W', 'x;id:1').split('viewparams=')[1])).toBe('text:x\\;id:1');
    expect(getNodeTitle({ id: 7, 'Наименование узла': ' ТК-12 ' })).toBe('ТК-12');
    expect(getNodeTitle({ id: 7, nomer: '15' })).toBe('Узел № 15');
    expect(getNodeTitle({ id: 7 })).toBe('Узел #7');
    expect(getNodeSubtitle({ id: 7, 'Код': 'A1', 'Описание': 'камера' })).toBe('id: 7 · Код: A1 · камера');
    expect(getNodeSubtitle({ foo: 'bar' })).toBe('foo: bar');
  });

  it('центр геометрии: точка, середина линии, среднее полигона', () => {
    expect(geometryCenter({ type: 'Point', coordinates: [76.9, 43.2] })).toEqual([76.9, 43.2]);
    expect(geometryCenter({ type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] })).toEqual([1, 1]);
    expect(geometryCenter({ type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] })).toEqual([1, 1]);
    expect(geometryCenter(null)).toBeNull();
    expect(geometryCenter({ type: 'Point', coordinates: ['x', 1] })).toBeNull();
  });
});
