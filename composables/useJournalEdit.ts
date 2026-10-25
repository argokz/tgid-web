import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { confirmAction } from '~/composables/useConfirm';
import { useJournalDraft } from '~/composables/useJournalDraft';
import { useNotificationStore } from '~/stores/notificationStore';
import { hasChanges, recordSnapshot } from '~/utils/journalDraft';
import { withDateInputs } from '~/utils/journalFields';

/**
 * Откуда известно, какие поля записываемые: `useJournalRecordForm` (схема с сервера) или реестр
 * (таблица колонок, например `CORROSION_COLUMN_BY_KEY`). `loadSchema` вызывается перед созданием и правкой;
 * ложный результат — схемы нет, форма не открывается (ошибку показывает сам источник).
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
  /**
   * Поля формы из записи, когда ключи формы — не ключи записи (оборудование: колонки таблицы `throtdiaphloc`
   * против ключей карточки `installation_place`). По умолчанию форма — копия записи.
   */
  toForm?: (record: Record<string, any>) => Record<string, unknown>;
}

/** Итог отмены: правка закрыта или оставлена; `wasNew` — закрыли создание (диалогу — закрыть карточку) */
export interface CancelResult {
  closed: boolean;
  wasNew: boolean;
}

const FLASH_MS = 2500;

const pick = (fields: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((k) => k in fields).map((k) => [k, fields[k]]));

/**
 * Состояние правки записи журнала — общее для всех журналов (docs/ui-modernization-progress.md, этап 5):
 * создание / правка, признак «изменено» по записываемым полям источника, локальный черновик
 * (`useJournalDraft`, только записываемые поля), отмена с подтверждением, закрытие с сохранением черновика,
 * подсветка сохранённой строки. Сетевые вызовы (сохранить / удалить) остаются у журнала.
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
  /** База сравнения: исходная запись при правке, начальные значения при создании */
  const editOriginal = ref<Record<string, unknown> | null>(null);
  /** Ключ черновика, зафиксированный при начале правки: смена `selected` его не сдвигает */
  const activeKey = ref<number | 'new'>('new');
  const flashId = ref<number | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  const writableKeys = computed(() => Object.keys(recordForm.schema.value?.fields ?? {}));
  /** Снимок исходной записи для черновика; у создаваемой — 'new' */
  const draftSnapshot = computed(() => recordSnapshot(isNew.value ? null : editOriginal.value, writableKeys.value));
  const isDirty = computed(() => isEditing.value && hasChanges(editFields.value, editOriginal.value, writableKeys.value));
  const isFieldDirty = (key?: string | null) => Boolean(key) && isEditing.value
    && hasChanges(editFields.value, editOriginal.value, [key!]);

  /** Поле правится: режим правки, ключ известен и объявлен источником записываемым */
  const editable = (key?: string | null) => isEditing.value && Boolean(key) && recordForm.isWritable(key);

  /** Значение поля из формы (JournalDetailFields → update:field) */
  const setEditField = (key: string, value: unknown) => {
    editFields.value = { ...editFields.value, [key]: value };
  };

  /** Черновик той же записи с того же снимка — предложить вернуть (только записываемые поля) */
  const offerDraft = () => {
    const key = activeKey.value;
    const snapshot = draftSnapshot.value;
    const { draft: saved, stale } = draft.take(key, snapshot);
    if (stale) notifications.showWarning('Запись изменилась на сервере — старый черновик не подходит и удалён');
    if (!saved) return;
    notifications.notify('info', 'Есть несохранённый черновик этой записи', {
      label: 'Восстановить',
      handler: () => {
        // уведомление общее и живёт дольше формы: применять только к той же записи в режиме правки
        if (!isEditing.value || activeKey.value !== key || draftSnapshot.value !== snapshot) return;
        editFields.value = { ...editFields.value, ...pick(saved.fields, writableKeys.value) };
      },
    });
  };

  /** Были ли изменения в этой правке: сброс к исходному стирает черновик, а само открытие формы — нет */
  let wasDirty = false;
  // JournalDetailFields заменяет объект целиком — глубокое наблюдение не нужно
  watch(editFields, (fields) => {
    if (!isEditing.value) return;
    if (isDirty.value) {
      wasDirty = true;
      draft.schedule(activeKey.value, draftSnapshot.value, pick(fields, writableKeys.value));
    } else if (wasDirty) {
      wasDirty = false;
      draft.clear(activeKey.value); // вернули к исходному — черновику нечего хранить
    }
  });

  /** Начать создание с начальными полями (дата по умолчанию, трубопровод из области); false — схемы нет */
  const beginCreate = async (initial: Record<string, unknown>): Promise<boolean> => {
    if (!(await recordForm.loadSchema())) return false;
    isNew.value = true;
    isEditing.value = true;
    activeKey.value = 'new';
    wasDirty = false;
    editFields.value = { ...initial };
    editOriginal.value = { ...initial };
    offerDraft();
    return true;
  };

  /** Начать правку выбранной записи; false — записи или схемы нет */
  const beginEdit = async (): Promise<boolean> => {
    const record = selected.value;
    if (!record || !(await recordForm.loadSchema())) return false;
    isNew.value = false;
    isEditing.value = true;
    activeKey.value = record.id;
    wasDirty = false;
    editFields.value = withDateInputs(options.toForm ? options.toForm(record) : { ...record }, [...(options.dateKeys ?? [])]);
    editOriginal.value = { ...editFields.value };
    offerDraft();
    return true;
  };

  const resetEdit = () => {
    isEditing.value = false;
    isNew.value = false;
  };

  /** Отмена: при изменениях — подтверждение; черновик удаляется */
  const cancel = async (): Promise<CancelResult> => {
    const wasNew = isNew.value;
    if (isDirty.value) {
      const ok = await confirmAction({
        title: 'Отменить правки?',
        text: 'Несохранённые изменения будут отброшены. В базу ничего не записано.',
        action: 'Отменить правки',
        cancel: 'Продолжить правку',
      });
      if (!ok) return { closed: false, wasNew };
    }
    draft.clear(activeKey.value);
    resetEdit();
    return { closed: true, wasNew };
  };

  /** Карточка закрыта крестиком или Esc во время правки — черновик остаётся до следующего открытия */
  const closeKeepingDraft = () => {
    if (!isEditing.value) return;
    if (isDirty.value && !draft.flush()) notifications.showWarning('Черновик не сохранён: хранилище браузера недоступно');
    resetEdit();
  };

  /** После успешного сохранения: черновик удалён, строка подсвечена */
  const markSaved = (id: number | null) => {
    draft.clear(activeKey.value);
    resetEdit();
    if (id == null) return;
    flashId.value = id;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashId.value = null; }, options.flashMs ?? FLASH_MS);
  };

  const forgetDraft = (id: number) => draft.clear(id);

  onBeforeUnmount(() => {
    if (flashTimer) clearTimeout(flashTimer);
  });

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
    setEditField,
    beginCreate,
    beginEdit,
    resetEdit,
    cancel,
    closeKeepingDraft,
    markSaved,
    forgetDraft,
  };
}
