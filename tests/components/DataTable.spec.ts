import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import DataTable from '~/components/DataTable.vue';
import { mountWithVuetify } from './mountHelper';

const columns = [
  { key: 'id', title: 'ID', type: 'number' as const, width: 80 },
  { key: 'name', title: 'Название' },
  { key: 'du', title: 'Ду, мм', type: 'number' as const },
  { key: 'actions', title: '', type: 'actions' as const },
];
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Запись ${i + 1}`, du: (i + 1) * 50 }));

describe('DataTable', () => {
  it('рендерит колонки из описания, числа — вправо с tabular-nums, actions — без сортировки', () => {
    const w = mountWithVuetify(DataTable, { props: { columns, items: rows(3) } });
    expect(w.findAll('thead th').map((th) => th.text())).toEqual(['ID', 'Название', 'Ду, мм', '']);
    const firstRowCells = w.findAll('tbody tr')[0].findAll('td');
    expect(firstRowCells[0].classes()).toContain('data-table__num');
    expect(firstRowCells[1].classes()).not.toContain('data-table__num');
    expect(w.findAll('thead th')[3].classes().some((c) => c.includes('sortable'))).toBe(false);
    expect((w.vm as any).virtual).toBe(false);
  });

  it('сортировка по заголовку работает без привязки sortBy у родителя', async () => {
    const w = mountWithVuetify(DataTable, { props: { columns, items: [{ id: 1, name: 'Б', du: 50 }, { id: 2, name: 'А', du: 100 }] } });
    const nameHeader = w.findAll('thead th')[1];
    await nameHeader.trigger('click');
    expect(w.findAll('tbody tr').map((tr) => tr.findAll('td')[1].text())).toEqual(['А', 'Б']);
    expect(w.emitted('update:sortBy')?.[0]?.[0]).toEqual([{ key: 'name', order: 'asc' }]);
  });

  it('виртуализация включается от virtualFrom строк', () => {
    const w = mountWithVuetify(DataTable, { props: { columns, items: rows(250), virtualFrom: 200 } });
    expect((w.vm as any).virtual).toBe(true);
    expect(w.find('.v-table--fixed-header').exists()).toBe(true);
  });

  it('клик по строке при selectable отдаёт запись и подсвечивает выбранную', async () => {
    const w = mountWithVuetify(DataTable, { props: { columns, items: rows(3), selectable: true, selectedKey: 2 } });
    const trs = w.findAll('tbody tr');
    expect(trs[1].classes()).toContain('data-table__row--selected');
    expect(trs[1].attributes('aria-selected')).toBe('true');
    await trs[2].trigger('click');
    expect(w.emitted('select')?.[0]?.[0]).toMatchObject({ id: 3 });
    // клавиатура: строка в табе, Enter выбирает
    expect(trs[0].attributes('tabindex')).toBe('0');
    await trs[0].trigger('keydown', { key: 'Enter' });
    expect(w.emitted('select')?.[1]?.[0]).toMatchObject({ id: 1 });
  });

  it('без selectable клик ничего не отдаёт, строки не в табе; пустая таблица — текст', async () => {
    const w = mountWithVuetify(DataTable, { props: { columns, items: rows(1) } });
    await w.findAll('tbody tr')[0].trigger('click');
    expect(w.emitted('select')).toBeUndefined();
    expect(w.findAll('tbody tr')[0].attributes('tabindex')).toBeUndefined();
    const empty = mountWithVuetify(DataTable, { props: { columns, items: [], noDataText: 'Диафрагм нет' } });
    expect(empty.text()).toContain('Диафрагм нет');
  });

  it('только что сохранённая строка (flashKey) подсвечивается отдельно от выбранной', async () => {
    const w = mountWithVuetify(DataTable, { props: { columns, items: rows(3), selectedKey: 1, flashKey: 3 } });
    const trs = w.findAll('tbody tr');
    expect(trs[2].classes()).toContain('motion-row-flash');
    expect(trs[2].classes()).not.toContain('data-table__row--selected');
    expect(trs[0].classes()).not.toContain('motion-row-flash');
    await w.setProps({ flashKey: null });
    expect(w.findAll('tbody tr')[2].classes()).not.toContain('motion-row-flash');
  });

  describe('перерисовка родителя (S3b)', () => {
    /** Родитель на render-функции, как v-dialog / v-card: слоты без признака стабильности — Vue обновляет DataTable */
    const mountHost = () => {
      const tick = ref(0);
      const suffix = ref('');
      const items = ref(rows(3));
      let slotCalls = 0;
      const Host = defineComponent({
        setup: () => () => h('div', { 'data-tick': tick.value }, [
          h(DataTable, { columns, items: items.value, class: 'host-table' }, {
            'item.name': ({ item }: { item: Record<string, unknown> }) => {
              slotCalls += 1;
              return `${item.name}${suffix.value}`;
            },
          }),
        ]),
      });
      const w = mountWithVuetify(Host);
      return { w, tick, suffix, items, calls: () => slotCalls };
    };

    it('строки не перерисовываются, если у таблицы ничего не поменялось', async () => {
      const { w, tick, calls } = mountHost();
      const before = calls();
      expect(before).toBe(3);
      tick.value += 1;
      await nextTick();
      expect(w.find('[data-tick="1"]').exists()).toBe(true);
      expect(calls()).toBe(before);
    });

    it('ячейка следит за состоянием, которое читает слот, и за новыми строками; класс родителя — на таблице', async () => {
      const { w, suffix, items } = mountHost();
      expect(w.find('.v-table.host-table.data-table').exists()).toBe(true);
      suffix.value = ' (изм.)';
      await nextTick();
      expect(w.findAll('tbody tr')[0].findAll('td')[1].text()).toBe('Запись 1 (изм.)');
      items.value = rows(5);
      await nextTick();
      expect(w.findAll('tbody tr')).toHaveLength(5);
    });
  });
});
