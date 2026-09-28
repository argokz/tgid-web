import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import GroupSetterDialog from '~/components/GroupSetterDialog.vue';
import { useAuthStore } from '~/stores/authStore';
import { useFragmentStore } from '~/stores/fragmentStore';
import type { GroupSetterInfo } from '~/services/groupSettersService';
import { mountWithVuetify, findButton, flushPromises, createTestPinia } from './mountHelper';

const svc = vi.hoisted(() => ({ list: vi.fn(), preview: vi.fn(), apply: vi.fn(), undo: vi.fn() }));
vi.mock('~/services/groupSettersService', async (orig) => ({
  ...(await orig<typeof import('~/services/groupSettersService')>()),
  groupSettersService: svc,
}));

const roughness: GroupSetterInfo = {
  key: 'roughness', label: 'Шероховатость', group: 'Участки', target: 'line' as any, target_label: 'участки',
  kind: 'float' as any, field_label: 'Kэ, мм', default: 0.5, min: 0, max: 10, choices: [], ref: null,
  writes: ['heatpipesections.roughness'], desktop: 'Установщик шероховатости',
} as unknown as GroupSetterInfo;

const previewResult = { setter: 'roughness', label: 'Шероховатость', value: 0.5, value_label: null,
  selection: {}, objects: 12, missing_ids: [], changes: 9, by_table: { heatpipesections: { rows: 12, changes: 9 } }, warnings: [] };

async function openDialog() {
  const pinia = createTestPinia();
  const auth = useAuthStore();
  auth.authDisabled = true; // dev admin
  auth.mutationsEnabledServer = true;
  const fragments = useFragmentStore();
  fragments.fragments = [{ id: 74, name: 'Фрагмент 74' }] as any;
  fragments.visibleFragments = [74];
  const w = mountWithVuetify(GroupSetterDialog, { pinia });
  (w.vm as any).openDialog();
  await flushPromises();
  (w.vm as any).$.setupState.setterKey = 'roughness';
  await flushPromises();
  return w;
}

describe('GroupSetterDialog: предпросмотр → применение', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.list.mockResolvedValue({ setters: [roughness], targets: { line: { label: 'участки', filter_fields: [] } }, max_objects: 5000 });
    svc.preview.mockResolvedValue(previewResult);
    svc.apply.mockResolvedValue({ ...previewResult, applied: { heatpipesections: 9 }, changed: 9, change_group_id: 'g-1' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('«Применить» недоступно до предпросмотра; превью идёт по видимому фрагменту', async () => {
    const w = await openDialog();
    expect(svc.list).toHaveBeenCalledTimes(1);
    expect(findButton(w, 'Применить').attributes('disabled')).toBeDefined();
    await findButton(w, 'Предпросмотр').trigger('click');
    await flushPromises();
    expect(svc.preview).toHaveBeenCalledWith('roughness', { mode: 'fragment', fragment_ids: [74] }, 0.5);
    expect(findButton(w, 'Применить').attributes('disabled')).toBeUndefined();
    w.unmount();
  });

  it('применение после подтверждения передаёт ожидаемое число изменений', async () => {
    const confirm = vi.fn((_text: string) => true);
    vi.stubGlobal('confirm', confirm);
    const w = await openDialog();
    await findButton(w, 'Предпросмотр').trigger('click');
    await flushPromises();
    await findButton(w, 'Применить').trigger('click');
    await flushPromises();
    expect(confirm.mock.calls[0][0]).toContain('Будет изменено строк: 9');
    expect(svc.apply).toHaveBeenCalledWith('roughness', { mode: 'fragment', fragment_ids: [74] }, 0.5, 9);
    // превью израсходовано — повторно применить нельзя
    expect(findButton(w, 'Применить').attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('отказ в confirm не вызывает apply; смена значения делает превью устаревшим', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const w = await openDialog();
    await findButton(w, 'Предпросмотр').trigger('click');
    await flushPromises();
    await findButton(w, 'Применить').trigger('click');
    await flushPromises();
    expect(svc.apply).not.toHaveBeenCalled();
    (w.vm as any).$.setupState.value = 0.7;
    await nextTick();
    expect(findButton(w, 'Применить').attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('неверное значение не уходит на сервер', async () => {
    const w = await openDialog();
    (w.vm as any).$.setupState.value = 99;
    await findButton(w, 'Предпросмотр').trigger('click');
    await flushPromises();
    expect(svc.preview).not.toHaveBeenCalled();
    expect(w.text()).toContain('Не больше 10');
    w.unmount();
  });
});
