import { confirmAction } from '~/composables/useConfirm';
/**
 * Создание/правка/удаление карточки журнала через /api/v1/journals/{journal}.
 * Отправляются только поля, которые сервер объявил записываемыми (schema.fields),
 * ошибки 422/409 превращаются в понятный текст с подписями полей.
 */
import { ref } from 'vue';
import { journalWriteService, type JournalKey, type JournalSchema, type RecordWriteBody } from '~/services/journalWriteService';
import { useNotificationStore } from '~/stores/notificationStore';
import { formatJournalError, missingRequired, writableChanges, writableValues } from '~/utils/journalWrite';

export interface SaveOptions {
  isNew: boolean
  id?: number | null
  original?: Record<string, unknown> | null
  edited: Record<string, unknown>
  /** Режим создания (plan / current / unplanned) */
  mode?: string
  extra?: Omit<RecordWriteBody, 'fields' | 'mode'>
}

export function useJournalRecordForm(journal: JournalKey) {
  const schema = ref<JournalSchema | null>(null);
  const notifications = useNotificationStore();

  const loadSchema = async (): Promise<JournalSchema | null> => {
    if (schema.value) return schema.value;
    try {
      schema.value = await journalWriteService.getSchema(journal);
    } catch (error: any) {
      notifications.showError(formatJournalError(error, null, 'Не удалось загрузить описание журнала'));
    }
    return schema.value;
  };

  const isWritable = (key?: string | null): boolean => !!key && !!schema.value?.fields[key];

  /** Возвращает id записи; при ошибке бросает Error с текстом для пользователя */
  const save = async (options: SaveOptions): Promise<number | null> => {
    const current = await loadSchema();
    if (!current) throw new Error('Описание журнала недоступно — запись невозможна');
    try {
      if (options.isNew) {
        const missing = missingRequired(current, options.edited);
        if (missing.length) throw new Error(`Заполните обязательные поля: ${missing.join(', ')}`);
        const result = await journalWriteService.create(journal, {
          ...(options.extra || {}),
          fields: writableValues(current, options.edited),
          mode: options.mode,
        });
        const warnings = result.warnings?.length ? ` (${result.warnings.join('; ')})` : '';
        notifications.showSuccess(`${current.title}: запись ${result.id} создана${warnings}`);
        return result.id;
      }
      if (!options.id) throw new Error('Не выбрана запись');
      const changes = writableChanges(current, options.original, options.edited);
      if (!Object.keys(changes).length && options.extra?.longitude === undefined) {
        notifications.showInfo('Изменений нет');
        return options.id;
      }
      await journalWriteService.update(journal, options.id, { ...(options.extra || {}), fields: changes });
      notifications.showSuccess(`${current.title}: изменения сохранены`);
      return options.id;
    } catch (error: any) {
      if (error instanceof Error && !(error as any).status && !(error as any).data) throw error;
      throw new Error(formatJournalError(error, current));
    }
  };

  /** Удаление с подтверждением; true — удалено */
  const remove = async (id: number, label: string): Promise<boolean> => {
    const current = await loadSchema();
    const extra = current?.has_contour ? ', его контур' : '';
    const text = `Удалить «${label}» (№ ${id})${extra} и документы? Действие необратимо.`;
    if (!(await confirmAction({ title: current?.title || 'Удаление записи', text, action: 'Удалить' }))) return false;
    try {
      await journalWriteService.remove(journal, id);
      notifications.showSuccess(`${current?.title || 'Журнал'}: запись ${id} удалена`);
      return true;
    } catch (error: any) {
      notifications.showError(formatJournalError(error, current, 'Не удалось удалить'));
      return false;
    }
  };

  /** Ошибка формы — уведомлением, чтобы не скрывать заполненную форму */
  const showError = (message: string) => notifications.showError(message);

  return { schema, loadSchema, isWritable, save, remove, showError };
}
