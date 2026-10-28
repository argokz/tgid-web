/** Ядро: запросы, фоновые выгрузки, задачи, состояние API. Часть fastApiService (services/fastApiService.ts собирает разделы). */
import { encodePath, mutationOptions, request, runFileJob } from './http';
import type { FileJobKind, FileJobOptions, FileJobStatus } from './http';

export const coreApi = {
  request,

  /** Фоновая выгрузка файла: задача → статус → скачивание (см. runFileJob) */
  runFileJob(
    kind: FileJobKind,
    params: Record<string, unknown>,
    options: FileJobOptions = {},
  ): Promise<{ blob: Blob; filename: string }> {
    return runFileJob(kind, params, null, options);
  },
  async startFileJob(kind: FileJobKind, params: Record<string, unknown>): Promise<{ task_id: string }> {
    return request('api/v1/file-jobs', mutationOptions('POST', { kind, params }));
  },
  async getFileJobStatus(taskId: string): Promise<FileJobStatus> {
    return request(`api/v1/file-jobs/${encodePath(taskId)}`);
  },

  async postRunSetyCmd(params: string): Promise<any> {
    return request('run-sety-cmd', mutationOptions('POST', { params }));
  },

  async getTaskStatus(taskId: string): Promise<any> {
    return request(`task/${encodePath(taskId)}`);
  },

  async getHealth(): Promise<{
    status: string;
    routes: number;
    database: { ok: boolean; latency_ms?: number; error?: string | null };
    redis?: { ok: boolean; latency_ms?: number; error?: string | null; note?: string | null };
    flags?: Record<string, boolean>;
  }> {
    return request('health');
  },
};
