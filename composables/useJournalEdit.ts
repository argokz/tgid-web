import { computed, ref, watch, type Ref } from 'vue';
import { confirmAction } from '~/composables/useConfirm';
import { useJournalDraft } from '~/composables/useJournalDraft';
import { useNotificationStore } from '~/stores/notificationStore';
import { hasChanges, recordSnapshot } from '~/utils/journalDraft';
import { withDateInputs } from '~/utils/journalFields';

/**
 * Откуда известно, какие поля записываемые: `useJournalRecordForm` (схема с сервера) или реестр
 * (таблица колонок, например `CORROSION_COLUMN_BY_KEY`). `loadSchema` вызывается перед созданием.
 */
export interface JournalEditSource {
  schema: Ref<{ fields: Record<string, unknown> } | null>;
  isWritable: (key?: string | null) => boolean;
  loadSchema: () => Promise<unknown>;
}

export interface JournalEditOptions {
  /** Ключи timestamp-полей, которые в форме показываются как `type="date"` */
  dateKeys?: readonly string[];
  /** Сколько держать подсветку сохранённой строки, мс */
  flashMs?: number;
}

const FLASH_MS = 2500;

/**
 * Состояние правки записи журнала — общее для всех журналов (docs/ui-modernization-progress.md, этап 5):
 * создание / правка, признак «изменено» по записываемым полям схемы, локальный черновик (`useJournalDraft`),
 * отмена с подтверждением, подсветка сохранённой строки. Сетевые вызовы (сохранить / удалить) остаются
 * у `useJournalRecordForm` и самого журнала — здесь только состояние формы.
 */
export function useJournalEdit(
  journal: string,
  recordForm: JournalEditSource,
  selected: Ref<Record<string, any> | null>,
  options: JournalEditOptions = {},
) {
  const notifications = useNotificationStore();
  const draft = useJournalDraft(journal);

  const isEditing = ref(false);
  const isNew = ref(false);
  const saving = ref(false);
  const editFields = ref<Record<string, any>>({});
  /** Исходная запись на момент начала правки — для признака «изменено» и снимка черновика */
  const editOriginal = ref<Record<string, unknown> | null>(null);
  const flashId = ref<number | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  const writableKeys = computed(() => Object.keys(recordForm.schema.value?.fields ?? {}));
  const draftId = computed<number | 'new'>(() => (isNew.value ? 'new' : (selected.value?.id ?? 'new')));
  const draftSnapshot = computed(() => recordSnapshot(isNew.value ? null : editOriginal.value, writableKeys.value));
  const isDirty = computed(() => isEditing.value && hasChanges(editFields.value, isNew.value ? null : editOriginal.value, writableKeys.value));
  const isFieldDirty = (key?: string | null) => Boolean(key) && isEditing.value
    && hasChanges(editFields.value, isNew.value ? null : editOriginal.value, [key!]);

  /** Поле правится: режим правки, ключ известен и объявлен сервером записываемым */
  const editable = (key?: string | null) => isEditing.value && Boolean(key) && recordForm.isWritable(key);

  /** Черновик той же записи с того же снимка — предложить вернуть */
  const offerDraft = () => {
    const saved = draft.take(draftId.value, draftSnapshot.value);
    if (!saved) return;
    notifications.notify('info', 'Есть несохранённый черновик этой записи', {
      label: 'Восстановить',
      handler: () => { editFields.value = { ...editFields.value, ...saved.fields }; },
    });
  };

  watch(editFields, (fields) => {
    if (isEditing.value && isDirty.value) draft.schedule(draftId.value, draftSnapshot.value, fields);
  }, { deep: true });

  /** Начать создание: начальные поля (дата по умолчанию, трубопровод из области) */
  const beginCreate = async (initial: Record<string, unknown>) => {
    await recordForm.loadSchema();
    isNew.value = true;
    isEditing.value = true;
    editFields.value = { ...initial };
    editOriginal.value = null;
    offerDraft();
  };

  /** Начать правку выбранной записи */
  const beginEdit = () => {
    if (!selected.value) return;
    isNew.value = false;
    isEditing.value = true;
    editFields.value = withDateInputs({ ...selected.value }, [...(options.dateKeys ?? [])]);
    editOriginal.value = { ...editFields.value };
    offerDraft();
  };

  /** Отмена: при изменениях — подтверждение; черновик удаляется. true — правка закрыта */
  const cancel = async (): Promise<boolean> => {
    if (isDirty.value) {
      const ok = await confirmAction({
        title: 'Отменить правки?',
        text: 'Несохранённые изменения будут отброшены. В базу ничего не записано.',
        action: 'Отменить правки',
        cancel: 'Продолжить правку',
      });
      if (!ok) return false;
    }
    draft.clear(draftId.value);
    isEditing.value = false;
    return true;
  };

  /** Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия */
  const closeKeepingDraft = () => {
    if (!isEditing.value) return;
    draft.flush();
    isEditing.value = false;
  };

  /** После успешного сохранения: черновик удалён, строка подсвечена */
  const markSaved = (id: number | null) => {
    draft.clear(draftId.value);
    isEditing.value = false;
    isNew.value = false;
    if (id == null) return;
    flashId.value = id;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashId.value = null; }, options.flashMs ?? FLASH_MS);
  };

  const forgetDraft = (id: number) => draft.clear(id);

  return {
    isEditing,
    isNew,
    saving,
    editFields,
    editOriginal,
    flashId,
    isDirty,
    isFieldDirty,
    editable,
    writableKeys,
    beginCreate,
    beginEdit,
    cancel,
    closeKeepingDraft,
    markSaved,
    forgetDraft,
  };
}
