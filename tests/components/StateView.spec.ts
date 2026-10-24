import { describe, expect, it } from 'vitest';
import StateView from '~/components/StateView.vue';
import { mountWithVuetify, findButton } from './mountHelper';

const mountState = (props: Record<string, unknown>, slot = '<table class="data">данные</table>') =>
  mountWithVuetify(StateView, { props, slots: { default: slot } });

describe('StateView: четыре состояния', () => {
  it('данные — рендерит слот без обёрток состояний', () => {
    const w = mountState({});
    expect(w.find('table.data').exists()).toBe(true);
    expect(w.find('.v-skeleton-loader').exists()).toBe(false);
    expect(w.find('.v-empty-state').exists()).toBe(false);
    expect((w.vm as any).state).toBe('ready');
  });

  it('загрузка — скелетон формы данных, слот скрыт', () => {
    const w = mountState({ loading: true, variant: 'table', rows: 12 });
    const skeleton = w.find('.v-skeleton-loader');
    expect(skeleton.exists()).toBe(true);
    expect(skeleton.attributes('role')).toBe('status');
    expect(w.find('table.data').exists()).toBe(false);
    expect((w.vm as any).state).toBe('loading');
  });

  it('пусто — заголовок, пояснение и кнопка действия', async () => {
    const w = mountState({ empty: true, emptyTitle: 'Диафрагм нет', emptyText: 'Измените фильтры', actionLabel: 'Сбросить фильтры' });
    expect(w.text()).toContain('Диафрагм нет');
    expect(w.text()).toContain('Измените фильтры');
    await findButton(w, 'Сбросить фильтры').trigger('click');
    expect(w.emitted('action')).toHaveLength(1);
    expect(w.find('table.data').exists()).toBe(false);
  });

  it('ошибка важнее загрузки и пустоты: текст причины и «Повторить»', async () => {
    const w = mountState({ loading: true, empty: true, error: 'Сервер API недоступен' });
    expect((w.vm as any).state).toBe('error');
    expect(w.find('[role="alert"]').exists()).toBe(true);
    expect(w.text()).toContain('Сервер API недоступен');
    await findButton(w, 'Повторить').trigger('click');
    expect(w.emitted('retry')).toHaveLength(1);
  });

  it('без retry кнопки «Повторить» нет', () => {
    const w = mountState({ error: 'ошибка', retry: false });
    expect(w.findAll('button').some((b) => b.text().includes('Повторить'))).toBe(false);
  });
});
