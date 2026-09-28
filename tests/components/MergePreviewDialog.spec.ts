import { describe, it, expect } from 'vitest';
import MergePreviewDialog from '~/components/MergePreviewDialog.vue';
import type { MergeNodesReport } from '~/services/fastApiService';
import { mountWithVuetify, findButton } from './mountHelper';

const report = (over: Partial<MergeNodesReport> = {}): MergeNodesReport => ({
  dry_run: true,
  target_node_id: 10,
  source_node_id: 20,
  target_position: { x: 1, y: 2, lng: 76.9, lat: 43.2 },
  distance_m: 3.5,
  relinked_lines: [101, 102],
  removed_lines: [],
  transfer: { 'realconsumers.nodeid': 2 },
  results_skipped: {},
  blockers: {},
  ...over,
} as MergeNodesReport);

const mountDialog = (props: Record<string, unknown>) =>
  mountWithVuetify(MergePreviewDialog, {
    props: { modelValue: true, targetId: 10, sourceId: 20, report: null, loading: false, confirming: false, error: null, ...props },
  });

describe('MergePreviewDialog', () => {
  it('превью без блокеров: показывает перенос и разрешает применить', async () => {
    const w = mountDialog({ report: report() });
    expect(w.text()).toContain('Слить узел 20 в узел 10');
    expect(w.text()).toContain('3.5');
    const apply = findButton(w, "Объединить");
    expect(apply.attributes('disabled')).toBeUndefined();
    await apply.trigger('click');
    expect(w.emitted('confirm')).toHaveLength(1);
    w.unmount();
  });

  it('блокеры сервера переводятся в понятные строки и запрещают слияние', () => {
    const w = mountDialog({
      report: report({ blockers: { different_fragments: { target: 74, source: 75 }, target_without_geometry: true } }),
    });
    expect(w.text()).toContain('узлы из разных фрагментов (74 и 75)');
    expect(w.text()).toContain('у целевого узла нет геометрии');
    expect(findButton(w, "Объединить").attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('ошибка превью блокирует кнопку; «Отмена» закрывает и шлёт cancel', async () => {
    const w = mountDialog({ error: 'HTTP 409' });
    expect(w.text()).toContain('HTTP 409');
    expect(findButton(w, "Объединить").attributes('disabled')).toBeDefined();
    await findButton(w, 'Отмена').trigger('click');
    expect(w.emitted('cancel')).toHaveLength(1);
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false]);
    w.unmount();
  });
});
