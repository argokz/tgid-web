// Composable для работы с переводами атрибутов
import { ref, computed } from 'vue';
import { fastApiService, type ColumnTranslation } from '~/services/fastApiService';

export function useTranslations() {
  const translations = ref<Record<string, ColumnTranslation>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Загружает перевод для одной колонки
   */
  const loadTranslation = async (column: string): Promise<ColumnTranslation> => {
    try {
      loading.value = true;
      error.value = null;
      
      const translation = await fastApiService.getColumnTranslation(column);
      translations.value[column] = translation;
      
      return translation;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Загружает переводы для массива колонок
   */
  const loadTranslations = async (columns: string[]): Promise<Record<string, ColumnTranslation>> => {
    try {
      loading.value = true;
      error.value = null;
      
      const result = await fastApiService.getMultipleTranslations(columns);
      
      // Обновляем реактивный объект
      for (const [column, translation] of Object.entries(result)) {
        translations.value[column] = translation;
      }
      
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Получает русское название для колонки из кэша или загружает его
   */
  const getRussianName = async (column: string): Promise<string> => {
    // Проверяем кэш
    if (translations.value[column]) {
      return translations.value[column].russian_name || column;
    }
    
    // Загружаем перевод
    const translation = await loadTranslation(column);
    return translation.russian_name || column;
  };

  /**
   * Получает русское название из кэша (синхронно)
   */
  const getCachedRussianName = (column: string): string => {
    // Сначала проверяем локальный кэш компонента
    const localTranslation = translations.value[column];
    if (localTranslation) {
      return localTranslation.russian_name || column;
    }
    
    // Затем проверяем глобальный кэш сервиса
    return fastApiService.getCachedRussianName(column);
  };

  /**
   * Получает описание для колонки из кэша
   */
  const getCachedDescription = (column: string): string => {
    return translations.value[column]?.description || '';
  };

  /**
   * Проверяет, загружен ли перевод для колонки
   */
  const isTranslationLoaded = (column: string): boolean => {
    return !!translations.value[column];
  };

  /**
   * Получает статистику загруженных переводов
   */
  const getLoadedCount = computed(() => Object.keys(translations.value).length);

  /**
   * Очищает кэш переводов
   */
  const clearTranslations = (): void => {
    translations.value = {};
    fastApiService.clearTranslationCache();
  };

  /**
   * Предзагружает часто используемые переводы
   */
  const preloadCommonTranslations = async (): Promise<void> => {
    await fastApiService.preloadCommonTranslations();
  };

  /**
   * Создает реактивный объект переводов для списка атрибутов
   */
  const createTranslatedAttributes = (attributes: string[]) => {
    const translatedAttributes = ref<Record<string, string>>({});
    
    // Загружаем переводы
    loadTranslations(attributes).then(() => {
      for (const attr of attributes) {
        translatedAttributes.value[attr] = getCachedRussianName(attr);
      }
    });

    return translatedAttributes;
  };

  /**
   * Форматирует значение атрибута для отображения
   */
  const formatAttributeValue = fastApiService.formatAttributeValue;

  return {
    // Состояние
    translations: readonly(translations),
    loading: readonly(loading),
    error: readonly(error),
    getLoadedCount,

    // Методы
    loadTranslation,
    loadTranslations,
    getRussianName,
    getCachedRussianName,
    getCachedDescription,
    isTranslationLoaded,
    clearTranslations,
    preloadCommonTranslations,
    createTranslatedAttributes,
    formatAttributeValue,
  };
}
