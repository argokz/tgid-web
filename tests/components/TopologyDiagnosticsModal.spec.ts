import { describe, it, expect, vi, beforeEach } from 'vitest';
import TopologyDiagnosticsModal from '~/components/TopologyDiagnosticsModal.vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { mountWithVuetify, flushPromises, createTestPinia } from './mountHelper';

const api = vi.hoisted(() => ({ getTopologyDiagnostics: vi.fn() }));
vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: api,
}));

const response = {
  fragment_id: 72, fragment_name: 'ЗЭР', nodes: 5331, lines: 5242, total: 3, limit: 200, truncated: false,
  counts: { orphaned_node: 2, duplicate_line: 1, dangling_line: 0 },
  types: { orphaned_node: 'Узел без участков' },
  faults: [
    { type: 'orphaned_node', object_type: 'node', object_id: 525506, description: 'Нет участков и связей', lat: 43.2, lng: 76.8 },
    { type: 'orphaned_node', object_type: 'node', object_id: 525507, description: 'Нет участков и связей', lat: null, lng: null },
    { type: 'duplicate_line', object_type: 'line', object_id: 9001, description: 'Повтор участка 9000', lat: 43.3, lng: 76.9 },
  ],
};

async function open(selected: number | null, visible: number[] = []) {
  const pinia = createTestPinia();
  const fragments = useFragmentStore();
  fragments.fragments = [{ id: 72, name: 'ЗЭР' }, { id: 5, name: 'Юг' }] as any;
  fragments.selectedFragmentId = selected;
  fragments.visibleFragments = visible;
  const w = mountWithVuetify(TopologyDiagnosticsModal, { pinia });
  (w.vm as any).openDialog();
  await flushPromises();
  return w;
}

describe('TopologyDiagnosticsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTopologyDiagnostics.mockResolvedValue(response);
  });

  it('фрагмент по умолчанию — единственный видимый; плитки — полные числа, плитка типа — фильтр', async () => {
    const w = await open(null, [72]);
    expect(api.getTopologyDiagnostics).toHaveBeenCalledWith(72, 200);
    const tiles = w.findAll('.topo-tiles > *');
    // нулевой тип не показан: Проблем, Узлов, Участков + 2 типа
    expect(tiles).toHaveLength(5);
    expect(tiles[1].text().replace(/\s+/g, ' ')).toContain('5 331');
    expect(w.findAll('tbody tr')).toHaveLength(3);
    await tiles[4].trigger('click');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Участок №9001');
    await rows[0].trigger('click');
    expect(w.emitted('locate-fault')?.[0]?.[0]).toMatchObject({ object_id: 9001 });
    w.unmount();
  });

  it('строка без координат не уводит карту; без фрагмента — просьба выбрать, запроса нет', async () => {
    const w = await open(72);
    const noCoords = w.findAll('tbody tr').find((r) => r.text().includes('525507'))!;
    await noCoords.trigger('click');
    expect(w.emitted('locate-fault')).toBeUndefined();
    w.unmount();

    vi.clearAllMocks();
    const w2 = await open(null, [72, 5]);
    expect(api.getTopologyDiagnostics).not.toHaveBeenCalled();
    expect(w2.text()).toContain('Выберите фрагмент');
    w2.unmount();
  });

  it('ошибка запроса не выглядит как «ошибок не найдено»', async () => {
    api.getTopologyDiagnostics.mockRejectedValue(new Error('timeout'));
    const w = await open(72);
    expect(w.text()).toContain('Не удалось выполнить диагностику');
    expect(w.text()).not.toContain('Ошибок топологии не найдено');
    w.unmount();
  });
});
