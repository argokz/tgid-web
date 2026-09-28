import { describe, expect, it } from 'vitest';
import type { CardField, PtsSiteItem } from '~/services/ptsService';
import { TOOL_GROUPS } from '~/utils/toolCatalog';
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths';
import { cardPayload, describePipesChange, groupSitesByChief, inputType, siteTitle, toFormValue } from '~/utils/ptsSites';

const site = (id: number, nach: number | null, pipes = 0, name = `Участок ${id}`): PtsSiteItem => ({
  id, name, ue_id: null, ue_name: null, nach_id: nach, nach_name: nach ? `Начальник ${nach}` : null,
  magistral_id: null, magistral_name: id === 2 ? 'Магистраль 7' : null, pipes, length: 0,
});

const field = (name: string, kind: CardField['kind'], ref = false): CardField => ({
  name, label: name, kind, max_length: null, group: null,
  ref: ref ? { table: 'magistrali', id: 'id', label: 'naimenovanie_magistrali' } : null,
});

describe('ptsSites', () => {
  it('groups sites by chief like the desktop dock and filters by query', () => {
    const items = [site(1, 5, 3), site(2, 5, 4), site(3, null)];
    const groups = groupSitesByChief(items);
    expect(groups.map((g) => [g.title, g.items.length, g.pipes])).toEqual([
      ['Начальник 5', 2, 7],
      ['Без начальника участка', 1, 0],
    ]);
    expect(groupSitesByChief(items, 'магистраль 7').flatMap((g) => g.items.map((i) => i.id))).toEqual([2]);
    expect(siteTitle(items[0], 'rs')).toBe('РС 1 — Участок 1');
  });

  it('maps field kinds to inputs and db values to form values', () => {
    expect(inputType(field('a', 'int'))).toBe('number');
    expect(inputType(field('a', 'date'))).toBe('date');
    expect(inputType(field('a', 'int', true))).toBe('text');
    expect(toFormValue(field('d', 'date'), '2026-09-28T00:00:00')).toBe('2026-09-28');
    expect(toFormValue(field('b', 'bool'), null)).toBe(false);
  });

  it('builds payload with changed fields only (create: filled only)', () => {
    const fields = [field('name', 'str'), field('len', 'int'), field('mag', 'int', true)];
    const original = { name: 'A', len: 10, mag: null };
    expect(cardPayload(fields, { name: 'A', len: '10', mag: null }, original)).toEqual({});
    expect(cardPayload(fields, { name: 'B', len: '12', mag: '3' }, original)).toEqual({ name: 'B', len: 12, mag: 3 });
    expect(cardPayload(fields, { name: '', len: 10, mag: null }, original)).toEqual({ name: null });
    expect(cardPayload(fields, { name: 'N', len: '', mag: null }, null)).toEqual({ name: 'N' });
  });

  it('describes the pending change and has a toolbar entry with a known icon', () => {
    expect(describePipesChange('assign', 15, 15, 'РС 1')).toContain('Привязать');
    expect(describePipesChange('unassign', 2, 3, 'РС 1')).toContain('Снять');
    const tool = TOOL_GROUPS.flatMap((g) => g.items).find((t) => t.event === 'open-pts-sites');
    expect(tool).toBeTruthy();
    expect(resolveMdiSvgPath(tool!.icon)).not.toBe('');
  });
});
