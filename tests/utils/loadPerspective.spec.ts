import { describe, expect, it } from 'vitest';
import { checkText, droppedText } from '~/utils/loadPerspective';

describe('loadPerspective', () => {
  it('checkText — период, прогноз против факта и ошибка со знаком', () => {
    expect(checkText({
      cutoff: '2019-01-01', years: [2019, 2020, 2021, 2022, 2023], predicted: [], actual: [],
      predicted_total: 502.7, actual_total: 479.8, error_share: 0.048,
    })).toBe('2019–2023: прогноз 503 против фактических 480 Гкал/ч (+4,8 %)');
    expect(checkText(null)).toBe('нет данных для проверки');
  });

  it('droppedText — причины по убыванию', () => {
    expect(droppedText({ 'нет даты выдачи': 190, 'нет прироста нагрузки': 1169 }))
      .toBe('нет прироста нагрузки — 1 169; нет даты выдачи — 190');
  });
});
