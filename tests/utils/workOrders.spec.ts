import { describe, expect, it } from 'vitest';
import {
  STATUS_META,
  STATUS_ORDER,
  formatDateTime,
  fromInputDateTime,
  isForward,
  mapFeatures,
  placeText,
  toInputDateTime,
  transitionLabel,
} from '~/utils/workOrders';

describe('workOrders: наряды', () => {
  it('подписи переходов по направлению', () => {
    expect(transitionLabel('new', 'assigned')).toBe('Назначить');
    expect(transitionLabel('assigned', 'in_progress')).toBe('Начать работу');
    expect(transitionLabel('done', 'in_progress')).toBe('Вернуть в работу');
    expect(transitionLabel('in_progress', 'assigned')).toBe('Вернуть в назначенные');
    expect(transitionLabel('assigned', 'new')).toBe('Вернуть в заявки');
    expect(transitionLabel('cancelled', 'new')).toBe('Открыть снова');
    expect(transitionLabel('done', 'closed')).toBe('Принять и закрыть');
    expect(transitionLabel('new', 'cancelled')).toBe('Отменить');
  });

  it('вперёд по цепочке — основная кнопка; отмена и возвраты — нет', () => {
    expect(isForward('new', 'assigned')).toBe(true);
    expect(isForward('in_progress', 'done')).toBe(true);
    expect(isForward('done', 'in_progress')).toBe(false);
    expect(isForward('assigned', 'cancelled')).toBe(false);
    expect(isForward('cancelled', 'new')).toBe(true);
    expect(STATUS_ORDER.every((s) => STATUS_META[s].mapColor.startsWith('#'))).toBe(true);
  });

  it('даты: поле ввода ↔ ISO, пустые и неверные', () => {
    const iso = fromInputDateTime('2026-11-01T18:30');
    expect(iso).not.toBeNull();
    expect(toInputDateTime(iso)).toBe('2026-11-01T18:30');
    expect(fromInputDateTime('')).toBeNull();
    expect(toInputDateTime(null)).toBe('');
    expect(toInputDateTime('мусор')).toBe('');
    expect(formatDateTime(iso)).toBe('01.11.2026 18:30');
    expect(formatDateTime(null)).toBe('—');
  });

  it('место работ и точки для карты', () => {
    expect(placeText({ defect_id: 4853, line_id: 77, node_id: null, fileid: 3179 })).toBe('дефект №4853 · участок 77 · фр. 3179');
    expect(placeText({ defect_id: null, line_id: null, node_id: null, fileid: null })).toBe('место не указано');
    const fc = mapFeatures({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [71.5, 51.1] }, properties: { id: 1, status: 'in_progress' } },
    ] });
    expect(fc.features[0]!.properties).toEqual({ id: 1, status: 'in_progress', color: STATUS_META.in_progress.mapColor });
  });
});
