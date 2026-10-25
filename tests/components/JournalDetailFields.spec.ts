import { describe, expect, it } from 'vitest';
import JournalDetailFields, { type JournalDetailGroup } from '~/components/JournalDetailFields.vue';
import { mountWithVuetify } from './mountHelper';

const groups: JournalDetailGroup[] = [
  {
    title: 'Основное',
    fields: [
      { label: 'Название', value: 'ТК-1', key: 'name', type: 'text' },
      { label: 'Состояние', value: 'План', key: 'state_id', type: 'select', items: [{ id: 1, name: 'План' }, { id: 2, name: 'В работе' }] },
      { label: 'Адрес', value: 'Абая 1', type: 'text' },
      { label: 'Примечание', value: '—', key: 'note', type: 'textarea' },
    ],
  },
];

describe('JournalDetailFields', () => {
  it('просмотр: значения под подписями, поля только для чтения', () => {
    const w = mountWithVuetify(JournalDetailFields, {
      props: { groups, model: {}, editable: () => false, isFieldDirty: () => false },
    });
    expect(w.findAll('.field-cell')).toHaveLength(4);
    expect(w.findAll('.field-cell--readonly')).toHaveLength(4);
    expect(w.text()).toContain('ТК-1');
    expect(w.findAll('input')).toHaveLength(0);
  });

  it('правка: записываемые поля становятся полями ввода, изменение уходит через update:field, точка «изменено»', async () => {
    const model = { name: 'ТК-1', state_id: 1, note: '' };
    const w = mountWithVuetify(JournalDetailFields, {
      props: {
        groups,
        model,
        editable: (key?: string | null) => key === 'name' || key === 'note' || key === 'state_id',
        isFieldDirty: (key?: string | null) => key === 'name',
        requiredKeys: ['name'],
      },
    });
    const cells = w.findAll('.field-cell');
    expect(cells[0].classes()).toContain('field-cell--dirty');
    expect(cells[0].find('.field-cell__required').exists()).toBe(true);
    // звёздочка только у записываемого поля в правке
    expect(cells[2].find('.field-cell__required').exists()).toBe(false);
    expect(cells[2].classes()).toContain('field-cell--readonly');
    expect(cells[3].classes()).toContain('field-cell--span');
    const input = cells[0].find('input');
    expect(input.attributes('id')).toBe(cells[0].find('label').attributes('for'));
    await input.setValue('ТК-2');
    expect(w.emitted('update:field')?.at(-1)).toEqual(['name', 'ТК-2']);
    expect(w.find('textarea').exists()).toBe(true);
  });
});
