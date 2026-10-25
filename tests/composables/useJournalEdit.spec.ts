import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, ref, type Ref } from 'vue';
import { useJournalEdit, type JournalEditSource } from '~/composables/useJournalEdit';
import { useNotificationStore } from '~/stores/notificationStore';
import { journalDraftKey, loadDraft } from '~/utils/journalDraft';
import { appStorage } from '~/utils/appStorage';

vi.mock('~/composables/useConfirm', () => ({ confirmAction: vi.fn(async () => true) }));
import { confirmAction } from '~/composables/useConfirm';

type Edit = ReturnType<typeof useJournalEdit>;

/** Композабл использует хуки жизненного цикла и сторы — поднимаем его внутри компонента-носителя */
const mountEdit = (source: JournalEditSource, selected: Ref<Record<string, any> | null>) => {
  const pinia = createPinia();
  setActivePinia(pinia);
  let edit!: Edit;
  const wrapper = mount(defineComponent({
    setup() {
      edit = useJournalEdit('defects', source, selected);
      return () => h('div');
    },
  }), { global: { plugins: [pinia] } });
  return { edit, wrapper };
};

const schemaSource = (fields: string[], loadable = true): JournalEditSource => {
  const schema = ref<{ fields: Record<string, unknown> } | null>(null);
  return {
    schema,
    isWritable: (key) => Boolean(key && fields.includes(key)),
    loadSchema: async () => {
      if (!loadable) return null;
      schema.value = { fields: Object.fromEntries(fields.map((f) => [f, {}])) };
      return schema.value;
    },
  };
};

const NEW_KEY = journalDraftKey('', 'defects', 'new');

describe('useJournalEdit', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.mocked(confirmAction).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('создание: начальные значения — не правка; отмена закрывает создание без вопроса', async () => {
    const { edit } = mountEdit(schemaSource(['name', 'state_id']), ref(null));
    expect(await edit.beginCreate({ name: 'Контур', state_id: 1 })).toBe(true);
    expect(edit.isNew.value).toBe(true);
    expect(edit.isDirty.value).toBe(false);
    expect(edit.editable('name')).toBe(true);
    expect(edit.editable('id')).toBe(false);

    const result = await edit.cancel();
    expect(result).toEqual({ closed: true, wasNew: true });
    expect(confirmAction).not.toHaveBeenCalled();
    expect(edit.isNew.value).toBe(false);
    expect(edit.isEditing.value).toBe(false);
  });

  it('схема не загрузилась — форма не открывается', async () => {
    const { edit } = mountEdit(schemaSource(['name'], false), ref({ id: 5, name: 'a' }));
    expect(await edit.beginCreate({})).toBe(false);
    expect(await edit.beginEdit()).toBe(false);
    expect(edit.isEditing.value).toBe(false);
  });

  it('правка: черновик пишется с задержкой только из записываемых полей, откат его стирает', async () => {
    const selected = ref<Record<string, any> | null>({ id: 7, name: 'ТК-1', state_id: 1, address: 'Абая 1' });
    const { edit } = mountEdit(schemaSource(['name', 'state_id']), selected);
    expect(await edit.beginEdit()).toBe(true);
    expect(edit.isDirty.value).toBe(false);

    edit.setEditField('name', 'ТК-2');
    await vi.advanceTimersByTimeAsync(0);
    expect(edit.isDirty.value).toBe(true);
    expect(edit.isFieldDirty('name')).toBe(true);
    expect(edit.isFieldDirty('state_id')).toBe(false);
    const key = journalDraftKey('', 'defects', 7);
    expect(loadDraft(appStorage, key)).toBeNull(); // ещё не записан — ждём паузу
    await vi.advanceTimersByTimeAsync(400);
    expect(loadDraft(appStorage, key)?.fields).toEqual({ name: 'ТК-2', state_id: 1 }); // без address и id

    edit.setEditField('name', 'ТК-1');
    await vi.advanceTimersByTimeAsync(400);
    expect(edit.isDirty.value).toBe(false);
    expect(loadDraft(appStorage, key)).toBeNull();
  });

  it('отмена с изменениями спрашивает; отказ оставляет правку', async () => {
    const { edit } = mountEdit(schemaSource(['name']), ref({ id: 1, name: 'a' }));
    await edit.beginEdit();
    edit.setEditField('name', 'b');
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    expect(await edit.cancel()).toEqual({ closed: false, wasNew: false });
    expect(edit.isEditing.value).toBe(true);
    expect(await edit.cancel()).toEqual({ closed: true, wasNew: false });
    expect(edit.isEditing.value).toBe(false);
    expect(loadDraft(appStorage, journalDraftKey('', 'defects', 1))).toBeNull();
  });

  it('закрытие крестиком хранит черновик; при повторном открытии предлагает восстановить только в той же правке', async () => {
    const selected = ref<Record<string, any> | null>({ id: 3, name: 'a', note: null });
    const { edit } = mountEdit(schemaSource(['name', 'note']), selected);
    const notifications = useNotificationStore();
    const notify = vi.spyOn(notifications, 'notify');

    await edit.beginEdit();
    edit.setEditField('note', 'черновик');
    await vi.advanceTimersByTimeAsync(0);
    edit.closeKeepingDraft(); // записывает отложенное сразу
    expect(edit.isEditing.value).toBe(false);
    expect(loadDraft(appStorage, journalDraftKey('', 'defects', 3))?.fields.note).toBe('черновик');

    await edit.beginEdit();
    expect(notify).toHaveBeenCalledTimes(1);
    const [, , action] = notify.mock.calls[0];
    expect(action?.label).toBe('Восстановить');

    // уведомление пережило форму: вне правки восстановление ничего не меняет
    edit.closeKeepingDraft();
    await action!.handler();
    expect(edit.editFields.value.note).toBe(null);

    // в той же правке — применяет черновик
    await edit.beginEdit();
    expect(notify).toHaveBeenCalledTimes(2);
    await notify.mock.calls[1][2]!.handler();
    expect(edit.editFields.value.note).toBe('черновик');
  });

  it('черновик с другого снимка записи считается устаревшим и удаляется с предупреждением', async () => {
    const selected = ref<Record<string, any> | null>({ id: 9, name: 'a' });
    const { edit } = mountEdit(schemaSource(['name']), selected);
    const notifications = useNotificationStore();
    const warn = vi.spyOn(notifications, 'showWarning');
    await edit.beginEdit();
    edit.setEditField('name', 'b');
    await vi.advanceTimersByTimeAsync(0);
    edit.closeKeepingDraft();

    selected.value = { id: 9, name: 'изменено на сервере' };
    await edit.beginEdit();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(loadDraft(appStorage, journalDraftKey('', 'defects', 9))).toBeNull();
  });

  it('сохранено: черновик удалён, строка подсвечена и гаснет', async () => {
    const { edit } = mountEdit(schemaSource(['name']), ref(null));
    await edit.beginCreate({ name: '' });
    edit.setEditField('name', 'x');
    await vi.advanceTimersByTimeAsync(400);
    expect(loadDraft(appStorage, NEW_KEY)).not.toBeNull();
    edit.markSaved(42);
    expect(loadDraft(appStorage, NEW_KEY)).toBeNull();
    expect(edit.flashId.value).toBe(42);
    expect(edit.isNew.value).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    expect(edit.flashId.value).toBeNull();
  });
});
