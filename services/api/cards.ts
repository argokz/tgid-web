/** Карточки объектов: свойства, шаблоны, групповые правки. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { CardBatchPreview, CardChange, CardEditData, CardHelper, CardKind, CardNeighbor, CardOption, CardTemplate, CardValues, NodeEquipment } from '~/utils/objectCard';
import { encodePath, mutationOptions, mutationWithFallback, request } from './http';

export const cardsApi = {
  async createObject(table: string, fields: Record<string, any>): Promise<any> {
    const safeTable = encodePath(table);
    return mutationWithFallback(
      `api/v1/create/${safeTable}`,
      `create/${safeTable}`,
      mutationOptions('POST', { fields })
    );
  },

  async updateObjectAttributes(
    table: string,
    id: string | number,
    fields: Record<string, any>
  ): Promise<any> {
    const safeTable = encodePath(table);
    const safeId = encodePath(id);
    return mutationWithFallback(
      `api/v1/update/${safeTable}/${safeId}`,
      `update/${safeTable}/${safeId}`,
      mutationOptions('PUT', { fields })
    );
  },

  /** Окно свойств: карточка объекта сети для правки (поля, списки, версии строк, правила видимости) */
  async getCardEdit(kind: CardKind, table: string, id: number): Promise<CardEditData> {
    return request(`api/v1/card-edit/${encodePath(kind)}/${encodePath(table)}/${encodePath(id)}`);
  },

  /** Оборудование узла: примыкающее к узлу и во внутренней схеме (задвижки, регуляторы, насосы…) */
  async getNodeEquipment(nodeId: number): Promise<NodeEquipment> {
    return request(`api/v1/card-edit/equipment-at/${encodePath(nodeId)}`);
  },

  /** Варианты выпадающего списка поля — как в карточке десктопа */
  async getCardOptions(params: { table: string; field: string; fileid?: number | null; row_id?: number | null; q?: string }):
    Promise<{ source: 'list' | 'sql' | 'table'; items: CardOption[] }> {
    const query: Record<string, string | number> = { table: params.table, field: params.field };
    if (params.fileid) query.fileid = params.fileid;
    if (params.row_id) query.row_id = params.row_id;
    if (params.q) query.q = params.q;
    return request('api/v1/card-edit/options', { query });
  },

  /** Окно-помощник поля, как функция десктопа (сортамент труб, справочная таблица, местные сопротивления) */
  async getCardHelper(params: { table: string; field: string; standard_id?: number | null }): Promise<CardHelper> {
    const query: Record<string, string | number> = { table: params.table, field: params.field };
    if (params.standard_id) query.standard_id = params.standard_id;
    return request('api/v1/card-edit/helper', { query });
  },

  /** Зависимые поля после выбора значения (магистраль / участок МС / участок РС) */
  async getCardAfter(params: { table: string; field: string; value: unknown }):
    Promise<{ set: Record<string, { value: unknown; title: string | null }> }> {
    const query: Record<string, string | number> = { table: params.table, field: params.field };
    if (params.value !== null && params.value !== undefined && params.value !== '') query.value = String(params.value);
    return request('api/v1/card-edit/after', { query });
  },

  /** Карточка нескольких участков: значения сведены по колонкам («разные») */
  async getCardBatch(ids: number[], kind: CardKind = 'line'): Promise<CardEditData> {
    return request('api/v1/card-edit/batch/card', { method: 'POST', body: { ids, kind } });
  },

  /** Предпросмотр правки нескольких участков */
  async previewCardBatch(body: { kind?: CardKind; ids: number[]; changes: CardChange[] }): Promise<CardBatchPreview> {
    return request('api/v1/card-edit/batch/preview', mutationOptions('POST', body));
  },

  /** Применить правку нескольких участков (отмена — group-setters/undo по change_group_id) */
  async applyCardBatch(body: { kind?: CardKind; ids: number[]; changes: CardChange[]; expected_changes?: number }):
    Promise<{ changed: number; applied: Record<string, number>; change_group_id: string | null }> {
    return request('api/v1/card-edit/batch/apply', mutationOptions('POST', body));
  },

  /** «Как у соседнего»: значения конструктива смежного участка по колонкам карточки */
  async getCardNeighbor(kind: CardKind, id: number): Promise<CardNeighbor> {
    return request(`api/v1/card-edit/neighbor/${kind}/${encodePath(id)}`);
  },

  /** Шаблоны свойств: свои и общие */
  async listCardTemplates(kind: CardKind = 'line'): Promise<{ items: CardTemplate[] }> {
    return request('api/v1/card-templates', { query: { kind } });
  },

  async createCardTemplate(body: { kind: CardKind; name: string; values: CardValues; shared: boolean }): Promise<CardTemplate> {
    return request('api/v1/card-templates', mutationOptions('POST', body));
  },

  async deleteCardTemplate(id: number): Promise<{ deleted: number }> {
    return request(`api/v1/card-templates/${encodePath(id)}`, mutationOptions('DELETE'));
  },

  /** Применить шаблон к участкам (новым или выбранным); отмена — group-setters/undo */
  async applyCardTemplate(id: number, body: { ids: number[]; expected_changes?: number }):
    Promise<{ changed: number; change_group_id: string | null; template: { id: number; name: string } }> {
    return request(`api/v1/card-templates/${encodePath(id)}/apply`, mutationOptions('POST', body));
  },

  /** Сохранить изменения карточки (одна транзакция; версия строки изменилась — 409) */
  async saveCardEdit(body: { changes: CardChange[]; versions: Record<string, string>; dry_run?: boolean }):
    Promise<{
      rows: { table: string; key: number; changed: Record<string, { old: unknown; new: unknown }>; version: string }[];
      /** операция журнала отмены (Ctrl+Z, «Отменить», «История»); нет — журнал не установлен */
      operation_id?: number | null;
    }> {
    return request('api/v1/card-edit', mutationOptions('PUT', body));
  },

  async deleteObject(table: string, id: string | number): Promise<any> {
    const safeTable = encodePath(table);
    const safeId = encodePath(id);
    return mutationWithFallback(
      `api/v1/delete/${safeTable}/${safeId}`,
      `delete/${safeTable}/${safeId}`,
      mutationOptions('DELETE')
    );
  },

  formatAttributeValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    return String(value);
  },
};
