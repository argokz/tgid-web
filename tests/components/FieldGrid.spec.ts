import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import FieldGrid from '~/components/FieldGrid.vue';
import FieldCell from '~/components/FieldCell.vue';
import { fieldLabel } from '~/utils/fieldGrid';
import { mountWithVuetify } from './mountHelper';

const Form = defineComponent({
  props: { labelPosition: { type: String, default: 'top' }, columns: { type: [String, Number], default: 'auto' } },
  setup(props) {
    return () => h(FieldGrid, { labelPosition: props.labelPosition as any, columns: props.columns as any }, () => [
      h(FieldCell, { label: 'Давление', units: 'кгс/см²', required: true, hint: 'Давление в подающем трубопроводе' }, {
        default: ({ id }: { id: string }) => h('input', { id, value: '6,5' }),
      }),
      h(FieldCell, { label: 'Примечание', span: true, dirty: true, error: 'Не больше 255 символов' }, {
        default: ({ id, errorId, invalid }: { id: string; errorId?: string; invalid: boolean }) => h('textarea', { id, 'aria-describedby': errorId, 'aria-invalid': invalid ? 'true' : undefined }),
      }),
      h(FieldCell, { label: 'Только чтение', readonly: true }, { default: () => h('input') }),
    ]);
  },
});

describe('FieldGrid / FieldCell', () => {
  it('подпись связана с полем по id, обязательность, единицы, подсказка и ошибка на месте', () => {
    const w = mountWithVuetify(Form, { global: { stubs: { VTooltip: false } } });
    const cells = w.findAll('.field-cell');
    expect(cells).toHaveLength(3);
    const first = cells[0];
    const label = first.find('label');
    const input = first.find('input');
    expect(label.attributes('for')).toBe(input.attributes('id'));
    expect(label.text()).toContain('Давление');
    expect(first.find('.field-cell__required').exists()).toBe(true);
    expect(first.find('.field-cell__units').text()).toBe('кгс/см²');
    expect(first.find('button.field-cell__hint').attributes('aria-label')).toBe('Подсказка: Давление в подающем трубопроводе');
    expect(first.find('label').text()).not.toContain('Подсказка');
    const second = cells[1];
    expect(second.classes()).toContain('field-cell--span');
    expect(second.classes()).toContain('field-cell--dirty');
    expect(second.find('[role="alert"]').text()).toBe('Не больше 255 символов');
    expect(second.find('[role="alert"]').attributes('id')).toBe(second.find('textarea').attributes('aria-describedby'));
    expect(second.find('textarea').attributes('aria-invalid')).toBe('true');
    expect(cells[2].classes()).toContain('field-cell--readonly');
  });

  it('положение подписи наследуется от сетки', () => {
    const top = mountWithVuetify(Form);
    expect(top.find('.field-cell').classes()).toContain('field-cell--label-top');
    const inline = mountWithVuetify(Form, { props: { labelPosition: 'inline', columns: 2 } });
    expect(inline.find('.field-cell').classes()).toContain('field-cell--label-inline');
    expect(inline.find('.field-grid').classes()).toContain('field-grid--2');
  });

  it('fieldLabel добавляет звёздочку обязательным', () => {
    expect(fieldLabel('Дата', true)).toBe('Дата *');
    expect(fieldLabel('Дата', false)).toBe('Дата');
  });
});
