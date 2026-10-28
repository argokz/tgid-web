/** Русские названия колонок. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { ColumnTranslation } from './types';
import { encodePath, pendingTranslationRequests, request, translationCache } from './http';

export const translationsApi = {
  async getColumnTranslation(column: string): Promise<ColumnTranslation> {
    if (translationCache[column]) return translationCache[column];
    if (pendingTranslationRequests.has(column)) return pendingTranslationRequests.get(column)!;

    const pending = this.fetchColumnTranslation(column);
    pendingTranslationRequests.set(column, pending);
    try {
      const translation = await pending;
      translationCache[column] = translation;
      return translation;
    } finally {
      pendingTranslationRequests.delete(column);
    }
  },

  async fetchColumnTranslation(column: string): Promise<ColumnTranslation> {
    try {
      return await request(`russian-names/column/${encodePath(column)}`);
    } catch (error) {
      console.error(`Error fetching translation for column "${column}":`, error);
      return { column, russian_name: column, description: '' };
    }
  },

  async getMultipleTranslations(columns: string[]): Promise<Record<string, ColumnTranslation>> {
    const results: Record<string, ColumnTranslation> = {};
    const uncached = columns.filter((column) => {
      if (!translationCache[column]) return true;
      results[column] = translationCache[column];
      return false;
    });

    if (!uncached.length) return results;
    try {
      const batch = await $fetch<Record<string, ColumnTranslation>>('/api/translations-batch', {
        method: 'POST',
        body: { columns: uncached },
      });
      for (const [column, translation] of Object.entries(batch)) {
        translationCache[column] = translation;
        results[column] = translation;
      }
    } catch {
      await Promise.all(
        uncached.map(async (column) => {
          results[column] = await this.getColumnTranslation(column);
        })
      );
    }
    return results;
  },

  async getRussianName(column: string): Promise<string> {
    try {
      return (await this.getColumnTranslation(column)).russian_name || column;
    } catch {
      return column;
    }
  },

  async getRussianNames(columns: string[]): Promise<Record<string, string>> {
    const translations = await this.getMultipleTranslations(columns);
    return Object.fromEntries(
      Object.entries(translations).map(([column, translation]) => [
        column,
        translation.russian_name || column,
      ])
    );
  },

  getCachedRussianName(column: string): string {
    return translationCache[column]?.russian_name || column;
  },

  getCachedDescription(column: string): string {
    return translationCache[column]?.description || '';
  },

  isTranslationLoaded(column: string): boolean {
    return Boolean(translationCache[column]);
  },

  clearTranslationCache(): void {
    Object.keys(translationCache).forEach((key) => delete translationCache[key]);
    pendingTranslationRequests.clear();
  },

  getTranslationCacheSize(): number {
    return Object.keys(translationCache).length;
  },

  async preloadCommonTranslations(): Promise<void> {
    const columns = [
      'id',
      'name',
      'type',
      'status',
      'length',
      'diameter',
      'material',
      'pressure',
      'temperature',
      'flow_rate',
      'created_at',
      'updated_at',
      'externalsignlineid',
      'gid',
      'objectid',
      'objecttype',
    ];
    try {
      const batch = await $fetch<Record<string, ColumnTranslation>>('/api/translations-batch', {
        method: 'POST',
        body: { columns },
      });
      Object.assign(translationCache, batch);
    } catch {
      await this.getMultipleTranslations(columns);
    }
  },
};
