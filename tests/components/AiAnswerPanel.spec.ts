import { describe, it, expect } from 'vitest';
import AiAnswerPanel from '~/components/ai/AiAnswerPanel.vue';
import type { ProtocolExplanation, ProtocolRegulator } from '~/services/aiService';
import { mountWithVuetify, flushPromises } from './mountHelper';

const answer: ProtocolExplanation = {
  summary: 'Расчёт сошёлся, но код РС не найден.',
  root_causes: [
    {
      category: 'rs', title: 'Код РС 7', why: 'нет в справочнике', action: 'добавить код', fix: 'rs',
      objects: [{ kind: 'node', id: 535303, label: 'РС1 ТЭЦ-1' }],
    },
    {
      category: 'regulator', title: 'Недобор напора', why: 'получено 49.66 вместо 59', action: 'проверить насос', fix: 'object',
      objects: [{ kind: 'line2', id1: 535330, id2: 535330, label: 'РД-22А' }],
    },
  ],
  regulators_note: 'Все регуляторы на одной магистрали.',
  next_run: [{ flag: '-rd_old', reason: 'сравнить со старой моделью' }],
  data_quality: ['Коды РС не согласованы'],
};

const regulators: ProtocolRegulator[] = [
  { seq: 1, kind: 'РД', label: 'РД-22А', objects: [{ kind: 'node', id: 535330, label: 'узел' }], setpoint: 59, actual: 49.66, flow: 69.96, deficit: 9.34, state: 'недобор напора', severity: 'warning', count: 1 },
  { seq: 2, kind: 'РД', label: 'РД-13', objects: [], setpoint: 33, actual: 38.9, flow: null, deficit: -5.9, state: 'перебор напора', severity: 'warning', count: 1 },
];

describe('AiAnswerPanel', () => {
  it('показывает сводку, причины, регуляторы и флаги; объекты и fix отдаёт наружу', async () => {
    const w = mountWithVuetify(AiAnswerPanel, {
      props: { answer, regulators, cached: true, categoryLabels: { rs: 'Расчётные схемы (РС)' } },
    });
    await flushPromises();
    const text = w.text();
    expect(text).toContain('Расчёт сошёлся');
    expect(text).toContain('Расчётные схемы (РС)');
    expect(text).toContain('из кеша');
    expect(text).toContain('-rd_old');
    expect(text).toContain('Коды РС не согласованы');
    expect(text).toContain('Все регуляторы на одной магистрали');
    // таблица регуляторов: недобор со знаком «−», перебор — «+»
    const rows = w.findAll('.ai-regs tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('−9,34');
    expect(rows[1].text()).toContain('+5,9');
    expect(rows[1].text()).toContain('—'); // расход неизвестен

    await w.find('.ai-cause__objects .v-chip').trigger('click');
    expect(w.emitted('object')?.[0]?.[0]).toEqual({ kind: 'node', id: 535303, label: 'РС1 ТЭЦ-1' });

    const fixButtons = w.findAll('.ai-cause__objects button');
    expect(fixButtons[0].text()).toContain('Расчётная схема');
    await fixButtons[0].trigger('click');
    expect(w.emitted('fix')?.[0]?.[0]).toMatchObject({ category: 'rs' });

    await rows[0].trigger('click');
    expect(w.emitted('object')?.[1]?.[0]).toEqual({ kind: 'node', id: 535330, label: 'узел' });
    w.unmount();
  });

  it('в состоянии загрузки и ошибки не показывает ответ', async () => {
    const w = mountWithVuetify(AiAnswerPanel, { props: { answer: null, loading: true } });
    await flushPromises();
    expect(w.text()).toContain('разбирает протокол');
    await w.setProps({ loading: false, error: 'Помощник ИИ выключен (AI_ENABLED)' });
    expect(w.find('.ai-panel__error').text()).toContain('AI_ENABLED');
    expect(w.find('.ai-panel__summary').exists()).toBe(false);
    w.unmount();
  });
});
