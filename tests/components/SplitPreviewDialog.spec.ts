import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import SplitPreviewDialog from '~/components/SplitPreviewDialog.vue';
import type { SplitTransferReport } from '~/services/fastApiService';
import { mountWithVuetify, findButton } from './mountHelper';

const report: SplitTransferReport = {
  moved: { zd: 1 },
  review: { zd: 2 },
  review_items: { zd: [{ id: 5, attrs: { name: 'З-5' } }, { id: 6, attrs: { name: 'З-6' } }] },
  skipped: [],
};

const mountDialog = (props: Record<string, unknown> = {}) =>
  mountWithVuetify(SplitPreviewDialog, {
    props: { modelValue: true, lineId: 101, report, loading: false, confirming: false, error: null, ...props },
  });

describe('SplitPreviewDialog', () => {
  it('пока не выбраны половины для всех объектов — «Разрезать» недоступна', () => {
    const w = mountDialog();
    expect(findButton(w, 'Разрезать').attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('поштучный выбор: вторая половина уходит в reviewToNew', async () => {
    const w = mountDialog();
    const halves = w.findAll('button').filter((b) => ['1-я', '2-я'].includes(b.text()));
    expect(halves).toHaveLength(4);
    await halves[0].trigger('click'); // объект 5 → 1-я
    await halves[3].trigger('click'); // объект 6 → 2-я
    await nextTick();
    const cut = findButton(w, 'Разрезать');
    expect(cut.attributes('disabled')).toBeUndefined();
    await cut.trigger('click');
    expect(w.emitted('confirm')?.[0]).toEqual([{ zd: [6] }]);
    w.unmount();
  });

  it('«Все на вторую» переносит все объекты на новую половину', async () => {
    const w = mountDialog();
    await findButton(w, 'Все на вторую').trigger('click');
    await findButton(w, 'Разрезать').trigger('click');
    expect(w.emitted('confirm')?.[0]).toEqual([{ zd: [5, 6] }]);
    w.unmount();
  });

  it('«Отмена» закрывает диалог', async () => {
    const w = mountDialog();
    await findButton(w, 'Отмена').trigger('click');
    expect(w.emitted('cancel')).toHaveLength(1);
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false]);
    w.unmount();
  });
});
