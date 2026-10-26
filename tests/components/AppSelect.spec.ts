import { describe, expect, it } from 'vitest';
import AppSelect from '~/components/AppSelect.vue';
import { mountWithVuetify } from './mountHelper';

const states = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Состояние ${i + 1}` }));
const sources = Array.from({ length: 99 }, (_, i) => ({ id: i + 1, name: `Источник ${i + 1}` }));

describe('AppSelect', () => {
  it('короткий список — v-select без поиска, длинный — v-autocomplete с поиском', () => {
    const short = mountWithVuetify(AppSelect, { props: { modelValue: null, items: states, itemTitle: 'name', itemValue: 'id', label: 'Состояние' } });
    expect((short.vm as any).searchable).toBe(false);
    expect(short.find('.v-select').exists()).toBe(true);
    expect(short.find('.v-autocomplete').exists()).toBe(false);

    const long = mountWithVuetify(AppSelect, { props: { modelValue: null, items: sources, itemTitle: 'name', itemValue: 'id', label: 'Источник тепла' } });
    expect((long.vm as any).searchable).toBe(true);
    expect(long.find('.v-autocomplete').exists()).toBe(true);
  });

  it('имя поля для читалок — подпись, а не «Открыть» от VSelect', () => {
    const w = mountWithVuetify(AppSelect, { props: { modelValue: null, items: states, itemTitle: 'name', itemValue: 'id', label: 'Состояние' } });
    const input = w.find('.v-select input');
    expect(input.attributes('aria-label')).toBe('Состояние');
    expect(input.attributes('title')).toBe('Состояние');
  });

  it('порог и принудительный режим поиска', () => {
    const w = mountWithVuetify(AppSelect, { props: { modelValue: null, items: states, searchThreshold: 3 } });
    expect((w.vm as any).searchable).toBe(true);
    const forced = mountWithVuetify(AppSelect, { props: { modelValue: null, items: sources, searchable: false } });
    expect((forced.vm as any).searchable).toBe(false);
  });

  it('выбранное значение видно, единицы и подсказка показываются, readonly не прячет значение', () => {
    const w = mountWithVuetify(AppSelect, {
      props: { modelValue: 2, items: states, itemTitle: 'name', itemValue: 'id', units: 'кгс/см²', hint: 'Из справочника состояний', readonly: true },
    });
    expect(w.text()).toContain('Состояние 2');
    expect(w.text()).toContain('кгс/см²');
    expect(w.text()).toContain('Из справочника состояний');
    expect(w.find('.app-select--readonly').exists()).toBe(true);
    // readonly — без кнопки очистки
    expect(w.find('.v-field__clearable').exists()).toBe(false);
  });

  it('«создать?» отдаёт введённый текст, когда совпадения нет', async () => {
    const w = mountWithVuetify(AppSelect, {
      props: { modelValue: null, items: sources, itemTitle: 'name', itemValue: 'id', allowCreate: true },
    });
    const input = w.find('input');
    await input.setValue('Котельная №7');
    await input.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('create')).toEqual([['Котельная №7']]);
    expect(w.emitted('search')?.at(-1)).toEqual(['Котельная №7']);
  });

  it('без allowCreate Enter по несовпадению ничего не создаёт', async () => {
    const w = mountWithVuetify(AppSelect, { props: { modelValue: null, items: sources, itemTitle: 'name', itemValue: 'id' } });
    const input = w.find('input');
    await input.setValue('нет такого');
    await input.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('create')).toBeUndefined();
  });
});
