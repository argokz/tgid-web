import { describe, expect, it } from 'vitest';
import { ARCGIS_LAYERS, featureServerUrl, qgisHeader, withToken } from '~/utils/arcgisClient';

describe('подключение ArcGIS и QGIS', () => {
  it('адрес сервиса — абсолютный и за префиксом nginx', () => {
    expect(featureServerUrl('/tgid/almaty/map-api', 'https://gis.example'))
      .toBe('https://gis.example/tgid/almaty/map-api/api/arcgis/rest/services/TGID/FeatureServer');
    expect(featureServerUrl('http://127.0.0.1:8049/', 'http://localhost:3077'))
      .toBe('http://127.0.0.1:8049/api/arcgis/rest/services/TGID/FeatureServer');
  });

  it('ключ — параметром token (экранированным) или заголовком для QGIS', () => {
    expect(withToken('https://x/FeatureServer', 'a.b+c')).toBe('https://x/FeatureServer?token=a.b%2Bc');
    expect(withToken('https://x/FeatureServer/0/query?f=json', 't')).toBe('https://x/FeatureServer/0/query?f=json&token=t');
    expect(qgisHeader('t')).toBe('Authorization: Bearer t');
    expect(ARCGIS_LAYERS).toHaveLength(5);
  });
});
