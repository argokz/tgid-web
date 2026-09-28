import { mount, flushPromises, type ComponentMountingOptions } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createVuetify } from 'vuetify';
import { defineComponent, h, type Component } from 'vue';

/**
 * v-dialog телепортирует содержимое в body и анимирует; в тестах рендерим
 * слот на месте, пока modelValue истинно — проверяем логику, а не оверлей.
 */
const InlineDialog = defineComponent({
  name: 'VDialog',
  props: { modelValue: { type: Boolean, default: false } },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    return () =>
      props.modelValue
        ? h('div', { class: 'v-dialog-stub' }, slots.default?.({ isActive: { value: true }, close: () => emit('update:modelValue', false) }))
        : null;
  },
});

export function createTestPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

export function mountWithVuetify<T extends Component>(
  component: T,
  options: ComponentMountingOptions<any> & { pinia?: Pinia } = {},
) {
  const pinia = options.pinia ?? createTestPinia();
  const vuetify = createVuetify();
  const { pinia: _p, global, ...rest } = options;
  return mount(component as any, {
    attachTo: document.body,
    ...rest,
    global: {
      ...global,
      plugins: [vuetify, pinia, ...(global?.plugins ?? [])],
      stubs: { VDialog: InlineDialog, VTooltip: true, ...(global?.stubs ?? {}) },
    },
  });
}

/** Найти кнопку по тексту (v-btn рендерит <button>) */
export function findButton(wrapper: ReturnType<typeof mount>, text: string | RegExp) {
  const btn = wrapper.findAll('button').find((b) => (typeof text === 'string' ? b.text().includes(text) : text.test(b.text())));
  if (!btn) throw new Error(`Кнопка «${text}» не найдена. Есть: ${wrapper.findAll('button').map((b) => b.text()).join(' | ')}`);
  return btn;
}

export { flushPromises };
