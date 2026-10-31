/** Прогноз аварийности (itwin-api routers/failure_forecast.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { FailureRun, FailureTop, RelayPlan, RelayPrice } from '~/utils/failureForecast';
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
  async getRelayPrices(): Promise<RelayPrice[]> {
    return request<RelayPrice[]>('api/v1/relay/prices', mutationOptions('GET'));
  },
  /** Заменить расценки перекладки (право «Справочники») */
  async setRelayPrices(prices: RelayPrice[]): Promise<RelayPrice[]> {
    return request<RelayPrice[]>('api/v1/relay/prices', mutationOptions('PUT', { prices }));
  },
  /** План перекладок в пределах бюджета (км или деньги) по последнему прогнозу */
  async getRelayPlan(budget: number, unit: 'km' | 'money', jobOverheadM: number, fileid?: number): Promise<RelayPlan> {
    return request<RelayPlan>('api/v1/relay/plan',
      mutationOptions('POST', { budget, unit, job_overhead_m: jobOverheadM, ...(fileid ? { fileid } : {}) }));
  },
};
