/** Вход, выход, профиль. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { ServerPermissions } from '~/utils/permissions';
import type { CityItem } from './types';
import { mutationOptions, request } from './http';

export const authApi = {
  async login(
    username: string,
    password: string,
    role?: string
  ): Promise<{
    access_token: string;
    token_type: string;
    role: string;
    username: string;
  }> {
    const body: Record<string, string> = { username, password };
    if (role) body.role = role;
    return request('api/v1/auth/login', {
      method: 'POST',
      body,
    });
  },

  async getAuthConfig(): Promise<{
    auth_disabled: boolean;
    /** Без входа данные карты не отдаются — показать форму входа сразу */
    auth_required_get?: boolean;
    dev_login_enabled: boolean;
    strict_auth: boolean;
    mutations_enabled: boolean;
    topology_mutations_enabled: boolean;
    /** Город этого API (код и название) */
    city?: string;
    city_label?: string;
    /** Помощник ИИ включён на сервере (AI_ENABLED + ключ) */
    ai_enabled?: boolean;
  }> {
    return request('api/v1/auth/config');
  },

  async authMe(): Promise<{
    sub: string;
    username: string;
    role: string;
    mutations_enabled: boolean;
    topology_mutations_enabled: boolean;
    auth_disabled: boolean;
    dev_login_enabled?: boolean;
    strict_auth?: boolean;
    /** AUTH_BACKEND=pg: профиль пользователя-роли PostgreSQL (docs/pg-auth.md) */
    auth_backend?: string;
    display_name?: string | null;
    caps?: string[];
    fragments?: number[] | null;
    must_change_password?: boolean;
    /** Мастер-учётка владельца (MASTER_LOGIN): пароль меняется только на сервере */
    is_master?: boolean;
    /** Город этого API и города, доступные пользователю */
    city?: string;
    city_label?: string;
    cities?: CityItem[];
    all_cities?: boolean;
    /** действующие права: шаблон роли + отличия пользователя (itwin-api permissions.py) */
    permissions?: ServerPermissions;
    role_label?: string;
  }> {
    return request('api/v1/auth/me', mutationOptions('GET'));
  },

  /** Выход: сервер удаляет cookie доступа к GeoServer */
  async logout(): Promise<{ success: boolean }> {
    return request('api/v1/auth/logout', { method: 'POST' });
  },

  /** Смена своего пароля (UsersDB или роль PostgreSQL — тогда тот же пароль у десктопа) */
  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return request('api/v1/auth/password', mutationOptions('POST', {
      current_password: currentPassword,
      new_password: newPassword,
    }));
  },
};
