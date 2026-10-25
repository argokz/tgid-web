import { onBeforeUnmount } from 'vue';
import { useAuthStore } from '~/stores/authStore';
import { appStorage } from '~/utils/appStorage';
import { clearDraft, draftKey, draftMatches, loadDraft, saveDraft, type JournalDraft } from '~/utils/journalDraft';

const SAVE_DELAY_MS = 400;

/**
 * Локальный черновик формы записи журнала (utils/journalDraft.ts): пока идёт правка, поля автосохраняются
 * в `appStorage` с задержкой; при повторном открытии той же записи черновик предлагается, если запись на
 * сервере не изменилась (сверка снимка). Явное «Сохранить» и «Отменить» черновик удаляют. В базу — ничего.
 */
export function useJournalDraft(journal: string) {
  const authStore = useAuthStore();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  const keyFor = (recordId: number | 'new') => draftKey(authStore.username, journal, recordId);

  /** Черновик записи, если он есть и подходит к текущему снимку; устаревший удаляется и не предлагается */
  const take = (recordId: number | 'new', snapshot: string): JournalDraft | null => {
    const key = keyFor(recordId);
    const draft = loadDraft(appStorage, key);
    if (!draft) return null;
    if (!draftMatches(draft, snapshot)) {
      clearDraft(appStorage, key);
      return null;
    }
    return draft;
  };

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending?.();
    pending = null;
  };

  /** Запланировать сохранение полей (серия правок → одна запись) */
  const schedule = (recordId: number | 'new', snapshot: string, fields: Record<string, unknown>) => {
    const key = keyFor(recordId);
    const copy = JSON.parse(JSON.stringify(fields)) as Record<string, unknown>;
    pending = () => saveDraft(appStorage, key, { fields: copy, snapshot });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  };

  const clear = (recordId: number | 'new') => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    clearDraft(appStorage, keyFor(recordId));
  };

  onBeforeUnmount(flush);

  return { take, schedule, flush, clear };
}
