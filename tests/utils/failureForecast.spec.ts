import { describe, expect, it } from 'vitest';
import {
  captureRows,
  pctText,
  PLAN_COLOR,
  PLAN_TOP_COLOR,
  planFrame,
  RISK_CLASSES,
  riskClass,
  riskFrame,
  validationText,
  type FailureMetrics,
  type FailureRun,
  type FailureTop,
  type RelayPlan,
} from '~/utils/failureForecast';

describe('прогноз аварийности', () => {
  it('riskClass: верхние 5 % — тёмные, дальше светлее', () => {
    expect(riskClass(0, 100)).toBe(RISK_CLASSES[0]);
    expect(riskClass(4, 100)).toBe(RISK_CLASSES[0]);
    expect(riskClass(5, 100)).toBe(RISK_CLASSES[1]);
    expect(riskClass(49, 100)).toBe(RISK_CLASSES[2]);
    expect(riskClass(99, 100)).toBe(RISK_CLASSES[3]);
  });

  it('riskFrame: цвет и толщина по месту в списке', () => {
    const line = (lineid: number): GeoJSON.Feature => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { lineid } });
    const top = { run_id: 1, items: Array.from({ length: 40 }, (_, i) => ({ lineid: i + 1 })), geojson: { type: 'FeatureCollection', features: [line(1), line(40)] } } as unknown as FailureTop;
    const f = riskFrame(top).features.map((x) => x.properties);
    expect(f[0]).toMatchObject({ color: RISK_CLASSES[0].color, width: 6 });
    expect(f[1]).toMatchObject({ color: RISK_CLASSES[3].color, width: 4 });
  });

  it('pctText и validationText', () => {
    expect(pctText(0.136)).toBe('13,6 %');
    expect(pctText(null)).toBe('—');
    const run = { horizon_years: 2, cutoffs: { train: '2020-01-01', test: '2022-01-01' },
      metrics: { top_share: 0.1, top_capture: 0.788, auc: 0.892, test: { events: 113 } } } as unknown as FailureRun;
    expect(validationText(run)).toBe('Модель, обученная на данных до 2020 г., на 2022–2023 гг. (их она не видела): '
      + '79 % из 113 повреждений пришлись на 10 % участков с наибольшим прогнозом; ROC-AUC 0,892.');
  });

  it('planFrame: первые 10 объектов — темнее и толще', () => {
    const f = (object: number): GeoJSON.Feature => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { object } });
    const plan = { geojson: { type: 'FeatureCollection', features: [f(1), f(11)] } } as unknown as RelayPlan;
    const props = planFrame(plan).features.map((x) => x.properties);
    expect(props[0]).toMatchObject({ color: PLAN_TOP_COLOR, width: 6 });
    expect(props[1]).toMatchObject({ color: PLAN_COLOR, width: 4 });
  });

  it('captureRows: по бюджетам в км', () => {
    const m = { capture_by_km: { model: { 1: 0.018, 5: 0.195 }, oldest_first: { 1: 0, 5: 0 }, near_defects: { 1: 0, 5: 0.035 } } } as unknown as FailureMetrics;
    expect(captureRows(m)).toEqual([
      { km: '1', model: 0.018, oldest: 0, near: 0 },
      { km: '5', model: 0.195, oldest: 0, near: 0.035 },
    ]);
    expect(captureRows({} as FailureMetrics)).toEqual([]);
  });
});
