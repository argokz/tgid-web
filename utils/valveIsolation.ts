/**
 * Локализация отключения (mincut, фаза 1): подписи причин и порядок задвижек для бригады.
 * Расчёт — в API (database/outage_simulation.py classify_valves).
 */
import type { ValveIsolationReason, ValveToClose } from '~/services/api/types';

export const VALVE_REASON_LABELS: Record<ValveIsolationReason, { label: string; hint: string; color: string }> = {
  supply: {
    label: 'обязательна',
    hint: 'За задвижкой после отключения остаётся питание — без неё зону не отсечь',
    color: 'error',
  },
  no_supply: {
    label: 'можно не закрывать',
    hint: 'За задвижкой питания нет (тупик ниже зоны): вода в зону не придёт. Закрыть — чтобы не сливать системы потребителей',
    color: 'grey',
  },
  inside_zone: {
    label: 'в зоне',
    hint: 'Задвижка на аварийном участке или между узлами зоны — зону не ограничивает',
    color: 'grey',
  },
};

/** Ответ старого API без разметки считаем обязательным — так было до mincut */
export const isRequiredValve = (v: ValveToClose): boolean => v.required !== false;

/** Сначала обязательные, внутри — по id: бригада идёт сверху вниз */
export function sortValvesForCrew(valves: readonly ValveToClose[]): ValveToClose[] {
  return [...valves].sort((a, b) => Number(isRequiredValve(b)) - Number(isRequiredValve(a)) || a.id - b.id);
}
