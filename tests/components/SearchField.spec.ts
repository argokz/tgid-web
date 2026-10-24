import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchField from '~/components/SearchField.vue';
import { mountWithVuetify } from './mountHelper';

describe('SearchField', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('modelValue обновляется сразу, search — после паузы ввода одним событием', async () => {
    const w = mountWithVuetify(SearchField, { props: { modelValue: '', debounce: 200 } });
    const input = w.find('input');
    await input.setValue('Т');
    await input.setValue('ТК');
    await input.setValue('ТК-1 ');
    expect(w.emitted('update:modelValue')?.map((e) => e[0])).toEqual(['Т', 'ТК', 'ТК-1 ']);
    expect(w.emitted('search')).toBeUndefined();
    vi.advanceTimersByTime(199);
    expect(w.emitted('search')).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(w.emitted('search')).toEqual([['ТК-1']]);
  });

  it('Enter ищет сразу, Esc очищает, повторный Esc отдаёт escape', async () => {
    const w = mountWithVuetify(SearchField, { props: { modelValue: 'камера' } });
    const input = w.find('input');
    await input.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('search')).toEqual([['камера']]);
    expect(w.emitted('enter')).toEqual([['камера']]);
    await input.trigger('keydown', { key: 'Escape' });
    expect(w.emitted('update:modelValue')).toEqual([['']]);
    expect(w.emitted('clear')).toHaveLength(1);
    expect(w.emitted('escape')).toBeUndefined();
    await w.setProps({ modelValue: '' });
    await input.trigger('keydown', { key: 'Escape' });
    expect(w.emitted('escape')).toHaveLength(1);
  });

  it('счётчик результатов: число, «ничего», без запроса не показывается', async () => {
    const w = mountWithVuetify(SearchField, { props: { modelValue: 'ТК', resultCount: 1234 } });
    expect(w.text()).toContain('1 234');
    await w.setProps({ resultCount: 0 });
    expect(w.text()).toContain('ничего');
    await w.setProps({ modelValue: '' });
    expect((w.vm as any).countLabel).toBe('');
  });

  it('доступность: type=search и подпись', () => {
    const w = mountWithVuetify(SearchField, { props: { modelValue: '', placeholder: 'Поиск по узлам' } });
    const input = w.find('input');
    expect(input.attributes('type')).toBe('search');
    expect(input.attributes('aria-label')).toBe('Поиск по узлам');
  });
});
