import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PtsSitesDialog from '~/components/PtsSitesDialog.vue';
import { useAuthStore } from '~/stores/authStore';
import { mountWithVuetify, findButton, flushPromises, createTestPinia } from './mountHelper';

const pts = vi.hoisted(() => ({
  sites: vi.fn(), fields: vi.fn(), site: vi.fn(), lookup: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  pipes: vi.fn(), previewPipes: vi.fn(), applyPipes: vi.fn(), chain: vi.fn(),
}));
vi.mock('~/services/ptsService', async (orig) => ({
  ...(await orig<typeof import('~/services/ptsService')>()),
  ptsService: pts,
}));

const site = (id: number, pipes: number) => ({
  id, name: `Участок ${id}`, ue_id: null, ue_name: null, nach_id: 1, nach_name: 'Начальник 1',
  magistral_id: null, magistral_name: 'М-1', pipes, length: pipes * 10,
});
const card = (over: Record<string, unknown> = {}) => ({
  kind: 'ms', id: 3, title: 'МС 3', version: 'v1', values: { name: 'Участок 3', note: 'старое' },
  stats: { pipes: 4, length: 40, fragment_ids: [74] }, ...over,
});

async function openAndSelect() {
  const pinia = createTestPinia();
  const auth = useAuthStore();
  auth.authDisabled = true;
  auth.mutationsEnabledServer = true;
  const w = mountWithVuetify(PtsSitesDialog, { pinia });
  (w.vm as any).openDialog();
  await flushPromises();
  const item = w.findAll('.v-list-item').find((i) => i.text().includes('МС 3 — Участок 3'));
  await item!.trigger('click');
  await flushPromises();
  return w;
}

describe('PtsSitesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pts.sites.mockResolvedValue({ items: [site(3, 4), site(5, 0)] });
    pts.fields.mockResolvedValue({ fields: [
      { name: 'name', label: 'Наименование', kind: 'str', max_length: 100, group: null, ref: null },
      { name: 'note', label: 'Примечание', kind: 'str', max_length: 200, group: null, ref: null },
    ] });
    pts.site.mockResolvedValue(card());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('список участков МС по начальникам и открытие карточки', async () => {
    const w = await openAndSelect();
    expect(pts.sites).toHaveBeenCalledWith('ms');
    expect(w.text()).toContain('Начальник 1');
    expect(pts.site).toHaveBeenCalledWith('ms', 3);
    expect(w.text()).toContain('Труб: 4');
    w.unmount();
  });

  it('сохранение отправляет только изменённые поля и версию карточки', async () => {
    pts.update.mockResolvedValue({ site: card({ version: 'v2', values: { name: 'Участок 3', note: 'новое' } }) });
    const w = await openAndSelect();
    (w.vm as any).$.setupState.form.note = 'новое';
    await flushPromises();
    await findButton(w, 'Сохранить').trigger('click');
    await flushPromises();
    expect(pts.update).toHaveBeenCalledWith('ms', 3, { note: 'новое' }, 'v1');
    w.unmount();
  });

  it('снять все трубы: предпросмотр → применение с ожидаемым числом изменений', async () => {
    pts.previewPipes.mockResolvedValue({ objects: 4, changes: 4, missing_ids: [], warnings: [] });
    pts.applyPipes.mockResolvedValue({ objects: 4, changes: 4, missing_ids: [], warnings: [], changed: 4, change_group_id: 'g-7', applied: {} });
    const w = await openAndSelect();
    await (w.vm as any).$.setupState.runPreview({ action: 'unassign', all_pipes: true });
    await flushPromises();
    expect(pts.previewPipes).toHaveBeenCalledWith('ms', 3, { action: 'unassign', all_pipes: true });
    await findButton(w, 'Применить').trigger('click');
    await flushPromises();
    expect(pts.applyPipes).toHaveBeenCalledWith('ms', 3, { action: 'unassign', all_pipes: true }, 4);
    w.unmount();
  });

  it('удаление участка с трубами — после confirm и с отвязкой труб', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    pts.remove.mockResolvedValue({});
    const w = await openAndSelect();
    await (w.vm as any).$.setupState.removeSite();
    await flushPromises();
    expect(pts.remove).toHaveBeenCalledWith('ms', 3, true);
    expect(pts.sites).toHaveBeenCalledTimes(2);
    w.unmount();
  });
});
