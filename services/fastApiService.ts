import type { FeatureData, Fragment } from '~/types';

// Интерфейсы для переводов
export interface ColumnTranslation {
  column: string;
  russian_name: string;
  description: string;
}

export interface TranslationCache {
  [column: string]: ColumnTranslation;
}

// Кэш переводов и ожидающих запросов
const translationCache: TranslationCache = {};
const pendingTranslationRequests: Map<string, Promise<ColumnTranslation>> = new Map();
const DEFAULT_MAP_API_BASE_URL = 'http://localhost:8000';

const getApiBaseUrl = (): string => {
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

const buildApiUrl = (path: string): string => {
  const normalizedPath = path.replace(/^\/+/, '');
  return `${getApiBaseUrl()}/${normalizedPath}`;
};

const fetchWithRetry = async <T>(url: string, options: any = {}, retries = 2): Promise<T> => {
  try {
    return (await $fetch(url, options)) as T;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry fetching ${url}, retries left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

export const fastApiService = {
  async getObjectData(typeObject: string, nameObject: string, id: string | number): Promise<FeatureData> {
    const url = buildApiUrl(
      `${encodeURIComponent(typeObject)}/${encodeURIComponent(nameObject)}/${encodeURIComponent(String(id))}`
    );
    try {
      return await fetchWithRetry<FeatureData>(url);
    } catch (error) {
      console.error(`Failed to fetch data from ${url}:`, error);
      throw error;
    }
  },
  async getFragments(): Promise<{ data: Fragment[] }> {
    const url = buildApiUrl('fragments');
    try {
      return await fetchWithRetry<{ data: Fragment[] }>(url);
    } catch (error) {
      console.error(`Failed to fetch data from ${url}:`, error);
      throw error;
    }
  },
  async postRunSetyCmd(params: string): Promise<any> {
    const url = buildApiUrl('run-sety-cmd');
    try {
      const response = await $fetch(url, {
        method: 'POST',
        body: { params },
      });
      return response;
    } catch (error) {
      console.error('Failed to POST /run-sety-cmd:', error);
      throw error;
    }
  },

  // === МЕТОДЫ ДЛЯ ПЕРЕВОДОВ АТРИБУТОВ ===

  /**
   * Получает русское название для указанной колонки
   */
  async getColumnTranslation(column: string): Promise<ColumnTranslation> {
    // Проверяем кэш
    if (translationCache[column]) {
      return translationCache[column];
    }

    // Проверяем, нет ли уже ожидающего запроса
    if (pendingTranslationRequests.has(column)) {
      return pendingTranslationRequests.get(column)!;
    }

    // Создаем новый запрос
    const requestPromise = this.fetchColumnTranslation(column);
    pendingTranslationRequests.set(column, requestPromise);

    try {
      const result = await requestPromise;
      // Сохраняем в кэш
      translationCache[column] = result;
      return result;
    } finally {
      // Удаляем из ожидающих запросов
      pendingTranslationRequests.delete(column);
    }
  },

  /**
   * Выполняет HTTP запрос для получения перевода
   */
  async fetchColumnTranslation(column: string): Promise<ColumnTranslation> {
    const url = buildApiUrl(`russian-names/column/${encodeURIComponent(column)}`);
    try {
      const response = await $fetch<ColumnTranslation>(url);
      return response;
    } catch (error) {
      console.error(`Error fetching translation for column "${column}":`, error);

      // Возвращаем исходное название в случае ошибки
      return {
        column,
        russian_name: column,
        description: ''
      };
    }
  },

  /**
   * Получает переводы для массива колонок за один раз
   * Использует batch-эндпоинт для незакешированных колонок
   */
  async getMultipleTranslations(columns: string[]): Promise<Record<string, ColumnTranslation>> {
    const results: Record<string, ColumnTranslation> = {};
    const uncached: string[] = [];

    for (const column of columns) {
      if (translationCache[column]) {
        results[column] = translationCache[column];
      } else {
        uncached.push(column);
      }
    }

    if (uncached.length > 0) {
      try {
        const batchResults = await $fetch<Record<string, ColumnTranslation>>(
          '/api/translations-batch',
          {
            method: 'POST',
            body: { columns: uncached }
          }
        );

        for (const [column, translation] of Object.entries(batchResults)) {
          translationCache[column] = translation;
          results[column] = translation;
        }
      } catch {
        const promises = uncached.map(async (column) => {
          const translation = await this.getColumnTranslation(column);
          results[column] = translation;
        });
        await Promise.all(promises);
      }
    }

    return results;
  },

  /**
   * Получает русское название с фолбэком на исходное название
   */
  async getRussianName(column: string): Promise<string> {
    try {
      const translation = await this.getColumnTranslation(column);
      return translation.russian_name || column;
    } catch (error) {
      console.error(`Error getting Russian name for "${column}":`, error);
      return column;
    }
  },

  /**
   * Получает русские названия для массива колонок
   */
  async getRussianNames(columns: string[]): Promise<Record<string, string>> {
    const translations = await this.getMultipleTranslations(columns);
    const result: Record<string, string> = {};

    for (const [column, translation] of Object.entries(translations)) {
      result[column] = translation.russian_name || column;
    }

    return result;
  },

  /**
   * Получает русское название из кэша (синхронно)
   */
  getCachedRussianName(column: string): string {
    return translationCache[column]?.russian_name || column;
  },

  /**
   * Получает описание для колонки из кэша
   */
  getCachedDescription(column: string): string {
    return translationCache[column]?.description || '';
  },

  /**
   * Проверяет, загружен ли перевод для колонки
   */
  isTranslationLoaded(column: string): boolean {
    return !!translationCache[column];
  },

  /**
   * Очищает кэш переводов
   */
  clearTranslationCache(): void {
    Object.keys(translationCache).forEach(key => delete translationCache[key]);
    pendingTranslationRequests.clear();
  },

  /**
   * Получает размер кэша переводов
   */
  getTranslationCacheSize(): number {
    return Object.keys(translationCache).length;
  },

  /**
   * Предзагружает переводы для часто используемых атрибутов
   * Использует серверный batch-эндпоинт (1 запрос вместо 16)
   */
  async preloadCommonTranslations(): Promise<void> {
    const commonAttributes = [
      'id', 'name', 'type', 'status', 'length', 'diameter', 'material',
      'pressure', 'temperature', 'flow_rate', 'created_at', 'updated_at',
      'externalsignlineid', 'gid', 'objectid', 'objecttype'
    ];

    try {
      const results = await $fetch<Record<string, ColumnTranslation>>(
        '/api/translations-batch',
        {
          method: 'POST',
          body: { columns: commonAttributes }
        }
      );

      for (const [column, translation] of Object.entries(results)) {
        translationCache[column] = translation;
      }
      console.log(`Common translations preloaded: ${Object.keys(results).length} columns`);
    } catch (error) {
      console.error('Error preloading common translations via batch, falling back:', error);
      try {
        await this.getMultipleTranslations(commonAttributes);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  },

  /**
   * Форматирует значение атрибута для отображения
   */
  formatAttributeValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return String(value);
  }
};