import { describe, it, expect, vi, beforeEach } from 'vitest';
import FaultDiagnosticsModal from '~/components/FaultDiagnosticsModal.vue';
import { mountWithVuetify, flushPromises, createTestPinia } from './mountHelper';

const api = vi.hoisted(() => ({
  getDefects: vi.fn(),
  getCorrosionIndicators: vi.fn(),
  getDefectLookups: vi.fn(),
}));
vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: api,
}));

const defect = (id: number, extra: Record<string, unknown> = {}) => ({
  id, category_name: 'Порыв', state_name: 'Нарушение', detected_at: '2026-07-22T00:00:00',
  address: `Абая ${id}`, description: 'Порыв при опрессовке', latitude: 51.17, longitude: 71.44, ...extra,
});

async function open() {
  const w = mountWithVuetify(FaultDiagnosticsModal, { pinia: createTestPinia() });
  (w.vm as any).openDialog();
  await flushPromises();
  return w;
}

describe('FaultDiagnosticsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getDefectLookups.mockResolvedValue({ states: [{ id: 1, name: 'Нарушение' }, { id: 3, name: 'После ремонта' }] });
  });

  it('итог — по всей базе, не по показанным строкам; лимит передаётся как page_size', async () => {
    api.getDefects.mockResolvedValue({
      items: [defect(2), defect(1, { latitude: null, longitude: null })], total: 1785,
      state_counts: [{ state_id: 1, count: 78 }, { state_id: 3, count: 1666 }, { state_id: null, count: 41 }],
    });
    api.getCorrosionIndicators.mockResolvedValue({ items: [{ id: 5, number: '294', phase_name: 'После расчета' }], total: 1 });
    const w = await open();
    expect(api.getDefects).toHaveBeenCalledWith({ page: 1, page_size: 200 });
    const tiles = w.findAll('.fault-tiles > *').map((t) => t.text().replace(/\s+/g, ' '));
    expect(tiles[0]).toContain('1 785');
    expect(tiles.some((t) => t.includes('После ремонта') && t.includes('1 666'))).toBe(true);
    expect(tiles.some((t) => t.includes('Без состояния') && t.includes('41'))).toBe(true);
    // показаны не все дефекты — пометка со ссылкой на журнал; коррозия показана целиком — без пометки
    const notes = w.findAll('.fault-notes > span');
    expect(notes).toHaveLength(1);
    expect(notes[0].text().replace(/\s+/g, ' ')).toContain('последние 2 из 1 785');
    await notes[0].find('button').trigger('click');
    expect(w.emitted('open-journal')).toEqual([['defect']]);
    expect(w.findAll('tbody tr')).toHaveLength(3);
    w.unmount();
  });

  it('плитка вида — фильтр; строка с координатами открывает запись, без координат — нет', async () => {
    api.getDefects.mockResolvedValue({ items: [defect(2), defect(1, { latitude: null })], total: 2, state_counts: [] });
    api.getCorrosionIndicators.mockResolvedValue({ items: [{ id: 5, number: '294', latitude: 51, longitude: 71 }], total: 1 });
    const w = await open();
    await w.findAll('.fault-tiles > *')[1].trigger('click');
    expect(w.findAll('tbody tr')).toHaveLength(1);
    await w.find('tbody tr').trigger('click');
    expect(w.emitted('open-corrosion')).toEqual([[5]]);
    await w.findAll('.fault-tiles > *')[0].trigger('click');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    await rows[1].trigger('click');
    expect(w.emitted('open-defect')).toBeUndefined();
    await rows[0].trigger('click');
    expect(w.emitted('open-defect')).toEqual([[2]]);
    w.unmount();
  });

  it('сбой одного журнала — второй показан, предупреждение названо; сбой обоих — ошибка с повтором', async () => {
    api.getDefects.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    api.getCorrosionIndicators.mockResolvedValue({ items: [{ id: 5, number: '294' }], total: 1 });
    const w = await open();
    expect(w.text()).toContain('Журнал «дефекты» недоступен');
    expect(w.findAll('tbody tr')).toHaveLength(1);
    w.unmount();

    api.getCorrosionIndicators.mockRejectedValue(new Error('down'));
    const w2 = await open();
    expect(w2.text()).toContain('Не удалось загрузить неисправности');
    expect(w2.findAll('tbody tr')).toHaveLength(0);
    w2.unmount();
  });
});
