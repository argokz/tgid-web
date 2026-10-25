import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick, ref } from 'vue';
import LazyDialogBoundary from '~/components/LazyDialogBoundary.vue';
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
});
