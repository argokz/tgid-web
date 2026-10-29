/** Отчёты, выгрузки, импорт, выборки, паспорта. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import { fastApiService } from '../fastApiService';
import type { NetworkImportInspect, NetworkImportMode, NetworkImportParams, NetworkImportReport } from '~/utils/networkImport';
import type { PassportHierarchyGroup, PassportOptions, PassportSite, RegimeAnalysisResult, ReportCatalogItem, ReportsCatalog } from './types';
import { REPORT_TIMEOUT_MS, buildApiUrl, encodePath, filenameFromDisposition, mutationOptions, parseExcelReportMeta, parseNetworkExportMeta, request, runFileJob } from './http';
import type { ExcelReportMeta, FileJobOptions, HeaderGetter, NetworkExportMeta } from './http';

export const reportsApi = {
  getFormReportUrl(formId: string, search?: string): string {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return buildApiUrl(`api/reports/html/${encodePath(formId)}${query}`);
  },

  async downloadWordReport(defectId: number): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`reports/word/defect/${encodePath(defectId)}`, {
      responseType: 'blob',
    });
    return { blob, filename: `defect_${defectId}.docx` };
  },

  async downloadOpsWordReport(
    journal: 'shurf' | 'osmotr' | 'remont' | 'opres',
    recordId: number
  ): Promise<{ blob: Blob; filename: string }> {
    const blob = await request<Blob>(`reports/word/${encodePath(journal)}/${encodePath(recordId)}`, {
      responseType: 'blob',
    });
    return { blob, filename: `${journal}_${recordId}.docx` };
  },

  /** Сеть фрагментов файлом ГИС: GeoPackage, FlatGeobuf (zip) или Shapefile (zip) — /api/export/network */
  async downloadNetworkExport(
    format: 'gpkg' | 'fgb' | 'shp',
    fragmentIds?: number[],
  ): Promise<{ blob: Blob; filename: string; meta?: NetworkExportMeta }> {
    let meta: NetworkExportMeta | undefined;
    let filename = '';
    const blob = await request<Blob>('api/export/network', {
      responseType: 'blob',
      query: { format, ...(fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {}) },
      timeout: REPORT_TIMEOUT_MS,
      onResponse({ response }: any) {
        if (!response?.headers?.get) return;
        meta = parseNetworkExportMeta((name) => response.headers.get(name));
        filename = filenameFromDisposition(response.headers.get('content-disposition')) ?? '';
      },
    });
    const suffix = fragmentIds?.length === 1 ? `_f${fragmentIds[0]}` : fragmentIds?.length ? '_frag' : '';
    return { blob, filename: filename || `network_export${suffix}.${format === 'gpkg' ? 'gpkg' : 'zip'}`, meta };
  },

  /**
   * DXF участков — фоновой задачей file-job с прогрессом (по фрагменту строится десятки секунд, QA F77);
   * без воркера — синхронный эндпоинт.
   */
  async downloadDxfExport(
    fragmentIds?: number[],
    options: FileJobOptions = {},
  ): Promise<{ blob: Blob; filename: string; meta?: NetworkExportMeta }> {
    let meta: NetworkExportMeta | undefined;
    const onHeaders = (get: HeaderGetter) => {
      meta = parseNetworkExportMeta(get);
    };
    const suffix = fragmentIds?.length === 1 ? `_f${fragmentIds[0]}` : fragmentIds?.length ? '_frag' : '';
    const sync = async () => ({
      blob: await request<Blob>('api/export/dxf', {
        responseType: 'blob',
        query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : undefined,
        timeout: REPORT_TIMEOUT_MS,
        onResponse({ response }: any) {
          if (response?.headers?.get) onHeaders((name) => response.headers.get(name));
        },
      }),
      filename: `network${suffix}.dxf`,
    });
    const params: Record<string, unknown> = fragmentIds?.length ? { fragments: fragmentIds } : {};
    const result = await runFileJob('network_dxf', params, sync, options, onHeaders);
    return { ...result, meta };
  },

  /**
   * GeoJSON участков (WGS84). withAttrs — «GeoJSON с атрибутами» (Sys, L, D, K_E — короткие имена
   * для загрузки в ZuluGIS/QGIS; раньше назывался «Zulu»-экспортом, API /api/export/zulugis — алиас).
   */
  async downloadGeoJsonExport(
    fragmentIds?: number[],
    withAttrs = false,
  ): Promise<{ blob: Blob; filename: string; meta?: NetworkExportMeta }> {
    let meta: NetworkExportMeta | undefined;
    const data = await request<unknown>(withAttrs ? 'api/export/geojson-attrs' : 'api/export/geojson', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(','), limit: 50000 } : { limit: 50000 },
      onResponse({ response }: any) {
        if (response?.headers?.get) meta = parseNetworkExportMeta((name) => response.headers.get(name));
      },
    });
    const blob = new Blob([JSON.stringify(data)], { type: 'application/geo+json' });
    const suffix = fragmentIds?.length === 1 ? `_f${fragmentIds[0]}` : fragmentIds?.length ? '_frag' : '';
    return { blob, filename: `network${withAttrs ? '_attrs' : ''}${suffix}.geojson`, meta };
  },

  /** Импорт (этап 10): разбор файла — колонки, образец, поля назначения, предложенное сопоставление */
  async inspectNetworkImport(
    files: File[],
    mode: NetworkImportMode,
    opts: { encoding?: string; sheet?: string; layer?: string } = {}
  ): Promise<NetworkImportInspect> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('mode', mode);
    if (opts.encoding) form.append('encoding', opts.encoding);
    if (opts.sheet) form.append('sheet', opts.sheet);
    if (opts.layer) form.append('layer', opts.layer);
    return request<NetworkImportInspect>('api/v1/import/inspect', mutationOptions('POST', form));
  },

  /** Превью (dryRun) или применение импорта; 422 row_errors — отчёт в detail.report */
  async runNetworkImport(files: File[], params: NetworkImportParams, dryRun: boolean): Promise<NetworkImportReport> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('params', JSON.stringify(params));
    form.append('dry_run', dryRun ? 'true' : 'false');
    return request<NetworkImportReport>('api/v1/import/run', mutationOptions('POST', form));
  },

  async getNetworkQueryVolume(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/volume', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  async getNetworkQueryLength(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/length', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  async getNetworkQueryLengthByDiameter(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/length-by-diameter', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  /** Zap3; system: closed — Zap4 (закрытые системы), open — Zap5 (открытые). */
  async getNetworkQueryHeatConsumption(fragmentIds?: number[], system?: 'closed' | 'open'): Promise<any> {
    return request('api/network-queries/heat-consumption', {
      query: {
        ...(fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {}),
        ...(system ? { system } : {}),
      },
    });
  },
  /** Zap6: закрытые (физически отключённые) потребители. */
  async getNetworkQueryClosedConsumers(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/closed-consumers', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },
  /** Zap7_1: длина по диаметрам и способам прокладки. */
  async getNetworkQueryLengthByDiameterLaying(fragmentIds?: number[]): Promise<any> {
    return request('api/network-queries/length-by-diameter-laying', {
      query: fragmentIds?.length ? { fragments: fragmentIds.join(',') } : {},
    });
  },

  async getAdmissibilityCatalog(): Promise<{ id: number; title: string; object: 'node' | 'line' }[]> {
    return request('api/analysis/admissibility');
  },
  async getAdmissibility(queryId: number, fragmentId: number, calculationId?: number): Promise<RegimeAnalysisResult> {
    return request<RegimeAnalysisResult>(`api/analysis/admissibility/${queryId}`, {
      query: { fragment_id: fragmentId, ...(calculationId ? { calculation_id: calculationId } : {}) },
    });
  },

  async getOcheredOpressovok(page = 1, pageSize = 50): Promise<any> {
    return request('api/ochered-opressovok', {
      query: { page, page_size: pageSize },
    });
  },

  /**
   * Сводная ведомость Excel. fragmentIds — отбор по фрагментам (как экспорт SHP/GeoJSON; пусто —
   * вся сеть). meta — полнота выгрузки из заголовков X-Report-* (ведомость не режется молча, QA F14).
   */
  async downloadExcelReport(
    docType: string,
    query?: Record<string, string | number | boolean | undefined | null>,
    options: FileJobOptions = {},
    fragmentIds?: number[],
  ): Promise<{ blob: Blob; filename: string; meta?: ExcelReportMeta }> {
    const year = query?.year;
    const frags = [...new Set((fragmentIds || []).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
    let suffix = year != null && year !== '' ? `_${year}` : '';
    if (frags.length) suffix += frags.length === 1 ? `_f${frags[0]}` : '_frag';
    let meta: ExcelReportMeta | undefined;
    const onHeaders = (get: HeaderGetter) => {
      meta = parseExcelReportMeta(get);
    };
    const sync = async () => ({
      blob: await request<Blob>(`api/reports/excel/${encodePath(docType)}`, {
        responseType: 'blob',
        query: frags.length ? { ...(query || {}), fragments: frags.join(',') } : query,
        timeout: REPORT_TIMEOUT_MS,
        onResponse({ response }: any) {
          if (response?.headers?.get) onHeaders((name) => response.headers.get(name));
        },
      }),
      filename: `report_${docType}${suffix}.xlsx`,
    });
    const params: Record<string, unknown> = { doc_type: docType, year: year != null && year !== '' ? Number(year) : null };
    if (frags.length) params.fragments = frags;
    const result = await runFileJob('report_excel', params, sync, options, onHeaders);
    return meta ? { ...result, meta } : result;
  },

  /** Каталог Excel-отчётов: отчёты десктопа gid6 (excel2) и сводные ведомости веба */
  async getReportsCatalog(): Promise<ReportsCatalog> {
    return request<ReportsCatalog>('api/reports/catalog');
  },

  /** Excel-отчёт десктопа по шаблону gid6: фрагмент обязателен, расчёт — последний, если не задан */
  async downloadCatalogReport(
    report: Pick<ReportCatalogItem, 'id' | 'title'>,
    params: { fragment_id: number; calculation_id?: number | null },
    options: FileJobOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const query: Record<string, number> = { fragment_id: params.fragment_id };
    if (params.calculation_id) query.calculation_id = params.calculation_id;
    const sync = async () => ({
      blob: await request<Blob>(`api/reports/catalog/${encodePath(report.id)}/excel`, {
        responseType: 'blob',
        query,
        timeout: REPORT_TIMEOUT_MS,
      }),
      filename: '',
    });
    const { blob } = await runFileJob(
      'catalog_report',
      { report_id: report.id, fragment_id: params.fragment_id, calculation_id: params.calculation_id || null },
      sync,
      options,
    );
    const safeTitle = report.title.replace(/[\\/:*?"<>|]+/g, ' ').trim();
    return { blob, filename: `${safeTitle} ф${params.fragment_id}.xlsx` };
  },

  async getPassportHierarchy(): Promise<PassportHierarchyGroup[]> {
    return request('api/passports/hierarchy');
  },

  async getPassportDiagnostics(): Promise<{
    ready_for_passport: boolean;
    blockers: string[];
    counts: Record<string, number>;
    remediation?: string[];
  }> {
    return request('api/passports/diagnostics');
  },

  async downloadPassport(
    msRs: PassportSite['ms_rs'],
    id: number,
    options: PassportOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    return fastApiService.downloadObjectPassport(`uchastok_${msRs}`, id, options);
  },

  async downloadObjectPassport(
    table: string,
    id: number,
    options: PassportOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const { fragments, ...jobOptions } = options;
    const frags = fragments?.length ? [...fragments] : null;
    const sync = async () => ({
      blob: await request<Blob>(`api/db/object/${encodePath(table)}/${encodePath(id)}`, {
        method: 'POST',
        responseType: 'blob',
        timeout: REPORT_TIMEOUT_MS,
        query: frags ? { fragments: frags.join(',') } : undefined,
      }),
      filename: `Passport_${table}_${id}.xlsx`,
    });
    // имя с сервера — по участку (Passport_ms_12.xlsx), даже если паспорт открыт по трубе/узлу
    return runFileJob('passport', { table, obj_id: id, ...(frags ? { fragments: frags } : {}) }, sync, jobOptions);
  },

  /**
   * Паспорта всех участков начальника участка (МС и/или РС) — ZIP: паспорт каждого участка в формате
   * десктопа и «Перечень участков.xlsx». Только фоном: десятки участков строятся минутами.
   */
  async downloadChiefPassports(
    nachId: number,
    kinds: ReadonlyArray<'ms' | 'rs'>,
    options: PassportOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const { fragments, ...jobOptions } = options;
    const params = { nach_id: nachId, kinds: [...kinds], ...(fragments?.length ? { fragments: [...fragments] } : {}) };
    return runFileJob('passport_chief', params, null, { timeoutMs: 60 * 60_000, ...jobOptions });
  },
};
