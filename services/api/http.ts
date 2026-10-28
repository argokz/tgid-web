/** Ядро обращений к API ТГИД: адрес, запросы с повторами, ошибки, фоновые выгрузки (из fastApiService.ts). */
import { fastApiService } from '../fastApiService';
import { appStorage } from '~/utils/appStorage';
import { reactive } from 'vue';
import { BAD_CREDENTIALS_TEXT, SESSION_EXPIRED_TEXT, serverDetailText, statusMessage } from '~/utils/apiError';
import type { ColumnTranslation, TranslationCache } from './types';

/** Тело запроса без неопределённых полей (версия не передана — сервер её не проверяет) */
export const compact = <T extends Record<string, any>>(body: T): T =>
  Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== null)) as T;

/** Параметры запроса без пустых значений */
export function cleanQuery(query: object): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') out[key] = value as string | number | boolean;
  }
  return out;
}

export const translationCache: TranslationCache = {};
export const pendingTranslationRequests = new Map<string, Promise<ColumnTranslation>>();
export const DEFAULT_MAP_API_BASE_URL = 'http://localhost:8000';

export const getApiBaseUrl = (): string => {
  try {
    const runtimeConfig = useRuntimeConfig() as any;
    const configured =
      runtimeConfig.public?.mapApiBaseUrl ||
      runtimeConfig.public?.externalApiUrl ||
      DEFAULT_MAP_API_BASE_URL;
    return String(configured).replace(/\/+$/, '');
  } catch {
    return DEFAULT_MAP_API_BASE_URL;
  }
};

export const buildApiUrl = (path: string): string => `${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`;

/** Ошибка API с разобранным статусом и текстом для пользователя */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly path: string;
  readonly userMessage: string;
  /** Структурированный detail ответа (например, {code, conflicts} у 409), если он был объектом */
  readonly data: any;
  /** Сервер ответил своим текстом detail (не FastAPI «Not Found») — маршрут существует */
  readonly hasServerDetail: boolean;

  constructor(params: {
    status: number; detail: string; path: string; userMessage: string; data?: any; hasServerDetail?: boolean;
  }) {
    super(params.userMessage);
    this.name = 'ApiError';
    this.status = params.status;
    this.detail = params.detail;
    this.path = params.path;
    this.userMessage = params.userMessage;
    this.data = params.data ?? null;
    this.hasServerDetail = params.hasServerDetail ?? false;
  }

  /** 409: объект изменён/удалён другим пользователем после того, как его прочитали */
  get isVersionConflict(): boolean {
    return this.status === 409 && this.data?.code === 'version_conflict';
  }

  /** Маршрута нет на сервере — обычно развёрнута устаревшая версия API.
   *  404 с кодом или своим текстом в detail (nothing_to_undo, «Фрагмент не найден») —
   *  ответ существующего маршрута. */
  get isRouteMissing(): boolean {
    return this.status === 404 && !this.data?.code && !this.hasServerDetail && !this.path.match(/\/\d+$/);
  }

  /** Сеть/сервер недоступны */
  get isUnavailable(): boolean {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

export const DEFAULT_TIMEOUT_MS = 30_000;
/** Excel-отчёты по всему фрагменту: запросы ограничены на сервере 60 с, плюс сборка книги */
export const REPORT_TIMEOUT_MS = 120_000;
export const MAX_RETRIES = 2;

/** Ретраим только то, что имеет шанс пройти со второй попытки */
export const isRetriableStatus = (status: number) =>
  status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600);

export const extractStatus = (error: any): number =>
  Number(error?.statusCode ?? error?.status ?? error?.response?.status ?? 0) || 0;

export const BLOCKER_LABELS: Record<string, string> = {
  references: 'ссылки на узел',
  incident_lines: 'инцидентные участки',
  internal_scheme_lines: 'линии внутренней схемы узла',
  connecting_lines: 'соединяющие участки с оборудованием',
  equipment: 'оборудование, зависящее от направления',
  requires_confirmation: 'требуется подтверждение в превью',
  different_fragments: 'узлы из разных фрагментов',
  different_internal_scheme: 'узлы из разных внутренних схем',
  target_without_geometry: 'у целевого узла нет геометрии',
  conflicting_references: 'у обоих узлов есть единичные объекты',
};

export const OBJECT_KIND_LABELS: Record<string, string> = {
  node: 'узел',
  line: 'участок',
  // конфликты отмены: строки таблиц, затронутые операцией
  nodes: 'узел',
  linesobj: 'участок',
  heatpipesections: 'паспорт трубы',
  operation: 'последняя операция',
};

