/** Прогноз аварийности (itwin-api routers/failure_forecast.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { FailureRun, FailureTop } from '~/utils/failureForecast';
import { encodePath, mutationOptions, request } from './http';

export const failureForecastApi = {
  async getFailureRuns(): Promise<FailureRun[]> {
    return request<FailureRun[]>('api/v1/forecast/failures/runs', mutationOptions('GET'));
  },
  /** Обучить, проверить по времени и записать риск участков (право «Расчёт»; ~40 с на Астане) */
  async runFailureForecast(horizonYears = 2): Promise<FailureRun> {
    return request<FailureRun>('api/v1/forecast/failures/run',
      { ...mutationOptions('POST'), query: { horizon_years: horizonYears }, timeout: 300_000 });
  },
  async getFailureTop(runId: number, limit = 200, fileid?: number): Promise<FailureTop> {
    return request<FailureTop>(`api/v1/forecast/failures/runs/${encodePath(runId)}/top`,
      { ...mutationOptions('GET'), query: fileid ? { limit, fileid } : { limit } });
  },
};
