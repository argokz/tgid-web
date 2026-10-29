/** Фрагменты сети и данные карты. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { FeatureData, Fragment } from '~/types';
import type { FragmentTransferReport, Scenario, ScenarioCreateResult, ScenarioDiff } from './types';
import { buildApiUrl, encodePath, fetchWithRetry, mutationOptions, request } from './http';

export const fragmentsApi = {
  async getObjectData(
    typeObject: string,
    nameObject: string,
    id: string | number
  ): Promise<FeatureData> {
    return fetchWithRetry<FeatureData>(
      buildApiUrl(`${encodePath(typeObject)}/${encodePath(nameObject)}/${encodePath(id)}`)
    );
  },

  async getFragments(): Promise<{ data: Fragment[] }> {
    return fetchWithRetry<{ data: Fragment[] }>(buildApiUrl('fragments'));
  },

  /** Охват фрагментов [minLng, minLat, maxLng, maxLat] по узлам; null — узлов нет (QA F25) */
  async getFragmentsExtent(ids: number[]): Promise<{ fragments: number[]; bbox: [number, number, number, number] | null }> {
    return request('api/v1/fragments/extent', { query: { fragments: ids.join(',') } });
  },

  /** Версия данных карты (меняется при любой записи в базу города) — для сброса кеша тайлов */
  async getMapDataVersion(): Promise<{ version: string }> {
    return request('api/v1/map/data-version');
  },

  /** Экспорт фрагмента в .tgid десктопа (zip с tgid.txt) */
  async exportFragmentTgid(fileId: number): Promise<Blob> {
    return request<Blob>(`api/v1/fragments/${encodePath(fileId)}/export`, {
      ...mutationOptions('GET'),
      responseType: 'blob',
    });
  },

  /** Импорт .tgid новым фрагментом: dry_run — превью в откатываемой транзакции */
  async importFragmentTgid(file: File, opts: { name?: string; dryRun: boolean }): Promise<FragmentTransferReport> {
    const form = new FormData();
    form.append('file', file);
    if (opts.name) form.append('name', opts.name);
    form.append('dry_run', String(opts.dryRun));
    return request<FragmentTransferReport>('api/v1/fragments/import', mutationOptions('POST', form));
  },

  /** Слияние фрагментов (десктоп unite_tgid): копии сводятся в новый фрагмент */
  async mergeFragments(body: {
    fragment_ids: number[];
    name?: string;
    unify_external_codes?: boolean;
    dry_run: boolean;
  }): Promise<FragmentTransferReport> {
    return request<FragmentTransferReport>('api/v1/fragments/merge', mutationOptions('POST', body));
  },

  /** Сценарии «что если»: копии фрагментов с соответствием объектов основе */
  async getScenarios(includeArchived = false): Promise<Scenario[]> {
    const res = await request<{ items: Scenario[] }>('api/v1/scenarios', { query: { include_archived: includeArchived } });
    return res.items;
  },

  /** Новый сценарий — копия фрагмента-основы (крупный фрагмент копируется до минуты) */
  async createScenario(body: { base_fileid: number; name: string; note?: string }): Promise<ScenarioCreateResult> {
    return request<ScenarioCreateResult>('api/v1/scenarios', mutationOptions('POST', body));
  },

  /** Отличия сценария от основы: правки сценария, конфликты, правки основы после создания */
  async getScenarioDiff(scenarioId: number, limit = 500): Promise<ScenarioDiff> {
    return request<ScenarioDiff>(`api/v1/scenarios/${encodePath(scenarioId)}/diff`, { query: { limit } });
  },

  async setScenarioStatus(scenarioId: number, status: Scenario['status']): Promise<{ id: number; status: Scenario['status'] }> {
    return request(`api/v1/scenarios/${encodePath(scenarioId)}/status`, mutationOptions('POST', { status }));
  },
};
