import { describe, expect, it } from 'vitest';
import type { GroupSetterInfo } from '~/services/groupSettersService';
import { TOOL_GROUPS } from '~/utils/toolCatalog';
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths';
import {
  apiErrorText,
  buildSelection,
  describeChange,
  dictionaryPayload,
  groupSetters,
  parseSetterValue,
  pickKindForTarget,
  type SelectionDraft,
} from '~/utils/groupSetters';
import { useJournalMapBridge } from '~/composables/useJournalMapBridge';

const draft = (patch: Partial<SelectionDraft>): SelectionDraft => ({
  mode: 'fragment',
  fragmentIds: [],
  pickedIds: [],
  useBbox: false,
  bbox: null,
  conditions: [],
  ...patch,
});

const setter = (patch: Partial<GroupSetterInfo>): GroupSetterInfo => ({
  key: 'roughness',
  label: 'Установить эквивалентную шероховатость',
  group: 'Участки теплопроводов',
  target: 'pipes',
  target_label: 'Участки теплопроводов',
  kind: 'float',
  field_label: 'Шероховатость',
  default: 0.5,
  min: 0,
  max: 10,
  choices: [],
  ref: null,
  writes: ['heatpipesections.tuberoughness'],
  desktop: 'gid8 aSetSher',
  affects_calc: true,
  note: '',
  ...patch,
});

describe('buildSelection', () => {
  it('fragment / map / filter', () => {
    expect(buildSelection(draft({ fragmentIds: [74] }))).toEqual({ mode: 'fragment', fragment_ids: [74] });
    expect(buildSelection(draft({}))).toBe('Выберите фрагмент');
    expect(buildSelection(draft({ mode: 'map', pickedIds: [5, 6] }))).toEqual({ mode: 'ids', ids: [5, 6] });
    expect(typeof buildSelection(draft({ mode: 'map' }))).toBe('string');
    expect(typeof buildSelection(draft({ mode: 'filter' }))).toBe('string');
    expect(buildSelection(draft({ mode: 'filter', useBbox: true, bbox: [1, 2, 3, 4] }))).toEqual({ mode: 'filter', bbox: [1, 2, 3, 4] });
    expect(buildSelection(draft({ mode: 'filter', useBbox: true }))).toBe('Не удалось определить видимую область карты');
    expect(buildSelection(draft({
      mode: 'filter',
      fragmentIds: [74],
      conditions: [{ field: 'roughness', op: 'eq', value: '2' }, { field: 'tubing_type', op: 'null', value: 'x' }],
    }))).toEqual({
      mode: 'filter',
      fragment_ids: [74],
      where: [{ field: 'roughness', op: 'eq', value: '2' }, { field: 'tubing_type', op: 'null' }],
    });
    expect(buildSelection(draft({ mode: 'filter', fragmentIds: [1], conditions: [{ field: 'x', op: 'eq', value: '' }] })))
      .toBe('Укажите значение в условии фильтра');
  });
});

describe('parseSetterValue', () => {
  it('validates by kind and range', () => {
    expect(parseSetterValue(setter({}), '0,5')).toEqual({ value: 0.5 });
    expect(parseSetterValue(setter({}), '11')).toEqual({ error: 'Не больше 10' });
    expect(parseSetterValue(setter({}), 'abc')).toEqual({ error: 'Ожидается число' });
    expect(parseSetterValue(setter({}), '')).toEqual({ error: 'Укажите значение' });
    expect(parseSetterValue(setter({ kind: 'ref' }), 0)).toEqual({ value: 0 });
    expect(parseSetterValue(setter({ kind: 'ref' }), '1.5')).toEqual({ error: 'Ожидается целое число' });
    expect(parseSetterValue(setter({ kind: 'computed' }), null)).toEqual({ value: null });
    expect(parseSetterValue(setter({ kind: 'date' }), '2026-09-27')).toEqual({ value: '2026-09-27' });
  });
});

describe('helpers', () => {
  it('pick kind, change text, groups, errors, dictionary payload', () => {
    expect(pickKindForTarget('consumers')).toBe('node');
    expect(pickKindForTarget('pipes')).toBe('line');
    expect(describeChange({ a: 2, b: null }, { a: 0.5, b: 'x' })).toBe('a: 2 → 0.5; b: — → x');
    const groups = groupSetters([setter({ key: 'a', group: 'G1' }), setter({ key: 'b', group: 'G2' }), setter({ key: 'c', group: 'G1' })]);
    expect(groups.map((g) => [g.group, g.items.map((i) => i.key)])).toEqual([['G1', ['a', 'c']], ['G2', ['b']]]);
    expect(apiErrorText({ data: { message: 'Ошибки в полях', field_errors: { kodkv: 'обязательное поле' } } }))
      .toBe('Ошибки в полях — kodkv: обязательное поле');
    expect(apiErrorText({ userMessage: 'Недостаточно прав' })).toBe('Недостаточно прав');
    expect(dictionaryPayload({ kodkv: 'X', otoplz: '', fileid: 74 }, null)).toEqual({ kodkv: 'X', fileid: 74 });
    expect(dictionaryPayload({ kodkv: 'X', otoplz: '0.9' }, { kodkv: 'X', otoplz: 0.69 })).toEqual({ otoplz: '0.9' });
  });

  it('tools are registered for editors with icons', () => {
    const items = TOOL_GROUPS.flatMap((g) => g.items);
    for (const event of ['open-group-setters', 'open-dictionaries']) {
      const tool = items.find((t) => t.event === event);
      expect(tool?.requires).toBe('editor');
      expect(resolveMdiSvgPath(tool!.icon)).not.toBe('');
    }
    for (const g of TOOL_GROUPS) expect(resolveMdiSvgPath(g.icon)).not.toBe('');
  });

  it('map bridge picks nodes', async () => {
    const bridge = useJournalMapBridge();
    const pending = bridge.startPick([], 'Установщик', 'node');
    expect(bridge.state.pick.kind).toBe('node');
    bridge.togglePicked(7, { geometry: { type: 'Point', coordinates: [0, 0] } });
    bridge.finishPick(true);
    expect(await pending).toEqual([7]);
    const next = bridge.startPick([], 'Контур');
    expect(bridge.state.pick.kind).toBe('line');
    bridge.finishPick(false);
    expect(await next).toBeNull();
  });
});
