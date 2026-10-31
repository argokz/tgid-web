/** Перспективный прирост нагрузки по реестру ТУ (itwin-api routers/load_perspective.py). Часть fastApiService. */
import type { LoadPerspective, PerspectiveScenarioPlan, PerspectiveScenarioResult } from '~/utils/loadPerspective';
import { mutationOptions, request } from './http';

export const loadPerspectiveApi = {
  async getLoadPerspective(horizon = 15): Promise<LoadPerspective> {
    return request<LoadPerspective>('api/v1/perspective/loads', { ...mutationOptions('GET'), query: { horizon } });
  },
  /** Сколько и у каких потребителей фрагмента прибавится за horizon лет (без записи) */
  async getPerspectiveScenarioPlan(fileid: number, horizon: number): Promise<PerspectiveScenarioPlan> {
    return request<PerspectiveScenarioPlan>('api/v1/perspective/scenario-plan',
      { ...mutationOptions('GET'), query: { fileid, horizon }, timeout: 120_000 });
  },
  /** Сценарий «перспектива»: копия фрагмента с приростом нагрузки (копирование крупного фрагмента — до минуты) */
  async createPerspectiveScenario(fileid: number, horizon: number): Promise<PerspectiveScenarioResult> {
    return request<PerspectiveScenarioResult>('api/v1/perspective/scenario',
      { ...mutationOptions('POST', { fileid, horizon }), timeout: 300_000 });
  },
};
