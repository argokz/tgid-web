import { beforeEach, describe, expect, it, vi } from 'vitest';

const created: any[] = [];

vi.mock('maplibre-gl', () => {
  class Popup {
    text = '';
    constructor(public opts: any) {}
    setText(t: string) { this.text = t; return this; }
  }
  class Marker {
    lngLat: any = null;
    popup: any = null;
    map: any = null;
    removed = false;
    popupOpen = false;
    constructor(public opts: any) { created.push(this); }
    setLngLat(v: any) { this.lngLat = v; return this; }
    setPopup(p: any) { this.popup = p; return this; }
    addTo(m: any) { this.map = m; return this; }
    togglePopup() { this.popupOpen = !this.popupOpen; return this; }
    remove() { this.removed = true; return this; }
  }
  return { default: { Marker, Popup } };
});

import { useLocateMarkers } from '~/composables/useLocateMarkers';

const makeMap = () => ({ flyTo: vi.fn() });

describe('useLocateMarkers', () => {
  beforeEach(() => { created.length = 0; });

  it('перелетает к точке и ставит маркер с подсказкой', () => {
    const map = makeMap();
    const lm = useLocateMarkers(() => map as any);
    lm.locate('defect', { longitude: 76.9, latitude: 43.2, id: 7 }, {
      zoom: 18, color: '#e65100', popupText: (p) => `Нарушение ${p.id}`,
    });
    expect(map.flyTo).toHaveBeenCalledWith({ center: [76.9, 43.2], zoom: 18, duration: 1400, essential: true });
    expect(created).toHaveLength(1);
    expect(created[0].opts).toEqual({ color: '#e65100' });
    expect(created[0].lngLat).toEqual([76.9, 43.2]);
    expect(created[0].popup.text).toBe('Нарушение 7');
    expect(created[0].popupOpen).toBe(true);
    expect(created[0].map).toBe(map);
  });

  it('повторный locate в тот же слот снимает прежний маркер, другие слоты не трогает', () => {
    const map = makeMap();
    const lm = useLocateMarkers(() => map as any);
    const spec = { zoom: 16, color: '#000' };
    lm.locate('a', { longitude: 1, latitude: 2 }, spec);
    lm.locate('b', { longitude: 3, latitude: 4 }, spec);
    lm.locate('a', { longitude: 5, latitude: 6 }, spec);
    expect(created.map((m) => m.removed)).toEqual([true, false, false]);
    lm.clearAll();
    expect(created.every((m) => m.removed)).toBe(true);
    expect(lm.has('a')).toBe(false);
  });

  it('понимает { lat, lng } и собственный элемент маркера без попапа', () => {
    const map = makeMap();
    const lm = useLocateMarkers(() => map as any);
    const el = document.createElement('div');
    const h = lm.handlers({ fault: { zoom: 18, element: () => el } });
    h.fault({ lat: 43.25, lng: 76.95 });
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [76.95, 43.25], zoom: 18 }));
    expect(created[0].opts).toEqual({ element: el });
    expect(created[0].popup).toBeNull();
  });

  it('без карты или без координат ничего не делает', () => {
    const lm = useLocateMarkers(() => null);
    expect(lm.locate('x', { longitude: 1, latitude: 2 }, { zoom: 10 })).toBeNull();
    const map = makeMap();
    const lm2 = useLocateMarkers(() => map as any);
    expect(lm2.locate('x', { lat: null, lng: 76 }, { zoom: 10 })).toBeNull();
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it('syncLayerId синхронизирует выделение с 3D-видом до перелёта', () => {
    const map = makeMap();
    const onSync = vi.fn();
    const lm = useLocateMarkers(() => map as any, { onSync });
    lm.locate('diaphragm', { longitude: 1, latitude: 2, id: 5, label: 'Д-5' }, {
      zoom: 19, color: '#004d40', syncLayerId: 'diaphragms', popupText: (p) => p.label || `Диафрагма №${p.id}`,
    });
    expect(onSync).toHaveBeenCalledWith({ id: 5, longitude: 1, latitude: 2, label: 'Д-5', layerId: 'diaphragms' });
    expect(onSync.mock.invocationCallOrder[0]).toBeLessThan(map.flyTo.mock.invocationCallOrder[0]);
    expect(created[0].popup.text).toBe('Д-5');
  });
});
