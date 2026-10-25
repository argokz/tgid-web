import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConsumerLoadDiagnosticsDialog from '~/components/ConsumerLoadDiagnosticsDialog.vue';
import { mountWithVuetify, flushPromises, createTestPinia } from './mountHelper';

const api = vi.hoisted(() => ({
  getConsumerLoadLookups: vi.fn(),
  getConsumerLoadDiagnostics: vi.fn(),
  getConsumerLoadDiagnostic: vi.fn(),
}));
vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: api,
}));

const consumer = (id: number) => ({
  id, consumer_type: 'real', name: `Потребитель ${id}`, node_id: 500 + id, external_code: 'РС1', external_node_name: 'вставка',
  fragment_id: 1, fragment_name: 'ЗЭР', heating_load: 0, ventilation_load: 0, hot_water_load: 0, total_load: 0,
  state_name: 'закрыто', longitude: 76.9, latitude: 43.2,
});

async function open() {
  const w = mountWithVuetify(ConsumerLoadDiagnosticsDialog, { pinia: createTestPinia() });
  await (w.vm as any).openDialog();
  await flushPromises();
  return w;
}

describe('ConsumerLoadDiagnosticsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getConsumerLoadLookups.mockResolvedValue({ states: [{ id: 1, name: 'закрыто' }], fragments: [], counts: { total: 10 }, calculation_warning: null });
  });

  it('плитки — счётчики по фильтрам; плитка вида — фильтр запроса', async () => {
    api.getConsumerLoadDiagnostics.mockResolvedValue({ items: [consumer(1)], total: 1, pages: 1, counts: { total: 52516, zero_load: 781, closed: 77 } });
    const w = await open();
    expect(api.getConsumerLoadDiagnostics).toHaveBeenLastCalledWith(expect.objectContaining({ diagnostic: 'zero_load', page: 1, page_size: 50 }));
    const tiles = w.findAll('.load-kpi > *');
    expect(tiles[0].text().replace(/\s+/g, ' ')).toContain('52 516');
    await tiles[2].trigger('click');
    await flushPromises();
    expect(api.getConsumerLoadDiagnostics).toHaveBeenLastCalledWith(expect.objectContaining({ diagnostic: 'closed' }));
    w.unmount();
  });

  it('сбой списка — ошибка с повтором, а не «потребители не найдены»', async () => {
    api.getConsumerLoadDiagnostics.mockRejectedValue(new Error('timeout'));
    const w = await open();
    expect(w.text()).toContain('Список потребителей не загружен');
    expect(w.text()).not.toContain('Потребители не найдены');
    w.unmount();
  });

  it('экспорт CSV — все страницы по фильтрам, а не только текущая', async () => {
    api.getConsumerLoadDiagnostics.mockImplementation(async (q: { page: number; page_size: number }) => (
      q.page_size === 50
        ? { items: [consumer(1)], total: 3, pages: 1, counts: {} }
        : { items: [consumer(q.page * 10)], total: 3, pages: 3, counts: {} }
    ));
    const createUrl = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const w = await open();
    await (w.vm as any).$.setupState.exportCsv();
    const exportCalls = api.getConsumerLoadDiagnostics.mock.calls.filter(([q]) => q.page_size === 200);
    expect(exportCalls.map(([q]) => q.page)).toEqual([1, 2, 3]);
    expect(createUrl).toHaveBeenCalledTimes(1);
    w.unmount();
  });
});
