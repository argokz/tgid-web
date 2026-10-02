/**
 * Текст ошибки для пользователя (QA F61): detail сервера, ApiError.userMessage,
 * понятные тексты по статусу вместо сырого `[GET] "http://…": 500` от ofetch.
 */

/** Сырые сообщения ofetch/браузера, которые нельзя показывать как есть */
const RAW_FETCH_MESSAGE = /^\[(GET|POST|PUT|PATCH|DELETE|HEAD)\]\s|https?:\/\/|<no response>|Failed to fetch|NetworkError|Load failed|fetch failed/i;

export const NETWORK_ERROR_TEXT = 'Сервер API недоступен. Проверьте подключение к сети.';
export const SESSION_EXPIRED_TEXT = 'Сессия истекла, войдите снова.';
export const BAD_CREDENTIALS_TEXT = 'Неверный логин или пароль.';

/** Текст по HTTP-статусу; detail — текст сервера, если он есть */
export function statusMessage(status: number, detail = ''): string {
  if (status === 0) return NETWORK_ERROR_TEXT;
  if (status === 401) return 'Требуется вход в систему.';
  if (status === 403) return 'Недостаточно прав для этой операции.';
  if (status === 404) return detail || 'Запись не найдена.';
  if (status === 408 || status === 504) return 'Сервер не ответил вовремя. Попробуйте ещё раз.';
  if (status === 409) return detail || 'Конфликт: данные изменены другим пользователем. Обновите и повторите.';
  if (status === 422) return detail ? `Некорректные параметры запроса: ${detail}` : 'Некорректные параметры запроса.';
  if (status === 429) return 'Слишком много запросов, попробуйте позже.';
  if (status >= 500) return detail ? `Ошибка на сервере: ${detail}` : `Ошибка на сервере (${status}). Попробуйте позже.`;
  return detail || `Ошибка запроса (${status}).`;
}

/** detail ответа FastAPI → строка: {detail: "…"}, {detail: {message, reason}}, [{msg, loc}] (422) */
export function serverDetailText(raw: unknown): string {
  const detail = raw && typeof raw === 'object' && 'detail' in (raw as any) ? (raw as any).detail : raw;
  // HTML-страница прокси (502 nginx) — не текст для пользователя
  if (typeof detail === 'string') return detail === 'Not Found' || /^\s*</.test(detail) ? '' : detail.trim();
  if (Array.isArray(detail)) {
    // pydantic 422: [{loc: ['body', 'x'], msg: '…'}]
    return detail
      .map((item: any) => {
        const field = Array.isArray(item?.loc) ? item.loc.filter((p: unknown) => p !== 'body' && p !== 'query').join('.') : '';
        return [field, item?.msg].filter(Boolean).join(': ');
      })
      .filter(Boolean)
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, any>;
    const parts: string[] = [];
    if (typeof d.message === 'string') parts.push(d.message);
    const reason = d.reason;
    if (typeof reason === 'string') parts.push(reason);
    else if (reason && typeof reason === 'object' && typeof reason.message === 'string') parts.push(reason.message);
    return parts.filter(Boolean).join(' — ');
  }
  return '';
}

/**
 * Ошибка любого вида → текст для пользователя.
 * - ApiError (services/fastApiService): userMessage уже разобран по статусу и detail сервера;
 * - «сырая» ошибка $fetch: статус + detail из тела;
 * - обычная Error: её текст, если это не сырое сообщение сети/ofetch;
 * - иначе fallback.
 */
export function formatApiError(err: unknown, fallback = 'Не удалось выполнить операцию'): string {
  if (err == null) return fallback;
  if (typeof err === 'string') return err.trim() || fallback;
  const e = err as Record<string, any>;
  const status = Number(e.status ?? e.statusCode ?? e.response?.status ?? 0) || 0;

  // ApiError: userMessage уже собран из статуса и detail (409 version_conflict, блокеры топологии, 422)
  if (typeof e.userMessage === 'string' && e.userMessage) {
    return RAW_FETCH_MESSAGE.test(e.userMessage) ? statusMessage(status) : e.userMessage;
  }

  // Ошибка ofetch ($fetch напрямую): FetchError с data = тело ответа; или объект {data: {detail}}
  const body = e.data ?? e.response?._data;
  const detail = typeof Blob !== 'undefined' && body instanceof Blob ? '' : serverDetailText(body);
  if (status || e.name === 'FetchError') return statusMessage(status, detail);
  if (detail) return detail;

  const message = typeof e.message === 'string' ? e.message.trim() : '';
  if (message) {
    if (RAW_FETCH_MESSAGE.test(message)) return e.name === 'TypeError' || !status ? NETWORK_ERROR_TEXT : statusMessage(status);
    return message;
  }
  return fallback;
}

/** «Префикс: текст ошибки» — для уведомлений вида «Экспорт Excel: Ошибка на сервере (500)» */
export function formatApiErrorWith(prefix: string, err: unknown, fallback = 'ошибка сервера'): string {
  return `${prefix}: ${formatApiError(err, fallback || 'ошибка сервера')}`;
}
