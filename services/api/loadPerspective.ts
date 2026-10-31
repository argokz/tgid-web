/** Перспективный прирост нагрузки по реестру ТУ (itwin-api routers/load_perspective.py). Часть fastApiService. */
import type { LoadPerspective } from '~/utils/loadPerspective';
import { mutationOptions, request } from './http';

export const loadPerspectiveApi = {
  async getLoadPerspective(horizon = 15): Promise<LoadPerspective> {
    return request<LoadPerspective>('api/v1/perspective/loads', { ...mutationOptions('GET'), query: { horizon } });
  },
};
