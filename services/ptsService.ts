/**
 * Инструменты ПТС (этап 9): участки МС/РС и привязка к ним труб.
 * Сервер: itwin-api routers/pts.py — /api/v1/pts/*. Запись — editor+ и MUTATIONS_ENABLED.
 * Отмена привязки — groupSettersService.undo(change_group_id).
 */
import { fastApiService } from '~/services/fastApiService';
import type { GroupSetterApplyResult, GroupSetterPreview } from '~/services/groupSettersService';

export type SiteKind = 'ms' | 'rs';
export type CardFieldKind = 'int' | 'float' | 'str' | 'date' | 'datetime' | 'bool';

export interface PtsSiteItem {
  id: number;
  name: string | null;
  ue_id: number | null;
  ue_name: string | null;
  nach_id: number | null;
  nach_name: string | null;
  magistral_id: number | null;
  magistral_name: string | null;
  pipes: number;
  length: number;
}

export interface CardField {
  name: string;
  label: string;
  kind: CardFieldKind;
  max_length: number | null;
  group: string | null;
  ref: { table: string; id: string; label: string } | null;
}

export interface PtsSiteCard {
  kind: SiteKind;
  id: number;
  title: string;
  version: string;
  values: Record<string, unknown>;
  stats: { pipes: number; length: number; fragment_ids: number[] };
}

export interface PtsPipeLine {
  line_id: number;
  fragment_id: number | null;
  start_name: string | null;
  end_name: string | null;
  diameter: number | null;
  length: number | null;
  magistralsite: number | null;
  distsite: number | null;
}

export interface PtsPipes {
  lines: PtsPipeLine[];
  geojson: { type: 'FeatureCollection'; features: any[] };
  bbox: [number, number, number, number] | null;
}

export interface PtsChain extends PtsPipes {
  node_ids: number[];
  line_ids: number[];
  segments: Array<{ from: number; to: number; lines: number }>;
  other_lines: number;
}

export interface PtsPipesChange {
  action: 'assign' | 'unassign';
  line_ids?: number[];
  node_ids?: number[];
  all_pipes?: boolean;
}

export type PtsPipesPreview = GroupSetterPreview & { dry_run: true; line_ids: number[]; action: string };
export type PtsPipesResult = GroupSetterApplyResult & { dry_run: false; line_ids: number[]; action: string };

const req = fastApiService.request;
const enc = (v: string | number) => encodeURIComponent(String(v));
const base = 'api/v1/pts';

export const ptsService = {
  sites(kind: SiteKind): Promise<{ kind: SiteKind; title: string; items: PtsSiteItem[]; pipes_total: number }> {
    return req(`${base}/sites`, { query: { kind } });
  },

  fields(kind: SiteKind): Promise<{ kind: SiteKind; fields: CardField[] }> {
    return req(`${base}/sites/${kind}/fields`);
  },

  site(kind: SiteKind, id: number): Promise<PtsSiteCard> {
    return req(`${base}/sites/${kind}/${enc(id)}`);
  },

  pipes(kind: SiteKind, id: number): Promise<PtsPipes> {
    return req(`${base}/sites/${kind}/${enc(id)}/pipes`);
  },

  create(kind: SiteKind, fields: Record<string, unknown>): Promise<PtsSiteCard> {
    return req(`${base}/sites/${kind}`, { method: 'POST', body: { fields } });
  },

  update(kind: SiteKind, id: number, fields: Record<string, unknown>, version: string): Promise<{ site: PtsSiteCard }> {
    return req(`${base}/sites/${kind}/${enc(id)}`, { method: 'PUT', body: { fields, version } });
  },

  remove(kind: SiteKind, id: number, unassignPipes: boolean): Promise<{ deleted: boolean; unassigned: number }> {
    return req(`${base}/sites/${kind}/${enc(id)}`, { method: 'DELETE', query: { unassign_pipes: unassignPipes } });
  },

  chain(nodeIds: number[]): Promise<PtsChain> {
    return req(`${base}/chain`, { method: 'POST', body: { node_ids: nodeIds } });
  },

  previewPipes(kind: SiteKind, id: number, change: PtsPipesChange): Promise<PtsPipesPreview> {
    return req(`${base}/sites/${kind}/${enc(id)}/pipes`, { method: 'POST', body: { ...change, dry_run: true } });
  },

  applyPipes(kind: SiteKind, id: number, change: PtsPipesChange, expectedChanges: number): Promise<PtsPipesResult> {
    return req(`${base}/sites/${kind}/${enc(id)}/pipes`, {
      method: 'POST',
      body: { ...change, dry_run: false, expected_changes: expectedChanges },
    });
  },

  lookup(ref: NonNullable<CardField['ref']>): Promise<{ data: Array<{ value: number | string; title: string }> }> {
    return req('api/v1/lookup', { query: { table: ref.table, id_col: ref.id, name_col: ref.label } });
  },
};
