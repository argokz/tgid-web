import { describe, expect, it } from 'vitest';
import type { ReportCatalogItem } from '~/services/fastApiService';
import { TOOL_GROUPS } from '~/utils/toolCatalog';
import { resolveMdiSvgPath } from '~/utils/mdiSvgPaths';
import { groupReports, matchesReport, reportNeedsFragment } from '~/utils/reportsCatalog';

const item = (patch: Partial<ReportCatalogItem>): ReportCatalogItem => ({
  id: 'gut',
  title: 'Участки',
  group: 'Исходные данные',
  kind: 'desktop',
  desktop: 'excel2/Участки.lst',
  note: null,
  uses_calculation: false,
  params: { fragment_id: 'required', calculation_id: null },
  sheets: [{ title: 'Вх.Участки', sql: 'vh_uchastki' }],
  ...patch,
});

const catalog: ReportCatalogItem[] = [
  item({ id: 'ut', title: 'Участки теплопроводов', group: 'Сводные ведомости', kind: 'summary', desktop: null,
    params: { fragment_id: null, calculation_id: null } }),
  item({}),
  item({ id: 'out_pt', title: 'Потребители', group: 'Результаты расчёта', uses_calculation: true,
    desktop: 'excel2/OUT_Потребители.lst',
    params: { fragment_id: 'required', calculation_id: 'optional' },
    sheets: [{ title: 'Тепло', sql: 'out_pt_teplo' }, { title: 'Отключенные', sql: 'out_pt_otklyuchennye' }] }),
  item({ id: 'hs', title: 'Система теплоснабжения', group: 'Система теплоснабжения',
    desktop: 'excel2/HS_Система теплоснабжения.lst', sheets: [{ title: 'Вх.Организации_владельцы', sql: 'vh_organizacii' }] }),
];

describe('каталог Excel-отчётов', () => {
  it('группирует в порядке: результаты, исходные, система, сводные', () => {
    expect(groupReports(catalog).map((g) => g.title)).toEqual([
      'Результаты расчёта', 'Исходные данные', 'Система теплоснабжения', 'Сводные ведомости',
    ]);
  });

  it('ищет по названию, листам и источнику десктопа, без учёта регистра и ё', () => {
    expect(groupReports(catalog, 'участки').flatMap((g) => g.items.map((i) => i.id))).toEqual(['gut', 'ut']);
    expect(matchesReport(catalog[2], 'отключенные')).toBe(true);
    expect(matchesReport(catalog[1], 'excel2 участки.lst')).toBe(true);
    expect(matchesReport(catalog[1], 'насос')).toBe(false);
    expect(matchesReport(item({ title: 'Отчёт' }), 'отчет')).toBe(true);
    expect(groupReports(catalog, 'нет такого')).toEqual([]);
  });

  it('фрагмент обязателен только для отчётов десктопа', () => {
    expect(reportNeedsFragment(catalog[1])).toBe(true);
    expect(reportNeedsFragment(catalog[0])).toBe(false);
    expect(reportNeedsFragment(null)).toBe(false);
  });

  it('пункт «Отчёты Excel» есть в панели инструментов и его иконка разрешается', () => {
    const tool = TOOL_GROUPS.flatMap((g) => g.items).find((t) => t.event === 'open-excel-reports');
    expect(tool).toBeTruthy();
    expect(resolveMdiSvgPath(tool!.icon)).toBeTruthy();
    for (const icon of ['mdi-file-excel', 'mdi-magnify', 'mdi-download', 'mdi-calculator', 'mdi-close']) {
      expect(resolveMdiSvgPath(icon), icon).toBeTruthy();
    }
  });
});
