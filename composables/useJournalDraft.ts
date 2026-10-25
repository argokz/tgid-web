import { onBeforeUnmount, onMounted } from 'vue';
import { useAuthStore } from '~/stores/authStore';
import { appStorage } from '~/utils/appStorage';
import { clearDraft, journalDraftKey, draftMatches, isDraftExpired, loadDraft, saveDraft, type JournalDraft } from '~/utils/journalDraft';

const SAVE_DELAY_MS = 400;

interface Pending {
  timer: ReturnType<typeof setTimeout>;
  write: () => boolean;
}

/**
 * Локальный черновик формы записи журнала (utils/journalDraft.ts): пока идёт правка, поля автосохраняются
 * в `appStorage` с задержкой; при повторном открытии той же записи черновик предлагается, если запись на
 * сервере не изменилась (сверка снимка). Явное «Сохранить» и «Отменить» черновик удаляют. В базу — ничего.
 * Отложенные записи — по ключу: очистка одного черновика не трогает другой.
 */
export function useJournalDraft(journal: string) {
  const authStore = useAuthStore();
  const pending = new Map<string, Pending>();

  const keyFor = (recordId: number | 'new') => journalDraftKey(authStore.username, journal, recordId);

  /** Черновик записи, если он есть и подходит; `stale` — был, но запись изменилась или истёк срок (удалён) */
  const take = (recordId: number | 'new', snapshot: string): { draft: JournalDraft | null; stale: boolean } => {
    const key = keyFor(recordId);
    const draft = loadDraft(appStorage, key);
    if (!draft) return { draft: null, stale: false };
    if (!draftMatches(draft, snapshot) || isDraftExpired(draft)) {
      clearDraft(appStorage, key);
      return { draft: null, stale: true };
    }
    return { draft, stale: false };
  };

  const writeNow = (key: string): boolean => {
    const entry = pending.get(key);
    if (!entry) return true;
    clearTimeout(entry.timer);
    pending.delete(key);
    return entry.write();
  };

  /** Записать всё отложенное; false — хотя бы одна запись не удалась (хранилище недоступно) */
  const flush = (): boolean => [...pending.keys()].map(writeNow).every(Boolean);

  /** Запланировать сохранение полей (серия правок → одна запись) */
  const schedule = (recordId: number | 'new', snapshot: string, fields: Record<string, unknown>) => {
    const key = keyFor(recordId);
    const copy = { ...fields };
    const prev = pending.get(key);
    if (prev) clearTimeout(prev.timer);
    pending.set(key, {
      write: () => saveDraft(appStorage, key, { fields: copy, snapshot }),
      timer: setTimeout(() => writeNow(key), SAVE_DELAY_MS),
    });
  };

  const clear = (recordId: number | 'new') => {
    const key = keyFor(recordId);
    const entry = pending.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      pending.delete(key);
    }
    clearDraft(appStorage, key);
  };

  // уход со страницы без размонтирования (перезагрузка, закрытие вкладки) — дописать отложенное
  const onPageHide = () => { flush(); };
  onMounted(() => window.addEventListener('pagehide', onPageHide));
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', onPageHide);
    flush();
  });

  return { take, schedule, flush, clear };
}
