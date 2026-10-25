import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalculationProtocol from '~/components/CalculationProtocol.vue';
import { useNotificationStore } from '~/stores/notificationStore';
import { useUiStore } from '~/stores/uiStore';
import { mountWithVuetify, flushPromises, createTestPinia } from './mountHelper';

const api = vi.hoisted(() => ({
  getCalcProtocol: vi.fn(),
  locateProtocolObjects: vi.fn(),
  listCalcProtocols: vi.fn(),
}));
vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: api,
}));

const record = (id: number, errors: number, warnings: number) => ({
  id, request_id: `r${id}`, task_id: null, calculationid: id, fileid: 72, fragment_name: 'ЗЭР',
  created_at: '2026-10-15T15:43:47', author: 'admin', mode: 'planned', params: null, status: 'success',
  errors, warnings,
  summary: {
    errors, warnings, by_category: { regulators: { error: errors, warning: warnings } },
    category_labels: { regulators: 'Регуляторы и байпасы' }, header: [], duration_s: null,
  },
  entries: [{
    seq: 1, severity: 'error', text: 'Регулятор не обеспечивает давление', fragment_id: 72, component: null,
    category: 'regulators', fix: null, count: 1, objects: [{ kind: 'node', id: 525506, label: 'УТ-1' }],
  }],
});

function mount() {
  const pinia = createTestPinia();
  const w = mountWithVuetify(CalculationProtocol, { pinia, props: { show: true } });
  return { w, notify: useNotificationStore(), ui: useUiStore() };
}

describe('CalculationProtocol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.locateProtocolObjects.mockResolvedValue({ nodes: {}, lines: {}, pairs: {} });
  });

  it('плитки ошибок и предупреждений; после пересчёта тех же фрагментов — изменение к прошлому', async () => {
    const { w } = mount();
    api.getCalcProtocol.mockResolvedValueOnce(record(1, 3, 10));
    await (w.vm as any).loadProtocols([1]);
    await flushPromises();
    let tiles = w.findAll('.analysis-kpi').map((t) => t.text().replace(/\s+/g, ' '));
    expect(tiles[0]).toContain('Ошибки');
    expect(tiles[0]).toContain('3');
    expect(tiles[0]).not.toContain('к прошлому');

    api.getCalcProtocol.mockResolvedValueOnce(record(2, 1, 10));
    await (w.vm as any).loadProtocols([2], { keepPrevious: true });
    await flushPromises();
    tiles = w.findAll('.analysis-kpi').map((t) => t.text().replace(/\s+/g, ' '));
    expect(tiles[0]).toContain('к прошлому');
    expect(tiles[0]).toMatch(/[−-]\s?2/);
    // плитка — фильтр по важности
    await w.findAll('.analysis-kpi')[1].trigger('click');
    expect(w.text()).toContain('Нет сообщений по фильтру');
    w.unmount();
  });

  it('сбой поиска объектов — ошибка, а не ложное «нет координат»', async () => {
    const { w, notify } = mount();
    const warn = vi.spyOn(notify, 'showWarning');
    const error = vi.spyOn(notify, 'showError');
    api.getCalcProtocol.mockResolvedValueOnce(record(1, 1, 0));
    api.locateProtocolObjects.mockRejectedValue(new Error('timeout'));
    await (w.vm as any).loadProtocols([1]);
    await flushPromises();
    await w.find('.entry').trigger('click');
    await flushPromises();
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0][0])).toContain('Не удалось найти объекты протокола');
    expect(warn).not.toHaveBeenCalled();
    w.unmount();
  });

  it('панель встаёт между панелью слоёв и карточкой', async () => {
    const { w, ui } = mount();
    ui.setLeftInset(340);
    ui.setRightInset(420);
    await flushPromises();
    const style = w.find('.protocol-container').attributes('style') || '';
    expect(style).toContain('left: 340px');
    expect(style).toContain('right: 420px');
    w.unmount();
  });

  it('история: сбой списка — состояние ошибки с повтором, а не пустой список', async () => {
    const { w } = mount();
    api.listCalcProtocols.mockRejectedValueOnce(new Error('down'));
    await (w.vm as any).$.setupState.openHistory();
    await flushPromises();
    expect(document.body.textContent).toContain('Список протоколов не загружен');
    w.unmount();
  });
});
