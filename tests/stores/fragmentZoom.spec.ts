import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const api = vi.hoisted(() => ({ getFragmentsExtent: vi.fn() }));
vi.mock('~/services/fastApiService', () => ({ fastApiService: api }));
const map = vi.hoisted(() => ({ fitBounds: vi.fn() }));
vi.mock('~/stores/mapStore', () => ({ useMapStore: () => ({ map }) }));

import { useFragmentStore } from '~/stores/fragmentStore';

describe('fragmentStore.zoomToFragments («Домой», выбор фрагментов)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('есть охват — карта идёт к нему, true', async () => {
    api.getFragmentsExtent.mockResolvedValue({ fragments: [3252, 3255], bbox: [37.46, 55.55, 39.58, 55.76] });
    expect(await useFragmentStore().zoomToFragments([3252, 3255])).toBe(true);
    expect(api.getFragmentsExtent).toHaveBeenCalledWith([3252, 3255]);
    expect(map.fitBounds).toHaveBeenCalledWith([[37.46, 55.55], [39.58, 55.76]], expect.objectContaining({ padding: 60 }));
  });

  it('охвата нет или ошибка — false, карта не двигается (вызывающий решит, куда)', async () => {
    api.getFragmentsExtent.mockResolvedValue({ fragments: [5], bbox: null });
    expect(await useFragmentStore().zoomToFragments([5])).toBe(false);
    api.getFragmentsExtent.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await useFragmentStore().zoomToFragments([5])).toBe(false);
    expect(map.fitBounds).not.toHaveBeenCalled();
  });
});
