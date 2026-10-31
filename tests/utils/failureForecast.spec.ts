import { describe, expect, it } from 'vitest';
import { pctText, RISK_CLASSES, riskClass, riskFrame, validationText, type FailureRun, type FailureTop } from '~/utils/failureForecast';

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
});
