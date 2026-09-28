import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegimeAnalysisDialog from '~/components/RegimeAnalysisDialog.vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { mountWithVuetify, findButton, flushPromises, createTestPinia } from './mountHelper';

const api = vi.hoisted(() => ({
  getRegimeAnalysis: vi.fn(),
  getAdmissibility: vi.fn(),
  getAdmissibilityCatalog: vi.fn(),
}));
vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: api,
}));

async function openFor(fragment: number) {
  const pinia = createTestPinia();
  const fragments = useFragmentStore();
  fragments.fragments = [{ id: fragment, name: 'Фрагмент 74' }] as any;
  fragments.selectedFragmentId = fragment;
  const w = mountWithVuetify(RegimeAnalysisDialog, { pinia });
  await (w.vm as any).openDialog();
  await flushPromises();
  return w;
}

describe('RegimeAnalysisDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdmissibilityCatalog.mockResolvedValue([{ id: 3, title: 'Режим ЦТП' }]);
  });

  it('открывается на выбранном фрагменте и выполняет запрос «Отрицательные перепады»', async () => {
    api.getRegimeAnalysis.mockResolvedValue({
      query: 'negative_dp', title: 'Отрицательные перепады', fragment_id: 74, calculation_id: 5, count: 2,
      items: [
        { code: 'У1', name: 'Узел 1', pih_supply: 40, pih_return: 45.5, dp: -5.5, latitude: 43.2, longitude: 76.9 },
        { code: 'У2', name: 'Узел 2', pih_supply: 30, pih_return: 31, dp: -1, latitude: null, longitude: null },
      ],
    });
    const w = await openFor(74);
    expect(api.getAdmissibilityCatalog).toHaveBeenCalledTimes(1);
    await findButton(w, 'Выполнить').trigger('click');
    await flushPromises();
    expect(api.getRegimeAnalysis).toHaveBeenCalledWith('negative-dp', 74, { includeUncalculated: undefined });
    expect(w.text()).toContain('Расчёт №5');
    const rows = w.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('-5,5');
    // строка с координатами — показать на карте; без координат — ничего
    await rows[0].trigger('click');
    await rows[1].trigger('click');
    expect(w.emitted('locate')).toEqual([[{ lat: 43.2, lng: 76.9 }]]);
    w.unmount();
  });

  it('анализ режима из каталога: колонки с сервера, фильтр по оценке режима', async () => {
    api.getAdmissibility.mockResolvedValue({
      query: 'admissibility', title: 'Режим ЦТП', fragment_id: 74, count: 3,
      columns: ['Узел', 'Режим', '_hidden'], mode_column: 'Режим', summary: { норма: 2, авария: 1 },
      items: [
        { 'Узел': 'A', 'Режим': 'норма', _hidden: 1 },
        { 'Узел': 'B', 'Режим': 'авария', _hidden: 1 },
        { 'Узел': 'C', 'Режим': 'норма', _hidden: 1 },
      ],
    });
    const w = await openFor(74);
    (w.vm as any).$.setupState.queryKey = 'adm-3';
    await findButton(w, 'Выполнить').trigger('click');
    await flushPromises();
    expect(api.getAdmissibility).toHaveBeenCalledWith(3, 74);
    expect(w.findAll('thead th').map((th) => th.text())).not.toContain('_hidden');
    expect(w.findAll('tbody tr')).toHaveLength(3);
    const chip = w.findAll('.v-chip').find((c) => c.text().includes('авария'));
    await chip!.trigger('click');
    expect(w.findAll('tbody tr')).toHaveLength(1);
    w.unmount();
  });

  it('ошибка API показывается текстом detail', async () => {
    api.getRegimeAnalysis.mockRejectedValue({ data: { detail: 'Нет расчёта для фрагмента 74' } });
    const w = await openFor(74);
    await findButton(w, 'Выполнить').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Нет расчёта для фрагмента 74');
    w.unmount();
  });
});
