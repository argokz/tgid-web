import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import InspectorPanel from '~/components/InspectorPanel.vue';
import { useObjectCardLayout } from '~/composables/useObjectCardLayout';
import { mountWithVuetify } from './mountHelper';

const mountPanel = (props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) =>
  mountWithVuetify(InspectorPanel, {
    props: { modelValue: true, title: 'ТК-12', subtitle: '14 из 20 заполнено', icon: 'mdi-information-outline', ...props },
    slots: { default: () => h('div', { class: 'body' }, 'поля'), ...slots },
    global: { stubs: { VTooltip: false } },
  });

describe('InspectorPanel', () => {
  it('шапка: название, подпись, действия владельца, тело в прокручиваемом контейнере', () => {
    const w = mountPanel({}, { actions: () => h('button', { class: 'owner-action' }, 'Паспорт') });
    expect(w.find('.inspector__title').text()).toBe('ТК-12');
    expect(w.text()).toContain('14 из 20 заполнено');
    expect(w.find('.inspector__actions .owner-action').exists()).toBe(true);
    expect(w.find('.inspector__body .body').exists()).toBe(true);
    expect(w.find('[data-card-drag]').exists()).toBe(true);
  });

  it('закрытие: по умолчанию снимает modelValue, с manualClose — только событие close', async () => {
    const w = mountPanel();
    await w.find('button[aria-label="Закрыть"]').trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false]);

    const manual = mountPanel({ manualClose: true });
    await manual.find('button[aria-label="Закрыть"]').trigger('click');
    expect(manual.emitted('close')).toHaveLength(1);
    expect(manual.emitted('update:modelValue')).toBeUndefined();
  });

  it('режим панель / окно переключается кнопкой и помнится в useObjectCardLayout; на телефоне кнопки нет', async () => {
    const layout = useObjectCardLayout();
    layout.mode = 'panel';
    const w = mountPanel();
    await w.find('button[aria-label="Открепить в отдельное окно"]').trigger('click');
    expect(layout.mode).toBe('float');
    expect(w.find('button[aria-label="Закрепить панелью справа"]').exists()).toBe(true);
    layout.mode = 'panel';

    const mobile = mountPanel({ mobile: true });
    expect(mobile.find('button[aria-label="Открепить в отдельное окно"]').exists()).toBe(false);
  });

  it('поиск и вкладки: события update:search / update:tab, счётчики на вкладках', async () => {
    const w = mountPanel({
      searchable: true, search: '', searchCount: 3,
      tabs: [{ value: 0, label: 'Паспорт', count: 12 }, { value: 1, label: 'Расчёт', count: 4 }], tab: 0,
    });
    await w.find('input[type="search"]').setValue('диам');
    expect(w.emitted('update:search')?.at(-1)).toEqual(['диам']);
    const tabs = w.findAll('.inspector__tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[1].text()).toContain('Расчёт');
    expect(tabs[1].text()).toContain('4');
    await tabs[1].trigger('click');
    expect(w.emitted('update:tab')?.at(-1)).toEqual([1]);
  });

  it('окно браузера сузили — окно карточки показано в его пределах, сохранённое размещение не ужимается', async () => {
    const layout = useObjectCardLayout();
    layout.mode = 'float';
    Object.assign(layout.float, { x: 600, y: 100, w: 560, h: 640 });
    Object.assign(window, { innerWidth: 500, innerHeight: 400 });
    const w = mountPanel();
    window.dispatchEvent(new Event('resize'));
    await w.vm.$nextTick();
    const style = (w.find('.oc-shell').element as HTMLElement).style;
    expect([style.left, style.top, style.width, style.height]).toEqual(['8px', '8px', '484px', '384px']);
    expect(layout.float).toEqual({ x: 600, y: 100, w: 560, h: 640 });
    Object.assign(window, { innerWidth: 1280, innerHeight: 800 });
    window.dispatchEvent(new Event('resize'));
    await w.vm.$nextTick();
    expect(style.left).toBe('600px');
    w.unmount();
    layout.mode = 'panel';
  });
});
