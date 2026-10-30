import { describe, expect, it } from 'vitest';
import {
  choicesText,
  displayAnswer,
  fieldName,
  isRelevant,
  parseChoices,
  schemaProblems,
  validateAnswers,
  type FormSchema,
} from '~/utils/forms';

const CHAMBER: FormSchema = {
  fields: [
    { name: 'hatch', type: 'select_one', label: 'Люк', required: true,
      choices: [{ value: 'ok', label: 'Исправен' }, { value: 'broken', label: 'Повреждён' }] },
    { name: 'hatch_note', type: 'text', label: 'Что с люком', required: true,
      relevant: { field: 'hatch', op: '!=', value: 'ok' } },
    { name: 'water', type: 'acknowledge', label: 'Вода в камере' },
    { name: 'water_level', type: 'decimal', label: 'Уровень, см', min: 0, max: 300, required: true,
      relevant: { field: 'water', op: '=', value: '1' } },
    { name: 'signs', type: 'select_multiple', label: 'Признаки',
      choices: [{ value: 'steam', label: 'Пар' }, { value: 'leak', label: 'Течь' }] },
    { name: 'leak_where', type: 'text', label: 'Где течь', relevant: { field: 'signs', op: 'selected', value: 'leak' } },
    { name: 'temp', type: 'integer', label: 'Температура', min: -50, max: 120 },
    { name: 'info', type: 'note', label: 'Сфотографируйте' },
    { name: 'photo', type: 'image', label: 'Фото' },
  ],
};

describe('forms', () => {
  it('isRelevant: пока нет ответа — скрыто; =, !=, selected', () => {
    const [, note, , level, , leak] = CHAMBER.fields;
    expect(isRelevant(note, {})).toBe(false);
    expect(isRelevant(note, { hatch: 'ok' })).toBe(false);
    expect(isRelevant(note, { hatch: 'broken' })).toBe(true);
    expect(isRelevant(level, { water: true })).toBe(true);
    expect(isRelevant(leak, { signs: ['steam'] })).toBe(false);
    expect(isRelevant(leak, { signs: ['leak'] })).toBe(true);
  });

  it('validateAnswers как на сервере: скрытые отбрасываются, числа с запятой, порядок вариантов', () => {
    const { clean, errors } = validateAnswers(CHAMBER, {
      hatch: 'ok', hatch_note: 'скрыто', water: true, water_level: '12,5', signs: ['leak', 'steam'],
      leak_where: ' на подаче ', temp: 18, info: 'x', photo: ['p1'],
    });
    expect(errors).toEqual({});
    expect(clean).toEqual({ hatch: 'ok', water: true, water_level: 12.5, signs: ['steam', 'leak'], leak_where: 'на подаче',
      temp: 18, photo: ['p1'] });
    expect(validateAnswers(CHAMBER, { hatch: 'broken', water: true, water_level: 500, temp: 1.5 }).errors).toEqual({
      hatch_note: 'обязательное поле', water_level: 'не больше 300', temp: 'нужно целое число',
    });
    expect(validateAnswers(CHAMBER, {}).errors).toEqual({ hatch: 'обязательное поле' });
  });

  it('displayAnswer', () => {
    expect(displayAnswer(CHAMBER.fields[0], 'broken')).toBe('Повреждён');
    expect(displayAnswer(CHAMBER.fields[4], ['steam', 'leak'])).toBe('Пар, Течь');
    expect(displayAnswer(CHAMBER.fields[2], true)).toBe('да');
    expect(displayAnswer(CHAMBER.fields[8], ['a', 'b'])).toBe('фото: 2');
    expect(displayAnswer(CHAMBER.fields[6], undefined)).toBe('—');
  });

  it('fieldName и parseChoices: транслит, занятые имена, «значение = подпись»', () => {
    expect(fieldName('Уровень воды, см', [])).toBe('uroven_vody_sm');
    expect(fieldName('Уровень воды, см', ['uroven_vody_sm'])).toBe('uroven_vody_sm_2');
    expect(fieldName('5 задвижек', [])).toBe('f_5_zadvizhek');
    expect(fieldName('', [])).toBe('pole');
    const choices = parseChoices('ok = Исправен\nПовреждён\n\nНет люка\nok = Дубль');
    expect(choices).toEqual([
      { value: 'ok', label: 'Исправен' }, { value: 'povrezhden', label: 'Повреждён' },
      { value: 'net_lyuka', label: 'Нет люка' }, { value: 'dubl', label: 'Дубль' },
    ]);
    expect(parseChoices(choicesText(choices))).toEqual(choices);
  });

  it('schemaProblems', () => {
    expect(schemaProblems(CHAMBER)).toEqual([]);
    expect(schemaProblems({ fields: [] })).toEqual(['Добавьте хотя бы одно поле']);
    expect(schemaProblems({
      fields: [
        { name: 'Bad', type: 'text', label: 'x' },
        { name: 'a', type: 'select_one', label: 'y', choices: [] },
        { name: 'b', type: 'text', label: 'z', relevant: { field: 'c', op: '=', value: '1' } },
      ],
    })).toEqual(['«x»: имя поля — латиница, цифры и _, с буквы', '«y»: нет вариантов', '«z»: условие — по полю выше']);
  });
});
