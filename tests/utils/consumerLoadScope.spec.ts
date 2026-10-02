import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSUMER_LOAD_FILTERS, consumerLoadFiltersForScope } from '~/utils/consumerLoadScope';

describe('consumerLoadFiltersForScope (QA F20, F78)', () => {
  const stale = { diagnostic: 'zero_load' as const, search: 'Абай', fragment_id: 74, state_id: 2 };

  it('из карточки узла: без фильтра «Нулевая нагрузка», поиск по узлу, старые фильтры сброшены', () => {
    expect(consumerLoadFiltersForScope(stale, { nodeId: 535475 })).toEqual({
      diagnostic: undefined,
      consumer_type: undefined,
      search: '535475',
    });
  });

  it('из карточки потребителя: поиск по id и тип потребителя, старый search не остаётся', () => {
    const next = consumerLoadFiltersForScope(stale, { consumerType: 'real', consumerId: 1201 });
    expect(next).toEqual({ diagnostic: undefined, consumer_type: 'real', search: '1201' });
    expect(next.fragment_id).toBeUndefined();
  });

  it('явный вид диагностики из вызова сохраняется', () => {
    expect(consumerLoadFiltersForScope(stale, { nodeId: 7, diagnostic: 'closed' }).diagnostic).toBe('closed');
  });

  it('без объекта — фильтры пользователя как были', () => {
    expect(consumerLoadFiltersForScope(stale)).toEqual(stale);
    expect(consumerLoadFiltersForScope({ ...DEFAULT_CONSUMER_LOAD_FILTERS }, { diagnostic: 'disconnected' })).toEqual({
      diagnostic: 'disconnected',
    });
  });
});