/** 409 version_conflict: {conflicts: {"node:5": {removed, changed_at}}} → «узел 5 (изменён 27.09 15:51)» */
export const formatVersionConflict = (detail: { message?: string; conflicts?: Record<string, any> }): string => {
  const parts = Object.entries(detail.conflicts || {}).map(([key, info]) => {
    const [kind, id] = key.split(':');
    const label = id ? `${OBJECT_KIND_LABELS[kind] || kind} ${id}` : OBJECT_KIND_LABELS[kind] || kind;
    if (info?.removed) return `${label} удалён`;
    const at = info?.changed_at ? new Date(info.changed_at) : null;
    return at && !Number.isNaN(at.getTime())
      ? `${label} изменён ${at.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
      : `${label} изменён`;
  });
  return [detail.message || 'Объект изменён другим пользователем', parts.join('; ')].filter(Boolean).join(': ');
};

export const formatBlockerValue = (value: any): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => (v && typeof v === 'object' ? `${k}: ${formatBlockerValue(v)}` : `${k} ×${v}`))
      .join('; ');
  }
  return String(value);
};

/** 409 топологии: {message, blockers} → «сообщение: ссылки на узел — pressregulators.nodeid ×1» */
export const formatTopologyBlockers = (detail: { message?: string; blockers?: Record<string, any> }): string => {
  const parts = Object.entries(detail.blockers || {}).map(
    ([key, value]) => `${BLOCKER_LABELS[key] || key} — ${formatBlockerValue(value)}`
  );
  return [detail.message, parts.join('; ')].filter(Boolean).join(': ');
};

/**
 * Тело ответа с ошибкой. У responseType: 'blob' ofetch отдаёт Blob — читаем его как JSON/текст,
 * чтобы показать detail сервера, а не `[GET] "http://…": 500` (QA F22).
 */
export const readErrorBody = async (error: any): Promise<any> => {
  const data = error?.data ?? error?.response?._data;
  if (typeof Blob === 'undefined' || !(data instanceof Blob)) return data;
  try {
    const text = await data.text();
    try {
      return JSON.parse(text);
    } catch {
      // HTML-страница прокси/сервера — не показываем
      return /^\s*</.test(text) ? null : text.slice(0, 500);
    }
  } catch {
    return null;
  }
};

/** Текст detail сервера; пусто, если сервер его не прислал (сырое сообщение ofetch не показываем) */
export const extractDetail = (data: any): string => {
  if (typeof data === 'string') return /^\s*</.test(data) ? '' : data.trim();
  const detail = data?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    if (detail.code === 'version_conflict') return formatVersionConflict(detail);
    if (detail.blockers) return formatTopologyBlockers(detail);
    return serverDetailText(data) || JSON.stringify(detail);
  }
  return serverDetailText(data);
};

export const isLoginPath = (path: string) => /(^|\/)auth\/login$/.test(path);

export const userMessageFor = (status: number, detail: string, path: string): string => {
  if (status === 401 && isLoginPath(path)) return BAD_CREDENTIALS_TEXT;
  if (status === 404 && !detail) {
    return path.match(/\/\d+$/)
      ? 'Запись не найдена.'
      : 'Маршрут отсутствует на сервере API — вероятно, развёрнута устаревшая версия.';
  }
  return statusMessage(status, detail);
};

/** 401 при отправленном токене: сессия истекла — authStore сбрасывает её и открывает вход (QA F71) */
export let unauthorizedHandler: ((path: string) => void) | null = null;
export const setUnauthorizedHandler = (handler: ((path: string) => void) | null) => {
  unauthorizedHandler = handler;
};

/** Доступность API — для индикатора деградации в интерфейсе */
export const apiHealth = reactive({
  reachable: true,
  outdatedRoutes: false,
  redisOk: true,
  lastError: '' as string,
  /** Сколько запросов сейчас ждут повтора после сетевого сбоя или 5xx — индикатор «повторяем…» в шапке */
  retrying: 0,
});

/** Итог последнего /health: устаревший API или Redis — баннер держится, пока health не скажет иначе */
export const healthState = { outdated: false, note: '' };

/** Успешный ответ: снять «недоступен» и разовое «маршрут отсутствует», вернуть текст health (QA F76) */
export const markApiResponded = () => {
  apiHealth.reachable = true;
  apiHealth.outdatedRoutes = healthState.outdated;
  apiHealth.lastError = healthState.note;
};

export const refreshApiHealth = async () => {
  try {
    const health = await fastApiService.getHealth();
    healthState.outdated = (health.routes || 0) < 80;
    apiHealth.redisOk = health.redis?.ok !== false;
    if (healthState.outdated) {
      healthState.note =
        `На сервере устаревший API (${health.routes} маршрутов). Нужен деплой актуального itwin-api.`;
    } else if (!apiHealth.redisOk) {
      healthState.note =
        health.redis?.note ||
        'Redis недоступен: расчёт sety и запуск теплопотерь не будут работать.';
    } else {
      healthState.note = '';
    }
    markApiResponded();
  } catch (e: any) {
    apiHealth.reachable = false;
    apiHealth.lastError = e?.message || 'API недоступен';
  }
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const ACCESS_TOKEN_KEY = 'itwin_access_token';

export const authHeaders = (): Record<string, string> => {
  if (typeof localStorage === 'undefined') return {};
  // тот же ключ, что у authStore: с префиксом города (Астана — astana:itwin_access_token)
  const token = appStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Единая точка сетевых вызовов: таймаут, ретраи с экспоненциальной паузой
 * только для сетевых сбоев и 5xx, нормализация ошибки.
 * Мутации (POST/PUT/DELETE) не повторяются — чтобы не задвоить запись.
 */
export const request = async <T>(path: string, options?: any): Promise<T> => {
  const url = buildApiUrl(path.startsWith('/') ? path.slice(1) : path);
  const method = String(options?.method || 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';
  // Файлы (blob) не повторяем: выгрузка тяжёлая (DXF ~30 с), повтор даёт параллельные выгрузки (QA F22, F77)
  const isBlob = options?.responseType === 'blob';
  const maxAttempts = isMutation || isBlob ? 1 : MAX_RETRIES + 1;

  // JWT уходит со всеми вызовами API: при AUTH_REQUIRED_GET сервер закрывает
  // и POST-расчёты (пьезометр, калькуляторы, локализация), не только чтение
  const headers = { ...authHeaders(), ...(options?.headers || {}) };

  let lastError: any = null;
  let retrying = false;
  const endRetry = () => {
    if (!retrying) return;
    retrying = false;
    apiHealth.retrying = Math.max(0, apiHealth.retrying - 1);
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await $fetch<T>(url, {
        timeout: DEFAULT_TIMEOUT_MS,
        ...(options || {}),
        headers,
        // встроенные ретраи ofetch (GET на 409/5xx) выключены: повторы только по maxAttempts выше
        retry: 0,
      });
      endRetry();
      markApiResponded();
      return result;
    } catch (error: any) {
      lastError = error;
      const status = extractStatus(error);

      if (attempt < maxAttempts && isRetriableStatus(status)) {
        // экспоненциальная пауза с джиттером — чтобы не «долбить» сервер синхронно
        const backoff = 400 * 2 ** (attempt - 1) + Math.random() * 200;
        console.warn(`[api] ${method} ${path} → ${status}, повтор через ${Math.round(backoff)}ms`);
        if (!retrying) {
          retrying = true;
          apiHealth.retrying += 1;
        }
        await sleep(backoff);
        continue;
      }
      endRetry();

      const apiError = await toApiError(error, path, Boolean(headers.Authorization), status);

      if (apiError.isUnavailable) {
        apiHealth.reachable = false;
        apiHealth.lastError = apiError.userMessage;
      } else if (apiError.isRouteMissing) {
        apiHealth.outdatedRoutes = true;
        apiHealth.lastError = apiError.userMessage;
      }

      throw apiError;
    }
  }

  endRetry();
  throw lastError;
};

/** Ошибка ofetch → ApiError с текстом для пользователя (detail сервера, в т. ч. из Blob) */
export const toApiError = async (
  error: any,
  path: string,
  sentToken: boolean,
  status = extractStatus(error),
): Promise<ApiError> => {
  const body = await readErrorBody(error);
  const detail = extractDetail(body);
  const rawDetail = body && typeof body === 'object' ? body.detail : undefined;
  const hasServerDetail = typeof rawDetail === 'string' && rawDetail !== '' && rawDetail !== 'Not Found';
  // 401 с отправленным токеном — сессия истекла: сбросить её и предложить войти (QA F71)
  const sessionExpired = status === 401 && sentToken && !isLoginPath(path);
  if (sessionExpired) unauthorizedHandler?.(path);
  return new ApiError({
    status,
    detail: detail || String(error?.message || ''),
    path,
    userMessage: sessionExpired ? SESSION_EXPIRED_TEXT : userMessageFor(status, detail, path),
    data: rawDetail && typeof rawDetail === 'object' ? rawDetail : null,
    hasServerDetail,
  });
};

/** Совместимость: раньше использовался отдельный хелпер с ретраями */
export const fetchWithRetry = <T>(url: string, options: any = {}): Promise<T> =>
  request<T>(url.replace(getApiBaseUrl(), ''), options);

export const encodePath = (value: string | number): string => encodeURIComponent(String(value));

export const mutationOptions = (method: string, body?: any): Record<string, any> => {
  const options: Record<string, any> = { method, headers: authHeaders() };
  if (body !== undefined) options.body = body;
  return options;
};

export const mutationWithFallback = async <T>(
  primaryPath: string,
  fallbackPath: string,
  options: Record<string, any>
): Promise<T> => {
  try {
    return await request<T>(primaryPath, options);
  } catch (error) {
    // Старый маршрут без /api/v1 — только если нового маршрута нет (404/405 без ответа сервера).
    // Ответ 4xx/5xx сервера не повторяется: повтор POST мог бы задвоить запись (QA F44).
    if (!isMissingRoute(error)) throw error;
    return request<T>(fallbackPath, options);
  }
};

/** Маршрута нет на сервере (старый API): 404 без detail сервера или 405 */
export const isMissingRoute = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 405 || (error.status === 404 && !error.hasServerDetail && !error.data));

/** Виды фоновых файлов API (database/file_jobs.py) */
export type FileJobKind =
  | 'passport'
  | 'passport_chief'
  | 'report_excel'
  | 'catalog_report'
  | 'alseko_reconciliation'
  | 'electrical_reconciliation'
  | 'network_dxf';

/** Статус фоновой выгрузки (GET api/v1/file-jobs/{task_id}) */
export interface FileJobStatus {
  task_id: string;
  state: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | string;
  ready: boolean;
  success: boolean | null;
  message: string | null;
  kind?: string | null;
  filename?: string;
  size?: number;
  elapsed_s?: number | null;
  status_code?: number | null;
}

export interface FileJobProgress {
  phase: 'queued' | 'running' | 'downloading' | 'fallback';
  elapsedMs: number;
  message: string;
}

export interface FileJobOptions {
  onProgress?: (progress: FileJobProgress) => void;
  signal?: AbortSignal;
  /** Сколько ждать, пока воркер возьмёт задачу, прежде чем перейти на синхронный эндпоинт */
  pendingFallbackMs?: number;
  timeoutMs?: number;
  pollMs?: number;
}

/** Текст прогресса фоновой выгрузки для UI: «Формирование файла… 7 с» */
export const describeFileJobProgress = (p: FileJobProgress | null | undefined): string =>
  p ? `${p.message} ${Math.round(p.elapsedMs / 1000)} с` : '';

export const FILE_JOB_PENDING_FALLBACK_MS = 30_000;
export const FILE_JOB_TIMEOUT_MS = 10 * 60_000;

export const filenameFromDisposition = (header: string | null | undefined): string | null => {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* ниже — ASCII-имя */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
};

/** Полнота сводной ведомости Excel (заголовки X-Report-Rows/Total/Truncated/Fragments, QA F14) */
export interface ExcelReportMeta {
  rows: number;
  total: number;
  truncated: boolean;
  fragments: number[];
}

export type HeaderGetter = (name: string) => string | null | undefined;

export const parseExcelReportMeta = (get: HeaderGetter): ExcelReportMeta | undefined => {
  const rows = Number(get('x-report-rows'));
  const totalRaw = get('x-report-total');
  if (totalRaw == null || totalRaw === '' || !Number.isFinite(rows)) return undefined;
  const total = Number(totalRaw);
  if (!Number.isFinite(total)) return undefined;
  const fragments = String(get('x-report-fragments') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return { rows, total, truncated: get('x-report-truncated') === '1' || total > rows, fragments };
};

/** Полнота выгрузки сети DXF/SHP/GeoJSON (заголовки X-Export-Rows/Limit/Truncated, QA F84) */
export interface NetworkExportMeta {
  rows: number;
  limit: number;
  truncated: boolean;
}

export const parseNetworkExportMeta = (get: HeaderGetter): NetworkExportMeta | undefined => {
  const truncated = get('x-export-truncated');
  if (truncated == null || truncated === '') return undefined;
  return { rows: Number(get('x-export-rows')) || 0, limit: Number(get('x-export-limit')) || 0, truncated: truncated === '1' };
};

/** Предупреждение об обрезанной выгрузке сети или null */
export const describeNetworkExportTruncation = (format: string, meta: NetworkExportMeta | undefined): string | null =>
  meta?.truncated
    ? `${format}: выгрузка неполная — достигнут предел ${meta.limit.toLocaleString('ru-RU')} объектов. ` +
      'Выберите меньше фрагментов, чтобы выгрузить сеть полностью.'
    : null;

/** Текст предупреждения о неполной ведомости или null, если выгружено всё */
export const describeExcelReportTruncation = (meta: ExcelReportMeta | undefined): string | null =>
  meta?.truncated
    ? `Ведомость неполная: выгружено ${meta.rows} из ${meta.total} строк. ` +
      (meta.fragments.length ? 'Сузьте выбор фрагментов.' : 'Выберите фрагмент на карте, чтобы выгрузить её полностью.')
    : null;

/**
 * Единый путь тяжёлых выгрузок: задача Celery → опрос статуса → скачивание файла из Redis.
 * Если фоновые файлы недоступны (старый API, нет Redis, воркер не берёт задачу) — вызывается
 * `fallback` (синхронный эндпоинт того же файла). `onHeaders` получает заголовки ответа со скачанным файлом.
 */
export const runFileJob = async (
  kind: FileJobKind,
  params: Record<string, unknown>,
  fallback: (() => Promise<{ blob: Blob; filename: string }>) | null,
  options: FileJobOptions = {},
  onHeaders?: (get: HeaderGetter) => void,
): Promise<{ blob: Blob; filename: string }> => {
  const started = Date.now();
  const report = (phase: FileJobProgress['phase'], message: string) =>
    options.onProgress?.({ phase, message, elapsedMs: Date.now() - started });
  const pendingLimit = options.pendingFallbackMs ?? FILE_JOB_PENDING_FALLBACK_MS;
  const timeout = options.timeoutMs ?? FILE_JOB_TIMEOUT_MS;
  const pollMs = options.pollMs ?? 1000;
  const runFallback = async (reason: string) => {
    if (!fallback) throw new Error(reason);
    report('fallback', 'Формирование файла на сервере (синхронно)…');
    return fallback();
  };

  let taskId: string;
  try {
    const job = await request<{ task_id: string }>('api/v1/file-jobs', mutationOptions('POST', { kind, params }));
    taskId = job.task_id;
  } catch (e: any) {
    // 4xx по параметрам — ошибка пользователя; 404/5xx/сеть — фоновые файлы недоступны
    if (e instanceof ApiError && e.status && e.status >= 400 && e.status < 500 && e.status !== 404) throw e;
    return runFallback(e?.message || 'Фоновые выгрузки недоступны');
  }
  report('queued', 'Задача в очереди…');

  for (;;) {
    if (options.signal?.aborted) throw new Error('Отменено');
    await sleep(pollMs);
    const status = await request<FileJobStatus>(`api/v1/file-jobs/${encodePath(taskId)}`);
    const elapsed = Date.now() - started;
    if (status.state === 'PENDING') {
      if (elapsed > pendingLimit) {
        if (fallback) return runFallback('Воркер не взял задачу');
        throw new Error('Воркер не взял задачу формирования файла');
      }
      report('queued', 'Задача в очереди…');
      continue;
    }
    if (!status.ready) {
      report('running', status.message || 'Формирование файла…');
      if (elapsed > timeout) throw new Error('Формирование файла не уложилось в отведённое время');
      continue;
    }
    if (!status.success) throw new Error(status.message || 'Не удалось сформировать файл');
    report('downloading', 'Скачивание…');
    const url = buildApiUrl(`api/v1/file-jobs/${encodePath(taskId)}/download`);
    let disposition: string | null = null;
    let blob: Blob;
    try {
      blob = await $fetch<Blob>(url, {
        responseType: 'blob',
        timeout: REPORT_TIMEOUT_MS,
        headers: authHeaders(),
        retry: 0,
        onResponse({ response }: any) {
          disposition = response?.headers?.get?.('content-disposition') ?? null;
          if (onHeaders && response?.headers?.get) onHeaders((name) => response.headers.get(name));
        },
      });
    } catch (error: any) {
      throw await toApiError(error, `api/v1/file-jobs/${taskId}/download`, Boolean(authHeaders().Authorization));
    }
    return { blob, filename: filenameFromDisposition(disposition) || status.filename || `${kind}.xlsx` };
  }
};
