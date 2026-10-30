import { describe, expect, it } from 'vitest';
import { defectAction } from '~/utils/fieldDefect';
import type { FieldAction } from '~/utils/fieldQueue';
import { describeAction, flushQueue } from '~/utils/fieldQueue';
import {
  CHECK_COLORS,
  applyPendingChecks,
  nextPoint,
  routePointFeatures,
  routeProgress,
  routeSummary,
  type WorkOrderRoute,
} from '~/utils/fieldRoute';

const point = (node_id: number, state: 'ok' | 'defect' | null = null) => ({
  node_id, name: `ТК-${node_id}`, node_type: 'Камера', lon: 76.9 + node_id / 1000, lat: 43.2, state,
  note: '', defect_id: null, by_user: null, at: null,
});
const route = (): WorkOrderRoute => {
  const points = [point(1, 'ok'), point(2), point(3)];
  return { order_id: 11, inspection: { id: 7, name: 'Контур 7' }, lines: { type: 'FeatureCollection', features: [] },
    points, progress: routeProgress(points), truncated: false };
};
const check = (nodeId: number, checkState: 'ok' | 'defect', extra: Partial<FieldAction> = {}): FieldAction => ({
  id: `c${nodeId}${checkState}`, orderId: 11, orderNumber: 'Н-11', kind: 'check', createdAt: '2026-10-30T09:00:00Z',
  lon: null, lat: null, state: 'pending', nodeId, nodeName: `ТК-${nodeId}`, checkState, ...extra,
});

describe('обход: отметки из очереди', () => {
  it('неотправленные отметки и дефекты узлов видны сразу, последняя побеждает', () => {
    const defect = defectAction(
      { pos: { lon: 76.9, lat: 43.2 }, description: 'Течь', sourceId: null, categoryId: null, priority: 2, photo: null,
        caption: '', takenAt: null, node: { orderId: 11, nodeId: 3, name: 'ТК-3' } },
      { id: 'd1', photoId: 'p1' }, '2026-10-30T09:05:00Z',
    );
    const r = applyPendingChecks(route(), [check(2, 'ok'), check(1, 'defect'), check(1, 'ok', { id: 'later' }), defect,
      check(2, 'defect', { orderId: 99 }), check(3, 'ok', { state: 'failed' })]);
    expect(r.points.map((p) => [p.node_id, p.state, Boolean(p.pending)])).toEqual([[1, 'ok', true], [2, 'ok', true], [3, 'defect', true]]);
    expect(r.progress).toEqual({ total: 3, ok: 2, defect: 1 });
    expect(applyPendingChecks(route(), [])).toEqual(route());
    expect(defect).toMatchObject({ routeOrderId: 11, nodeId: 3, nodeName: 'ТК-3' });
  });

  it('следующий узел, итог и точки карты', () => {
    const r = route();
    expect(nextPoint(r)?.node_id).toBe(2);
    expect(routeSummary(r)).toBe('Обход «Контур 7»: осмотрено узлов 1 из 3, дефектов нет; не осмотрено 2.');
    const all = applyPendingChecks(r, [check(2, 'defect'), check(3, 'ok')]);
    expect(nextPoint(all)).toBeNull();
    expect(routeSummary(all)).toBe('Обход «Контур 7»: осмотрено узлов 3 из 3, с дефектами 1.');
    const f = routePointFeatures(all).features[1];
    expect(f.properties).toMatchObject({ title: 'ТК-2', state: 'defect', color: CHECK_COLORS.defect });
  });

  it('отметка в очереди: подпись и отправка без наряда в ответе', async () => {
    expect(describeAction(check(2, 'defect'), (s) => s)).toBe('Н-11: ТК-2 — с дефектом');
    const res = await flushQueue([check(2, 'ok')], async () => null, () => ({ status: 0, message: '' }));
    expect(res.sent).toEqual(['c2ok']);
    expect(res.orders.size).toBe(0);
  });
});
