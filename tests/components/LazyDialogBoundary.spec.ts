import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick, ref } from 'vue';
import LazyDialogBoundary, { classifyBoundaryError } from '~/components/LazyDialogBoundary.vue';
import { useNotificationStore } from '~/stores/notificationStore';

/** Ребёнок падает при рендере, пока флаг взведён */
const broken = ref(true);
const Child = defineComponent({
  setup() {
    return () => {
      if (broken.value) throw new Error('Сломанный диалог');
      return h('div', { class: 'child' }, 'ok');
    };
  },
});

describe('LazyDialogBoundary', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    broken.value = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('ошибка рендера: ребёнок размонтирован, уведомление с «Повторить» монтирует заново', async () => {
    const notifications = useNotificationStore();
    const notify = vi.spyOn(notifications, 'notify');
    const w = mount(LazyDialogBoundary, { props: { name: 'Журнал нарушений' }, slots: { default: () => h(Child) } });
    await flushPromises();
    expect(w.find('.child').exists()).toBe(false);
    expect(w.emitted('error')).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
    const [level, text, action] = notify.mock.calls[0];
    expect(level).toBe('error');
    expect(text).toContain('Журнал нарушений');
    expect(action?.label).toBe('Повторить');

    broken.value = false;
    await action!.handler();
    await nextTick();
    expect(w.find('.child').text()).toBe('ok');
  });

  it('устаревший чанк после выкатки: предлагает обновить страницу', async () => {
    const notifications = useNotificationStore();
    const notify = vi.spyOn(notifications, 'notify');
    const Stale = defineComponent({ setup() { return () => { throw new Error('Failed to fetch dynamically imported module'); }; } });
    mount(LazyDialogBoundary, { props: { name: 'Насосы' }, slots: { default: () => h(Stale) } });
    await flushPromises();
    const [level, text, action] = notify.mock.calls[0];
    expect(level).toBe('warning');
    expect(text).toContain('обновлено на сервере');
    expect(action?.label).toBe('Обновить');
  });

  it('ошибка обработчика не снимает содержимое: правки живы, ошибка уходит дальше', async () => {
    const notifications = useNotificationStore();
    const notify = vi.spyOn(notifications, 'notify');
    const appErrors: unknown[] = [];
    const Clicky = defineComponent({
      setup() {
        return () => h('button', { class: 'boom', onClick: () => { throw new Error('обработчик'); } }, 'Сохранить');
      },
    });
    const w = mount(LazyDialogBoundary, {
      props: { name: 'Арматура' },
      slots: { default: () => h(Clicky) },
      global: { config: { errorHandler: (err) => { appErrors.push(err); } } },
    });
    await w.find('.boom').trigger('click');
    expect(w.find('.boom').exists()).toBe(true);
    expect(notify).not.toHaveBeenCalled();
    expect(appErrors).toHaveLength(1);
  });

  it('classifyBoundaryError: dev-тексты и prod-коды Vue', () => {
    expect(classifyBoundaryError('async component loader')).toBe('load');
    expect(classifyBoundaryError('https://vuejs.org/error-reference/#runtime-13')).toBe('load');
    expect(classifyBoundaryError('render function')).toBe('render');
    expect(classifyBoundaryError('https://vuejs.org/error-reference/#runtime-0')).toBe('render');
    expect(classifyBoundaryError('https://vuejs.org/error-reference/#runtime-m')).toBe('render');
    expect(classifyBoundaryError('component event handler')).toBe('pass');
    expect(classifyBoundaryError('https://vuejs.org/error-reference/#runtime-3')).toBe('pass');
  });
});
