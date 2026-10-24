import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import EditorContextMenu from '~/components/EditorContextMenu.vue';
import { useAuthStore } from '~/stores/authStore';
import { createTestPinia, mountWithVuetify } from './mountHelper';

/** v-menu телепортирует содержимое в body; здесь рендерим слот на месте */
const InlineMenu = defineComponent({
  name: 'VMenu',
  props: { modelValue: { type: Boolean, default: false } },
  setup(props, { slots }) {
    return () => (props.modelValue ? h('div', { class: 'v-menu-stub' }, slots.default?.()) : null);
  },
});

const menu = { kind: 'node' as const, id: 7, fragmentId: 74, lngLat: [76.9, 43.2] as [number, number], coords: [], clientX: 10, clientY: 10 };

describe('EditorContextMenu', () => {
  it('без прав пункты правки недоступны с пояснением, остаются читаемыми и не срабатывают; «Копировать координаты» работает', async () => {
    const pinia = createTestPinia();
    useAuthStore().$patch({ accessToken: '', role: '', authDisabled: false });
    const w = mountWithVuetify(EditorContextMenu, {
      props: { modelValue: true, menu },
      pinia,
      global: { stubs: { VMenu: InlineMenu } },
    });
    const items = w.findAll('.v-list-item');
    const byTitle = (t: string) => items.find((i) => i.text().includes(t))!;
    const trace = byTitle('Начать трассу отсюда');
    expect(trace.attributes('aria-disabled')).toBe('true');
    expect(trace.classes()).toContain('editor-context-menu__item--disabled');
    expect(trace.text()).toContain('Нет права: создавать участки');
    expect(trace.attributes('tabindex')).not.toBe('-1');
    await trace.trigger('click');
    expect(w.emitted('action')).toBeUndefined();

    const copy = byTitle('Копировать координаты');
    expect(copy.attributes('aria-disabled')).toBeUndefined();
    await copy.trigger('click');
    expect(w.emitted('action')).toEqual([['copy']]);
  });
});
