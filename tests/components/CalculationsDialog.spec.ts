import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalculationsDialog from '~/components/CalculationsDialog.vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { mountWithVuetify, findButton, flushPromises, createTestPinia } from './mountHelper';

const api = vi.hoisted(() => ({
  listCalculations: vi.fn(),
  deleteCalculation: vi.fn(),
  getAuthConfig: vi.fn(),
  getFragments: vi.fn(),
}));
vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: api,
}));

const calc = (id: number, over: Record<string, unknown> = {}) => ({
  id, calculated_at: '2026-09-01T10:00:00', fileid: 74, fragment_name: 'Фрагмент 74', mode: 'plan',
  tn: -20, name: `Расчёт ${id}`, user_gid: 'dev', params: {}, is_latest: false, ...over,
});

async function openDialog(config: { auth_disabled: boolean; mutations_enabled: boolean }) {
  api.getAuthConfig.mockResolvedValue({ ...config, topology_mutations_enabled: false });
  const pinia = createTestPinia();
  useFragmentStore().fragments = [{ id: 74, name: 'Фрагмент 74' }] as any;
  const w = mountWithVuetify(CalculationsDialog, { pinia, props: { modelValue: false } });
  await w.setProps({ modelValue: true });
  await flushPromises();
  return w;
}

describe('CalculationsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listCalculations.mockResolvedValue({ items: [calc(7, { is_latest: true }), calc(6)], total: 2 });
  });

  it('при открытии грузит первую страницу списка расчётов', async () => {
    const w = await openDialog({ auth_disabled: true, mutations_enabled: true });
    expect(api.listCalculations).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, offset: 0, file_id: null }));
    expect(w.text()).toContain('Расчёт 7');
    expect(w.text()).toContain('Расчёт 6');
    w.unmount();
  });

  it('при открытии список запрашивается один раз (watch + update:options таблицы)', async () => {
    const w = await openDialog({ auth_disabled: true, mutations_enabled: true });
    expect(api.listCalculations).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('удаление: подтверждение → DELETE → событие deleted и перезагрузка списка', async () => {
    api.deleteCalculation.mockResolvedValue({ deleted_rows: { ut_out: 10, us_out: 5 } });
    const w = await openDialog({ auth_disabled: true, mutations_enabled: true });
    const del = w.findAll('button').filter((b) => b.attributes('title') === 'Удалить расчёт и его результаты');
    expect(del).toHaveLength(2);
    const loadsBefore = api.listCalculations.mock.calls.length;
    await del[0].trigger('click');
    expect(w.text()).toContain('Удалить расчёт #7?');
    expect(w.text()).toContain('Это текущий расчёт фрагмента');
    await findButton(w, /^Удалить$/).trigger('click');
    await flushPromises();
    expect(api.deleteCalculation).toHaveBeenCalledWith(7);
    expect(w.emitted('deleted')).toEqual([[7]]);
    expect(api.listCalculations).toHaveBeenCalledTimes(loadsBefore + 1);
    w.unmount();
  });

  it('без MUTATIONS_ENABLED кнопок удаления нет и выводится подсказка', async () => {
    const w = await openDialog({ auth_disabled: true, mutations_enabled: false });
    expect(w.findAll('button').some((b) => b.attributes('title')?.startsWith('Удал'))).toBe(false);
    expect(w.text()).toContain('MUTATIONS_ENABLED=true');
    w.unmount();
  });
});
