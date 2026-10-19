import { describe, expect, it } from 'vitest';
import { bendChanges, planBendResistances, type LineBendsData } from '~/utils/bends';

const data = (passports: LineBendsData['passports']): LineBendsData => ({
  line_id: 20, pair_line_id: null, has_shape: true, vertices: 6, bends: [],
  classes: [
    { cls: 45, title: '45°', count: 1, default: 54, options: [{ id: 54, name: 'Отвод 45', v: 0.3 }, { id: 23, name: 'Колено 45', v: 0.32 }] },
    { cls: 90, title: '90°', count: 3, default: 56, options: [{ id: 56, name: 'Отвод 90 2 шва', v: 0.6 }, { id: 57, name: 'Отвод 90 3 шва', v: 0.5 }] },
  ],
  bend_item_ids: [54, 23, 56, 57],
  items: { 15: { name: 'Задвижка нормальная', v: 0.3 }, 54: { name: 'Отвод 45', v: 0.3 }, 56: { name: 'Отвод 90 2 шва', v: 0.6 }, 57: { name: 'Отвод 90 3 шва', v: 0.5 } },
  passports,
  thresholds: { min_angle_deg: 10, min_segment_m: 0.5 },
});

describe('bends: отводы → местные сопротивления', () => {
  it('сумма без списка: нерасписанная часть сохраняется, отводы добавляются', () => {
    const d = data([{ line_id: 20, id: 5, mestn: '', localressum: 4.2, version: '1' }]);
    const p = planBendResistances(d, d.passports[0], {}, 'missing', true);
    expect(p.list).toBe('54|1|0.3 56|3|0.6');
    expect(p.unlisted).toBe(4.2);
    expect(p.afterSum).toBe(6.3);
    expect(planBendResistances(d, d.passports[0], {}, 'missing', false).afterSum).toBe(2.1);
  });

  it('недостающие — с учётом уже записанных отводов того же угла любого вида', () => {
    const d = data([{ line_id: 20, id: 5, mestn: '15|2|0.3 57|2|0.5', localressum: 1.6, version: '1' }]);
    const p = planBendResistances(d, d.passports[0], { 90: 56 }, 'missing', true);
    expect(p.list).toBe('15|2|0.3 57|2|0.5 54|1|0.3 56|1|0.6');
    expect(p.after.find((r) => r.id === 56)?.added).toBe(1);
    expect(p.unlisted).toBe(0);
    expect(p.afterSum).toBeCloseTo(2.5, 6);
  });

  it('замена: прежние отводы убираются, прочие сопротивления остаются; без изменений — не пишется', () => {
    const d = data([{ line_id: 20, id: 5, mestn: '15|2|0.3 57|2|0.5', localressum: 1.6, version: '7' }]);
    const p = planBendResistances(d, d.passports[0], { 90: 57 }, 'replace', true);
    expect(p.list).toBe('15|2|0.3 54|1|0.3 57|3|0.5');
    expect(p.afterSum).toBeCloseTo(2.4, 6);
    expect(bendChanges([p])).toEqual({
      changes: [
        { table: 'heatpipesections', id: 5, field: 'mestn', value: '15|2|0.3 54|1|0.3 57|3|0.5' },
        { table: 'heatpipesections', id: 5, field: 'localressum', value: p.afterSum },
      ],
      versions: { 'heatpipesections:5': '7' },
    });
    const same = data([{ line_id: 20, id: 5, mestn: '54|1|0.3 56|3|0.6', localressum: 2.1, version: '1' }]);
    expect(planBendResistances(same, same.passports[0], {}, 'missing', true).changed).toBe(false);
  });
});
