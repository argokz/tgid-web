/** Прогноз нагрузки по погоде (itwin-api routers/load_forecast.py). Часть fastApiService (services/fastApiService.ts). */
import type { ForecastDetail, ForecastOverview, WeatherState } from '~/utils/loadForecast';
import { encodePath, mutationOptions, request } from './http';

export const loadForecastApi = {
  /** Погода по часам и сводка прогноза по источникам на сутки (обновляет погоду из Open-Meteo, если устарела) */
  async getLoadForecast(): Promise<ForecastOverview> {
    return request<ForecastOverview>('api/v1/forecast/load', mutationOptions('GET'));
  },

  /** Источник по часам: нагрузка по составляющим, температуры графика, факт по датчикам */
  async getSourceForecast(sourceId: number, pastHours = 48, hours = 72): Promise<ForecastDetail> {
    return request<ForecastDetail>(`api/v1/forecast/load/${encodePath(sourceId)}`,
      { ...mutationOptions('GET'), query: { past_hours: pastHours, hours } });
  },

  /** Обновить погоду из Open-Meteo сейчас */
  async refreshWeather(): Promise<WeatherState> {
    return request<WeatherState>('api/v1/forecast/weather/refresh', mutationOptions('POST'));
  },

  /** Файл «время; температура» (CSV / Excel): прогноз или факт */
  async importWeather(file: File, kind: 'forecast' | 'fact' = 'forecast'): Promise<{ stored: number; from: string; to: string }> {
    const form = new FormData();
    form.append('file', file, file.name);
    return request<{ stored: number; from: string; to: string }>('api/v1/forecast/weather/import',
      { ...mutationOptions('POST', form), query: { kind } });
  },
};
