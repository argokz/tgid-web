import { describe, it, expect, vi, beforeEach } from 'vitest';
import PassportDialog from '~/components/PassportDialog.vue';
import { useFragmentStore } from '~/stores/fragmentStore';
import { mountWithVuetify, flushPromises, createTestPinia } from './mountHelper';

const api = vi.hoisted(() => ({
  getPassportHierarchy: vi.fn(),
  getPassportDiagnostics: vi.fn(),
  downloadPassport: vi.fn(),
  downloadChiefPassports: vi.fn(),
}));
vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: api,
}));

const hierarchy = [
  { id: 'root_ms', name: 'Магистральные сети (по начальникам)', children: [] },
  {
    id: 'root_rs',
    name: 'Распределительные сети (по начальникам)',
    children: [
      { id: 'nach_rs_2', nach_id: 2, name: 'Афризонов Р.И.', children: [
        { id: 'rs_227', name: 'РС 227', ms_rs: 'rs', site_id: 227, is_leaf: true },
      ] },
      { id: 'nach_rs_0', nach_id: 0, name: 'Неизвестный начальник', children: [] },
    ],
  },
];

describe('PassportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    api.getPassportHierarchy.mockResolvedValue(hierarchy);
    api.getPassportDiagnostics.mockResolvedValue({ ready_for_passport: true, blockers: [], counts: {} });
    api.downloadPassport.mockResolvedValue({ blob: new Blob(['x']), filename: 'Passport_rs_227.xlsx' });
    api.downloadChiefPassports.mockResolvedValue({ blob: new Blob(['PK']), filename: 'Паспорта.zip' });
  });

  it('архив начальника — по ветке РС и фрагментам карты; у участков без начальника кнопки нет', async () => {
    const pinia = createTestPinia();
    useFragmentStore().visibleFragments = [2, 3179];
    const w = mountWithVuetify(PassportDialog, { pinia, attachTo: document.body });
    (w.vm as any).openDialog();
    await flushPromises();
    const root = () => document.body.querySelectorAll<HTMLElement>('.v-list-item');
    [...root()].find((el) => el.textContent?.includes('Распределительные сети'))!.click();
    await flushPromises();

    const zipButtons = document.body.querySelectorAll<HTMLElement>('[aria-label^="Паспорта всех участков РС начальника"]');
    expect(zipButtons).toHaveLength(1);
    expect(document.body.textContent).toContain('по фрагментам, включённым на карте (2)');
    zipButtons[0].click();
    await flushPromises();
    expect(api.downloadChiefPassports).toHaveBeenCalledWith(2, ['rs'], expect.objectContaining({ fragments: [2, 3179] }));

    [...root()].find((el) => el.textContent?.includes('Афризонов'))!.click();
    await flushPromises();
    [...root()].find((el) => el.textContent?.includes('РС 227'))!.click();
    await flushPromises();
    expect(api.downloadPassport).toHaveBeenCalledWith('rs', 227, expect.objectContaining({ fragments: [2, 3179] }));
    w.unmount();
  });
});
