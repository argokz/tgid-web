import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';
import DefectJournalDialog from '~/components/DefectJournalDialog.vue';
import ShurfJournalDialog from '~/components/ShurfJournalDialog.vue';
import InspectionJournalDialog from '~/components/InspectionJournalDialog.vue';
import PressureTestJournalDialog from '~/components/PressureTestJournalDialog.vue';
import CorrosionIndicatorJournalDialog from '~/components/CorrosionIndicatorJournalDialog.vue';
import TechnicalConditionJournalDialog from '~/components/TechnicalConditionJournalDialog.vue';
import { mountWithVuetify, flushPromises } from './mountHelper';

/** Диалоги журналов телепортируются в body — кнопки ищутся в документе, а не в wrapper */
function bodyButton(text: string): HTMLButtonElement {
  const buttons = Array.from(document.body.querySelectorAll('button'));
  const button = buttons.find((b) => b.textContent?.includes(text));
  if (!button) throw new Error(`Кнопка «${text}» не найдена. Есть: ${buttons.map((b) => b.textContent?.trim()).join(' | ')}`);
  return button;
}

/** Любой метод сервиса отвечает пустым списком/описанием журнала — проверяется только форма */
const { calls, serviceProxy } = vi.hoisted(() => {
  const emptyResponse = {
    items: [], total: 0, page: 1, pages: 0, page_size: 50,
    key: 'test', title: 'Журнал', required_on_create: [], unique_fields: [], create_modes: [],
    // описание журнала: любое поле карточки записываемое (строка)
    fields: new Proxy({}, { get: (_t, key) => (typeof key === 'string' ? { kind: 'str', label: key, ref: null } : undefined) }),
    has_contour: false, has_documents: false, has_point_geometry: false,
  };
  const calls = { list: [] as Array<{ method: string; args: unknown[] }> };
  const serviceProxy = () => new Proxy({}, {
    get: (_target, method: string) => (...args: unknown[]) => {
      calls.list.push({ method, args });
      if (method === 'createObject') return Promise.resolve({ success: true, id: 501 });
      if (method === 'getCorrosionIndicator') return Promise.resolve({ id: 501, number: 'QA', history_count: 0 });
      // справочники (lookups) и прочие списки, которых нет в ответе, — пустые массивы
      return Promise.resolve(new Proxy({ ...emptyResponse }, {
        get: (target: Record<string, unknown>, key) => (key in target ? target[key as string]
          : typeof key === 'string' && key !== 'then' && key !== 'toJSON' && !key.startsWith('__v') ? [] : undefined),
      }));
    },
  });
  return { calls, serviceProxy };
});

vi.mock('~/services/fastApiService', async (orig) => ({
  ...(await orig<typeof import('~/services/fastApiService')>()),
  fastApiService: serviceProxy(),
}));
vi.mock('~/services/journalWriteService', async (orig) => ({
  ...(await orig<typeof import('~/services/journalWriteService')>()),
  journalWriteService: serviceProxy(),
}));
vi.mock('~/composables/useMutationsEnabled', () => ({ useMutationsEnabled: () => computed(() => true) }));

const dialogs = [
  ['нарушения', DefectJournalDialog],
  ['шурфовки', ShurfJournalDialog],
  ['осмотры', InspectionJournalDialog],
  ['опрессовки', PressureTestJournalDialog],
  ['индикаторы коррозии', CorrosionIndicatorJournalDialog],
  ['технические условия', TechnicalConditionJournalDialog],
] as const;

async function openCreateForm(component: unknown) {
  const w = mountWithVuetify(component as any);
  await (w.vm as any).openDialog();
  await flushPromises();
  bodyButton('Создать').click();
  await flushPromises();
  return w;
}

describe('журналы: «Создать» открывает форму (QA F41)', () => {
  beforeEach(() => { calls.list = []; });

  it.each(dialogs)('%s — форма новой записи с полями и кнопкой «Сохранить»', async (_name, component) => {
    const w = await openCreateForm(component);
    // до исправления карточка при selected = null оставалась пустой: ни панелей, ни полей
    expect(document.body.querySelectorAll('.v-expansion-panel').length).toBeGreaterThan(0);
    expect(document.body.querySelectorAll('.v-expansion-panel input, .v-expansion-panel textarea').length).toBeGreaterThan(0);
    expect(bodyButton('Сохранить')).toBeTruthy();
    w.unmount();
  });
});

describe('индикатор коррозии: колонки БД вместо ключей API (QA F42/F46)', () => {
  beforeEach(() => { calls.list = []; });

  it('создание шлёт колонки indikator_korrozii, после создания карточка — на просмотр', async () => {
    const w = await openCreateForm(CorrosionIndicatorJournalDialog);
    const vm = w.vm as any;
    // поле «Место установки» — первое textarea формы
    const place = document.body.querySelector('.v-expansion-panel textarea') as HTMLTextAreaElement;
    place.value = 'QA-3009 место';
    place.dispatchEvent(new Event('input'));
    await flushPromises();
    bodyButton('Сохранить').click();
    await flushPromises();
    const create = calls.list.find((c) => c.method === 'createObject');
    expect(create?.args[0]).toBe('indikator_korrozii');
    expect(create?.args[1]).toEqual({ mesto_ustanovki: 'QA-3009 место' });
    expect(calls.list.some((c) => c.method === 'getCorrosionIndicator')).toBe(true);
    // открытая после сохранения карточка — не «Новый индикатор» и не в режиме правки
    expect(document.body.textContent).not.toContain('Новый индикатор');
    expect(vm.$?.setupState?.isNew ?? false).toBe(false);
    w.unmount();
  });
});
