/** Глава «Электронная модель» схемы теплоснабжения (itwin-api routers/em_chapter.py). Часть fastApiService. */
import type { EmChapter } from '~/utils/emChapter';
import { mutationOptions, request } from './http';

const TIMEOUT_MS = 120_000;

export const emChapterApi = {
  /** Данные главы по подпунктам а–к; fileids не заданы — все фрагменты, кроме сценариев и копий */
  async getEmChapter(fileids?: number[]): Promise<EmChapter> {
    return request<EmChapter>('api/v1/reports/em-chapter',
      { ...mutationOptions('POST', fileids?.length ? { fileids } : {}), timeout: TIMEOUT_MS });
  },
  /** Та же глава в Word (право «Выгрузка») */
  async getEmChapterDocx(city: string, fileids?: number[]): Promise<Blob> {
    return request<Blob>('api/v1/reports/em-chapter.docx', {
      ...mutationOptions('POST', { city, ...(fileids?.length ? { fileids } : {}) }),
      responseType: 'blob', timeout: TIMEOUT_MS,
    });
  },
};
