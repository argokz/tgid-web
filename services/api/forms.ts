/** Формы обходов (itwin-api routers/forms.py). Часть fastApiService (services/fastApiService.ts собирает разделы). */
import type { FormAnswers, FormInput, FormRow, FormSchema, FormSubmission } from '~/utils/forms';
import { encodePath, mutationOptions, request } from './http';

export interface FormSubmissionInput {
  form_id: number;
  version: number;
  work_order_id: number;
  node_id?: number | null;
  answers: FormAnswers;
  client_id: string;
  lon?: number | null;
  lat?: number | null;
  filled_at?: string | null;
}

export interface XlsFormImport {
  form: { name: string; schema: FormSchema };
  warnings: string[];
}

export const formsApi = {
  /** active — только действующие (полевое приложение хранит их на телефоне) */
  async getForms(active = false): Promise<FormRow[]> {
    return request<FormRow[]>('api/v1/forms', { ...mutationOptions('GET'), query: active ? { active: true } : {} });
  },

  async getForm(id: number, version?: number): Promise<FormRow> {
    return request<FormRow>(`api/v1/forms/${encodePath(id)}`, { ...mutationOptions('GET'), query: version ? { version } : {} });
  },

  async createForm(body: FormInput): Promise<FormRow> {
    return request<FormRow>('api/v1/forms', mutationOptions('POST', body));
  },

  /** Поля изменились — новая версия; прежние ответы остаются по своей версии */
  async updateForm(id: number, body: FormInput): Promise<FormRow> {
    return request<FormRow>(`api/v1/forms/${encodePath(id)}`, mutationOptions('PUT', body));
  },

  async setFormActive(id: number, active: boolean): Promise<FormRow> {
    return request<FormRow>(`api/v1/forms/${encodePath(id)}`, mutationOptions('PATCH', { active }));
  },

  /** Разобрать XLSForm (.xlsx): описание формы и что не перенесено — без записи */
  async importXlsForm(file: File): Promise<XlsFormImport> {
    const form = new FormData();
    form.append('file', file, file.name);
    return request<XlsFormImport>('api/v1/forms/import-xlsform', mutationOptions('POST', form));
  },

  async exportFormSubmissions(id: number): Promise<Blob> {
    return request<Blob>(`api/v1/forms/${encodePath(id)}/export.xlsx`, { responseType: 'blob' });
  },

  /** Заполнение с телефона: повтор с тем же client_id сервер не записывает второй раз */
  async submitForm(body: FormSubmissionInput): Promise<FormSubmission> {
    return request<FormSubmission>('api/v1/forms/submissions', mutationOptions('POST', body));
  },

  async getWorkOrderForms(orderId: number): Promise<FormSubmission[]> {
    return request<FormSubmission[]>(`api/v1/work-orders/${encodePath(orderId)}/forms`, mutationOptions('GET'));
  },
};
