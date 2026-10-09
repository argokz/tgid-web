import { describe, it, expect, vi, beforeEach } from 'vitest';
import PtsHighlightPanel from '~/components/PtsHighlightPanel.vue';
import { useLayerStore } from '~/stores/layerStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import { mountWithVuetify, findButton, flushPromises, createTestPinia } from './mountHelper';

const pts = vi.hoisted(() => ({ sites: vi.fn(), highlight: vi.fn() }));
vi.mock('~/services/ptsService', async (orig) => ({
  ...(await orig<typeof import('~/services/ptsService')>()),
  ptsService: pts,
}));

const site = (id: number, nach: number) => ({
  id, name: `Участок ${id}`, ue_id: null, ue_name: null, nach_id: nach, nach_name: `Начальник ${nach}`,
  magistral_id: null, magistral_name: null, pipes: 2, length: 20,
});

async function mount() {
  const pinia = createTestPinia();
  const layerStore = useLayerStore();
  const fragmentStore = useFragmentStore();
  fragmentStore.visibleFragments = [2, 3];
  // карты в тесте нет: обновление источников не нужно
  const applyFilter = vi.spyOn(layerStore, 'applyFragmentFilter').mockImplementation(() => {});
  const w = mountWithVuetify(PtsHighlightPanel, { pinia });
  await flushPromises();
  return { w, layerStore, fragmentStore, applyFilter };
}

describe('PtsHighlightPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pts.sites.mockImplementation(async (kind: string) => ({ items: kind === 'ms' ? [site(19, 2)] : [site(227, 2)] }));
    pts.highlight.mockResolvedValue({ kind: 'nach', id: 2, pipes: 5, fragment_ids: [6, 7], bbox: [71.4, 51.1, 71.5, 51.2] });
  });

  it('по умолчанию ничего не подсвечено; начальник подсвечивает все свои участки', async () => {
    const { w, layerStore, applyFilter } = await mount();
    expect(layerStore.ptsHighlight).toBeNull();
    expect(pts.sites).toHaveBeenCalledWith('ms');
    expect(pts.sites).toHaveBeenCalledWith('rs');
    expect(w.text()).toContain('МС 1 · РС 1');

    await w.findAll('.v-list-item').find((i) => i.text().includes('Начальник 2'))!.trigger('click');
    await flushPromises();
    expect(layerStore.ptsHighlight).toMatchObject({ kind: 'nach', id: 2 });
    expect(applyFilter).toHaveBeenCalled();
    expect(pts.highlight).toHaveBeenCalledWith('nach', 2);
    // трубы во фрагментах 6, 7, на карте 2 и 3 — предупреждение и подключение
    expect(w.text()).toContain('Трубы во фрагментах 6, 7');
    await findButton(w, 'Подключить')!.trigger('click');
    expect(useFragmentStore().visibleFragments).toEqual([2, 3, 6, 7]);

    await findButton(w, 'Снять')!.trigger('click');
    expect(layerStore.ptsHighlight).toBeNull();
    w.unmount();
  });

  it('участок РС из раскрытого начальника', async () => {
    const { w, layerStore } = await mount();
    await w.find('[aria-label="Показать участки"]').trigger('click');
    await w.findAll('.v-list-item').find((i) => i.text().includes('РС 227'))!.trigger('click');
    await flushPromises();
    expect(layerStore.ptsHighlight).toMatchObject({ kind: 'rs', id: 227, title: 'РС 227 — Участок 227' });
    expect(pts.highlight).toHaveBeenLastCalledWith('rs', 227);
    w.unmount();
  });
});
