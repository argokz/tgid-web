import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import CommandPalette from '~/components/CommandPalette.vue';
import SearchField from '~/components/SearchField.vue';
import { useUiStore } from '~/stores/uiStore';
import { createTestPinia, mountWithVuetify } from './mountHelper';

vi.mock('~/composables/useNominatim', () => ({
  useNominatim: () => ({
    searchAddress: vi.fn(async (q: string) => (q.includes('Абая')
      ? [{ place_id: 1, display_name: 'проспект Абая, Алматы', lat: '43.24', lon: '76.93' }]
      : [])),
  }),
}));

vi.mock('~/composables/useLocateMarkers', () => ({
  useLocateMarkers: () => ({ locate: vi.fn(), remove: vi.fn(), clearAll: vi.fn(), has: () => false, handlers: {} }),
}));

const nodeFeature = (id: number, name: string) => ({ properties: { id, 'Наименование узла': name, 'Тип': 'ТК' } });

describe('CommandPalette', () => {
  beforeEach(() => {
    (globalThis as any).useRuntimeConfig = () => ({ public: { geoserver: { url: 'http://gs/geoserver', workspace: 'AlmatyGIS' } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => (url.includes('find_node') ? { features: [nodeFeature(5, 'ТК-5')] } : { features: [] }),
    })));
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('без запроса — действия и инструменты по правам; запрос фильтрует; стрелки и Enter выполняют', async () => {
    const pinia = createTestPinia();
    const ui = useUiStore();
    const request = vi.spyOn(ui, 'requestToolDialog');
    const w = mountWithVuetify(CommandPalette, { props: { modelValue: true }, pinia });
    await nextTick();
    const titles = () => w.findAll('.command-palette__title').map((n) => n.text());
    expect(titles()).toContain('Инструменты');
    expect(titles()).toContain('Нарушения');

    const search = w.findComponent(SearchField);
    await search.setValue('наруш');
    await nextTick();
    expect(titles()).toEqual(['Нарушения']);
    expect(w.find('.command-palette__item--active').text()).toContain('Нарушения');

    await w.find('.command-palette__card').trigger('keydown', { key: 'Enter' });
    expect(request).toHaveBeenCalledWith('defect');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false]);
  });

  it('после паузы ввода — узлы из WFS и адреса из геокодера; пустой результат — состояние «ничего не найдено»', async () => {
    const pinia = createTestPinia();
    const w = mountWithVuetify(CommandPalette, { props: { modelValue: true }, pinia });
    const vm = w.vm as any;
    await w.findComponent(SearchField).setValue('ТК-5 Абая');
    await vm.onSearch('ТК-5 Абая');
    await nextTick();
    const sections = vm.sections.map((s: any) => [s.kind, s.items.map((i: any) => i.title)]);
    expect(sections).toContainEqual(['node', ['ТК-5']]);
    expect(sections).toContainEqual(['address', ['проспект Абая, Алматы']]);

    await w.findComponent(SearchField).setValue('zzz');
    await vm.onSearch('zzz');
    (fetch as any).mockImplementationOnce(async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ features: [] }) }));
    await vm.onSearch('zzzz');
    await nextTick();
    expect(w.text()).toContain('Ничего не найдено');
  });

  it('недавние: выполненная команда появляется первой при следующем открытии', async () => {
    const pinia = createTestPinia();
    const w = mountWithVuetify(CommandPalette, { props: { modelValue: true }, pinia });
    await nextTick();
    const item = w.findAll('.command-palette__item').find((b) => b.text().includes('Измерения на карте'))!;
    await item.trigger('click');
    await w.setProps({ modelValue: false });
    await w.setProps({ modelValue: true });
    await nextTick();
    expect(w.find('.command-palette__section').text()).toBe('Недавние');
    expect(w.find('.command-palette__title').text()).toBe('Измерения на карте');
    expect(useUiStore().drawPanelOpen).toBe(true);
  });
});
