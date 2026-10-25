/** Виды иллюстраций состояний (этап 8): одна серия в графическом языке «живой сети» */
export type StateIllustrationKind = 'empty' | 'not-found' | 'no-access' | 'offline' | 'error' | 'done';

/** Значок в центральном узле по умолчанию; у пустого состояния его заменяет предметная иконка экрана */
export const STATE_ILLUSTRATION_ICONS: Record<StateIllustrationKind, string> = {
  'empty': 'mdi-tray-remove',
  'not-found': 'mdi-magnify',
  'no-access': 'mdi-lock-outline',
  'offline': 'mdi-lan-disconnect',
  'error': 'mdi-alert-circle-outline',
  'done': 'mdi-check',
};

// Тексты utils/apiError.ts: 401/403 — «Требуется вход», «Недостаточно прав», «Сессия истекла»;
// сеть — «Сервер API недоступен», «Сервер не ответил вовремя»
const NO_ACCESS = /нет (прав|доступа)|доступ запрещ|недостаточно прав|требуется вход|сессия истекла|forbidden/i;
const OFFLINE = /нет связи|недоступен|не ответил|не отвечает|подключени|тайм-?аут|timeout|failed to fetch|network ?error|offline/i;

/** Вид иллюстрации ошибки по её тексту: нет прав, нет связи или прочая ошибка */
export function illustrationForError(message: string | null | undefined): StateIllustrationKind {
  const text = message || '';
  if (NO_ACCESS.test(text)) return 'no-access';
  if (OFFLINE.test(text)) return 'offline';
  return 'error';
}

/** Вид иллюстрации пустого состояния по иконке экрана: поиск без результата, «всё в порядке» или просто пусто */
export function illustrationForEmpty(icon: string | null | undefined): StateIllustrationKind {
  const name = icon || '';
  if (/search|magnify/.test(name)) return 'not-found';
  if (/check-circle|check-all|^mdi-check$/.test(name)) return 'done';
  return 'empty';
}
