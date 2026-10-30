/**
 * Клиент API ТГИД. Разделы — в services/api/*: ядро запросов (http.ts), типы (types.ts) и методы
 * по темам; здесь они собираются в прежний объект fastApiService, вызовы в компонентах не меняются.
 */
export * from './api/types';
export { ApiError, apiHealth, describeExcelReportTruncation, describeFileJobProgress, describeNetworkExportTruncation, formatTopologyBlockers, formatVersionConflict, parseExcelReportMeta, parseNetworkExportMeta, refreshApiHealth, setUnauthorizedHandler } from './api/http';
export type { ExcelReportMeta, FileJobKind, FileJobOptions, FileJobProgress, FileJobStatus, NetworkExportMeta } from './api/http';
import { coreApi } from './api/core';
import { authApi } from './api/auth';
import { fragmentsApi } from './api/fragments';
import { piezometerApi } from './api/piezometer';
import { topologyApi } from './api/topology';
import { journalsApi } from './api/journals';
import { equipmentApi } from './api/equipment';
import { cardsApi } from './api/cards';
import { translationsApi } from './api/translations';
import { calcApi } from './api/calc';
import { adminApi } from './api/admin';
import { reportsApi } from './api/reports';
import { workOrdersApi } from './api/workOrders';
import { outagesApi } from './api/outages';
import { mapCommentsApi } from './api/mapComments';
import { kpiApi } from './api/kpi';
import { embedApi } from './api/embed';
import { poiApi } from './api/poi';
import { webhooksApi } from './api/webhooks';
import { formsApi } from './api/forms';

export const fastApiService = {
  ...coreApi,
  ...authApi,
  ...fragmentsApi,
  ...piezometerApi,
  ...topologyApi,
  ...journalsApi,
  ...equipmentApi,
  ...cardsApi,
  ...translationsApi,
  ...calcApi,
  ...adminApi,
  ...reportsApi,
  ...workOrdersApi,
  ...outagesApi,
  ...mapCommentsApi,
  ...kpiApi,
  ...embedApi,
  ...poiApi,
  ...webhooksApi,
  ...formsApi,
};
