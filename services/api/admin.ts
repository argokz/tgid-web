/** Пользователи, журнал действий, аудит. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { ActivityLogQuery, ActivityLogResponse, AdminCap, AdminRole, AdminUser, AdminUserUpdate, AdminUsersResponse, AuditLogFilter, AuditLogItem, AuditLogResponse, AuditLookups, PermissionsModel, UserRole } from './types';
import { cleanQuery, encodePath, mutationOptions, request } from './http';

export const adminApi = {
  /** Администрирование пользователей UsersDB (только admin) */
  async getAdminRoles(): Promise<{ items: AdminRole[]; caps?: AdminCap[]; backend?: string; model?: PermissionsModel }> {
    return request('api/v1/admin/roles', mutationOptions('GET'));
  },

  async getAdminUsers(): Promise<AdminUsersResponse> {
    return request<AdminUsersResponse>('api/v1/admin/users', mutationOptions('GET'));
  },

  async createAdminUser(body: {
    username: string;
    password: string;
    role: UserRole;
    /** null — все города */
    cities?: string[] | null;
  }): Promise<AdminUser> {
    return request<AdminUser>('api/v1/admin/users', mutationOptions('POST', body));
  },

  async updateAdminUser(userId: number | string, body: AdminUserUpdate): Promise<AdminUser> {
    return request<AdminUser>(`api/v1/admin/users/${encodePath(userId)}`, mutationOptions('PATCH', body));
  },

  async setAdminUserPassword(userId: number | string, password: string): Promise<{ success: boolean; id: number | string }> {
    return request(`api/v1/admin/users/${encodePath(userId)}/password`, mutationOptions('PUT', { password }));
  },

  /** Удалить пользователя UsersDB (пользователей PostgreSQL только блокируют) */
  async deleteAdminUser(userId: number | string): Promise<{ success: boolean; id: number | string }> {
    return request(`api/v1/admin/users/${encodePath(userId)}`, mutationOptions('DELETE'));
  },

  /** Журнал действий пользователей (activity_log): входы, правки, расчёты, выгрузки */
  async getActivityLog(query: ActivityLogQuery & { page?: number; page_size?: number } = {}): Promise<ActivityLogResponse> {
    return request<ActivityLogResponse>('api/v1/activity-log', { ...mutationOptions('GET'), query: cleanQuery(query) });
  },

  /** Журнал действий по фильтру — CSV для Excel */
  async downloadActivityLogCsv(query: ActivityLogQuery = {}): Promise<Blob> {
    return request<Blob>('api/v1/activity-log.csv', { ...mutationOptions('GET'), query: cleanQuery(query), responseType: 'blob' });
  },

  /** История правок audit_log с фильтрами */
  async getAuditLog(filter: AuditLogFilter = {}): Promise<AuditLogResponse> {
    const query: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined && value !== '') query[key] = value as string | number;
    }
    return request<AuditLogResponse>('api/v1/audit-log', { query });
  },

  async getAuditLogEntry(logId: number): Promise<AuditLogItem> {
    return request<AuditLogItem>(`api/v1/audit-log/${encodePath(logId)}`);
  },

  async getAuditLookups(): Promise<AuditLookups> {
    return request<AuditLookups>('api/v1/audit-log/lookups');
  },
};
