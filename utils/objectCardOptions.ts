import type { CardOption } from '~/utils/objectCard';

/** Варианты списков окна свойств на время сеанса: «таблица|поле|фрагмент» → варианты */
export const cardOptionsCache = new Map<string, CardOption[]>();

/** Сбросить после правки справочников (и при смене данных города) */
export function clearCardOptionsCache(): void {
  cardOptionsCache.clear();
}
