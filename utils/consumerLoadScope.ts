import type { ConsumerLoadDiagnosticKind, ConsumerLoadType } from '~/services/fastApiService';

export interface ConsumerLoadFilters {
  diagnostic?: ConsumerLoadDiagnosticKind;
  consumer_type?: ConsumerLoadType;
  fragment_id?: number;
  state_id?: number;
  search?: string;
}

export interface ConsumerLoadScope {
  consumerType?: ConsumerLoadType;
  consumerId?: number;
  nodeId?: number;
  diagnostic?: ConsumerLoadDiagnosticKind;
}

/** Фильтры журнала при открытии без объекта (из меню инструментов) */
export const DEFAULT_CONSUMER_LOAD_FILTERS: Readonly<ConsumerLoadFilters> = { diagnostic: 'zero_load' };

/**
 * Фильтры «Диагностики нагрузки» при открытии (QA F20, F78). Из карточки узла/потребителя
 * журнал ищет именно этот объект: вид диагностики не задан (иначе потребитель с нагрузкой
 * не попадает в «Нулевую нагрузку»), прежние поиск, фрагмент и состояние сбрасываются.
 * Без объекта — прежние фильтры пользователя, вид диагностики — если передан явно.
 */
export const consumerLoadFiltersForScope = (
  current: ConsumerLoadFilters,
  scope: ConsumerLoadScope = {},
): ConsumerLoadFilters => {
  const consumerId = scope.consumerType && scope.consumerId ? scope.consumerId : null;
  if (consumerId || scope.nodeId) {
    return {
      diagnostic: scope.diagnostic,
      consumer_type: consumerId ? scope.consumerType : undefined,
      search: String(consumerId ?? scope.nodeId),
    };
  }
  return scope.diagnostic ? { ...current, diagnostic: scope.diagnostic } : { ...current };
};
