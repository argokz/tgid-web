/** Ключи встраиваемых карт (itwin-api routers/embed.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { EmbedKeyInput, EmbedKeyRow } from '~/utils/embedProtocol';
import { encodePath, mutationOptions, request } from './http';

export const embedApi = {
  async getEmbedKeys(): Promise<EmbedKeyRow[]> {
    return request<EmbedKeyRow[]>('api/v1/embed/keys', mutationOptions('GET'));
  },

  /** Новый ключ: сам ключ (key) — только в этом ответе */
  async createEmbedKey(body: EmbedKeyInput): Promise<EmbedKeyRow> {
    return request<EmbedKeyRow>('api/v1/embed/keys', mutationOptions('POST', body));
  },

  async revokeEmbedKey(id: number): Promise<EmbedKeyRow> {
    return request<EmbedKeyRow>(`api/v1/embed/keys/${encodePath(id)}`, mutationOptions('DELETE'));
  },
};
