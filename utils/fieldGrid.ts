import type { InjectionKey } from 'vue';

/** Настройки сетки полей, которые FieldGrid отдаёт ячейкам FieldCell */
export interface FieldGridContext {
  labelPosition: () => 'top' | 'inline';
}

export const FIELD_GRID_KEY: InjectionKey<FieldGridContext> = Symbol('FieldGrid');

/** Подпись поля с признаком обязательности для aria и видимой звёздочкой */
export function fieldLabel(label: string, required: boolean): string {
  return required ? `${label} *` : label;
}
