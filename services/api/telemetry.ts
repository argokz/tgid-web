/** Телеметрия (itwin-api routers/telemetry.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type {
  CalibrationResult, ImportResult, RegimeResult, RegimeRunResult, Sensor, SensorInput, SensorSeries, TelemetryAlert,
  TelemetryUnits,
} from '~/utils/telemetry';
import type { BalanceResult, ZoneGeometry } from '~/utils/flowBalance';
import { encodePath, mutationOptions, request } from './http';

export const telemetryApi = {
  async getTelemetryUnits(): Promise<TelemetryUnits> {
    return request<TelemetryUnits>('api/v1/telemetry/units', mutationOptions('GET'));
  },

  /** Датчики с последним показанием, значением модели и расхождением */
  async getSensors(): Promise<Sensor[]> {
    return request<Sensor[]>('api/v1/telemetry/sensors', mutationOptions('GET'));
  },

  async getSensorsGeojson(): Promise<GeoJSON.FeatureCollection> {
    return request<GeoJSON.FeatureCollection>('api/v1/telemetry/sensors.geojson', mutationOptions('GET'));
  },

  async getSensorSeries(id: number, from: string, to: string): Promise<SensorSeries> {
    return request<SensorSeries>(`api/v1/telemetry/sensors/${encodePath(id)}/series`,
      { ...mutationOptions('GET'), query: { from, to } });
  },

  async createSensor(body: SensorInput): Promise<Sensor> {
    return request<Sensor>('api/v1/telemetry/sensors', mutationOptions('POST', body));
  },

  async updateSensor(id: number, body: SensorInput): Promise<Sensor> {
    return request<Sensor>(`api/v1/telemetry/sensors/${encodePath(id)}`, mutationOptions('PUT', body));
  },

  async deleteSensor(id: number): Promise<{ id: number; code: string; readings_deleted: number }> {
    return request(`api/v1/telemetry/sensors/${encodePath(id)}`, mutationOptions('DELETE'));
  },

  /** Тревоги: расхождение с моделью, датчик молчит, вернулся в норму; open — только непринятые */
  async getTelemetryAlerts(open = false): Promise<TelemetryAlert[]> {
    return request<TelemetryAlert[]>('api/v1/telemetry/alerts', { ...mutationOptions('GET'), query: open ? { open: true } : {} });
  },

  async acknowledgeTelemetryAlert(id: number): Promise<{ id: number }> {
    return request(`api/v1/telemetry/alerts/${encodePath(id)}/ack`, mutationOptions('POST'));
  },

  /** Калибровка: потери напора между соседними датчиками давления, факт против модели */
  async getCalibration(): Promise<CalibrationResult> {
    return request<CalibrationResult>('api/v1/telemetry/calibration', mutationOptions('GET'));
  },

  /** Режим источников: граничные условия последнего расчёта против телеметрии */
  async getRegime(): Promise<RegimeResult> {
    return request<RegimeResult>('api/v1/telemetry/regime', mutationOptions('GET'));
  },

  /** Расчёт фрагмента по фактическому режиму (напоры и температура источника из телеметрии) — в очередь */
  async runRegime(fileid: number, tn: number | null): Promise<RegimeRunResult> {
    return request<RegimeRunResult>('api/v1/telemetry/regime/run', mutationOptions('POST', { fileid, tn }));
  },

  /** Баланс расхода по зонам между расходомерами: небаланс, ночной расход */
  async getFlowBalance(): Promise<BalanceResult> {
    return request<BalanceResult>('api/v1/telemetry/balance', mutationOptions('GET'));
  },

  /** Участки зоны баланса для карты */
  async getBalanceZoneGeometry(key: number): Promise<ZoneGeometry> {
    return request<ZoneGeometry>(`api/v1/telemetry/balance/zones/${encodePath(key)}/geometry`, mutationOptions('GET'));
  },

  /** Выгрузка ОДПУ: CSV или Excel, «время, код, значение» или «время, <код>, <код>…» */
  async importTelemetry(file: File): Promise<ImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return request<ImportResult>('api/v1/telemetry/import', mutationOptions('POST', form));
  },
};
