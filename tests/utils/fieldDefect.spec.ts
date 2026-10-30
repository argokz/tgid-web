import { describe, expect, it } from 'vitest';
import { appendPreset, defaultSourceId, defectAction, defectRefs } from '~/utils/fieldDefect';
import { NEW_ORDER, describeAction, flushQueue, type FieldAction } from '~/utils/fieldQueue';
import type { WorkOrder } from '~/utils/workOrders';

const draft = {
  pos: { lon: 76.95, lat: 43.25, accuracy: 9 },
  description: 'Парение; течь',
  sourceId: 6,
  categoryId: null,
  priority: 1,
  photo: null,
  caption: '',
  takenAt: null,
};

describe('окно дефекта', () => {
  it('фразы дописываются, источник по умолчанию — «Осмотр»', () => {
    expect(appendPreset('', 'Парение')).toBe('Парение');
    expect(appendPreset(' Парение ', 'Течь')).toBe('Парение; течь');
    expect(defaultSourceId([{ id: 1, name: 'Эксплуатация' }, { id: 6, name: ' Осмотр ' }])).toBe(6);
    expect(defaultSourceId([{ id: 1, name: 'Эксплуатация' }])).toBeNull();
  });

  it('справочники журнала → списки, без id — мимо, без названия — номер', () => {
    expect(defectRefs([{ id: 1, name: 'Порыв', code: null }, { id: 2, name: null }, { name: 'x' }])).toEqual([
      { id: 1, name: 'Порыв' }, { id: 2, name: '№2' },
    ]);
    expect(defectRefs(undefined)).toEqual([]);
  });
});

describe('дефект в очереди', () => {
  it('место — из окна, без наряда; фото — со своим ключом', () => {
    const a = defectAction(draft, { id: 'k1', photoId: 'k2' }, '2026-10-30T09:00:00Z');
    expect(a).toMatchObject({ id: 'k1', kind: 'defect', orderId: NEW_ORDER, lon: 76.95, lat: 43.25, priority: 1, state: 'pending' });
    expect(a.photo).toBeUndefined();
    expect(a.photoId).toBeUndefined();
    const photo = new Blob(['x'], { type: 'image/jpeg' });
    const withPhoto = defectAction({ ...draft, photo, caption: 'Люк' }, { id: 'k1', photoId: 'k2' }, '2026-10-30T09:00:00Z');
    expect(withPhoto).toMatchObject({ photo, photoId: 'k2', caption: 'Люк', takenAt: '2026-10-30T09:00:00Z' });
    expect(describeAction(withPhoto, (s) => s)).toBe('Дефект: «Парение; течь» с фото');
  });

  it('ответ на дефект — новая заявка, она попадает в список нарядов', async () => {
    const a = defectAction(draft, { id: 'k1', photoId: 'k2' }, '2026-10-30T09:00:00Z');
    const order = { id: 42, revision: 1 } as WorkOrder;
    const res = await flushQueue([a as FieldAction], async () => order, () => ({ status: 0, message: '' }));
    expect(res.sent).toEqual(['k1']);
    expect(res.orders.get(42)).toBe(order);
  });
});
