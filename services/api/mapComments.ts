/** Комментарии на карте (itwin-api routers/map_comments.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type {
  CommentPerson,
  CommentScope,
  CommentStatus,
  MapThread,
  MapThreadInput,
  MapThreadList,
} from '~/utils/mapComments';
import { encodePath, mutationOptions, request } from './http';

export const mapCommentsApi = {
  async getMapThreads(filters: { status?: CommentStatus; scope?: CommentScope; q?: string | null } = {}): Promise<MapThreadList> {
    const query: Record<string, string> = { status: filters.status ?? 'open', scope: filters.scope ?? 'all' };
    if (filters.q?.trim()) query.q = filters.q.trim();
    return request<MapThreadList>('api/v1/map-comments', { ...mutationOptions('GET'), query });
  },

  async getMapThreadsGeoJson(status: CommentStatus = 'open'): Promise<GeoJSON.FeatureCollection> {
    return request<GeoJSON.FeatureCollection>('api/v1/map-comments/geojson', { ...mutationOptions('GET'), query: { status } });
  },

  async getMapCommentsUnread(): Promise<{ unread: number }> {
    return request('api/v1/map-comments/unread', mutationOptions('GET'));
  },

  async getCommentPeople(): Promise<{ items: CommentPerson[] }> {
    return request('api/v1/map-comments/people');
  },

  /** Ветка с сообщениями; сервер отмечает её прочитанной */
  async getMapThread(id: number): Promise<MapThread> {
    return request<MapThread>(`api/v1/map-comments/${encodePath(id)}`, mutationOptions('GET'));
  },

  async createMapThread(body: MapThreadInput): Promise<MapThread> {
    return request<MapThread>('api/v1/map-comments', mutationOptions('POST', body));
  },

  async replyMapThread(id: number, body: string): Promise<MapThread> {
    return request<MapThread>(`api/v1/map-comments/${encodePath(id)}/comments`, mutationOptions('POST', { body }));
  },

  async setMapThreadResolved(id: number, resolved: boolean): Promise<MapThread> {
    return request<MapThread>(`api/v1/map-comments/${encodePath(id)}/${resolved ? 'resolve' : 'reopen'}`, mutationOptions('POST'));
  },

  async editMapComment(commentId: number, body: string): Promise<MapThread> {
    return request<MapThread>(`api/v1/map-comments/comments/${encodePath(commentId)}`, mutationOptions('PATCH', { body }));
  },

  /** Удалить сообщение; thread = null — это было последнее сообщение, ветки больше нет */
  async deleteMapComment(commentId: number): Promise<{ deleted: boolean; thread: MapThread | null }> {
    return request(`api/v1/map-comments/comments/${encodePath(commentId)}`, mutationOptions('DELETE'));
  },
};
