import { describe, expect, it } from 'vitest';
import { lineTypeCard, lineTypeLosses, lineTypeTitle, type LineTypeChangeResult } from '~/utils/lineTypes';

describe('lineTypes', () => {
  it('подписи типов, в том числе только распознаваемых', () => {
    expect(lineTypeTitle('damper')).toBe('Задвижка');
    expect(lineTypeTitle('elevator')).toBe('Элеватор');
    expect(lineTypeTitle('none')).toBe('Без карточки');
  });

  it('что удалит смена типа — по обеим трубам пары', () => {
    const r: LineTypeChangeResult = {
      line_id: 20, pair_line_id: 21, old_type: 'line', new_type: 'damper', old_label: '', new_label: '',
      lines: [
        { line_id: 20, old_kind: 'line', removed_cards: [{ table: 'heatpipesections', kind: 'line', id: 5 }], created_card: null },
        { line_id: 21, old_kind: 'line', removed_cards: [{ table: 'heatpipesections', kind: 'line', id: 6 }], created_card: null },
      ],
    };
    expect(lineTypeLosses(r)).toEqual([
      'карточка «Участок трубопровода» уч. 20 (№5) со всеми её значениями',
      'карточка «Участок трубопровода» уч. 21 (№6) со всеми её значениями',
    ]);
  });

  it('карточка нового типа: участок, оборудование; у диафрагмы — нет', () => {
    expect(lineTypeCard('line', 7)).toEqual({ kind: 'line', table: 'heatPipeSections', id: 7, title: 'Участок трубопровода: уч. 7' });
    expect(lineTypeCard('damper', 7)).toEqual({ kind: 'damper', table: 'dampers', id: 7, title: 'Задвижка: уч. 7' });
    expect(lineTypeCard('diaphragm', 7)).toBeNull();
  });
});
