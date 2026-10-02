import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useDialogMapOverlay } from '~/composables/useDialogMapOverlay';

const setup = () => {
  const visible = ref(true);
  const clear = vi.fn();
  return { visible, clear, ...useDialogMapOverlay(visible, clear) };
};

describe('useDialogMapOverlay (QA F27, F37)', () => {
  it('закрытие диалога снимает показанный оверлей', async () => {
    const o = setup();
    o.markShown();
    o.visible.value = false;
    await nextTick();
    expect(o.clear).toHaveBeenCalledTimes(1);
    expect(o.shown.value).toBe(false);
  });

  it('без оверлея закрытие ничего не снимает', async () => {
    const o = setup();
    o.visible.value = false;
    await nextTick();
    expect(o.clear).not.toHaveBeenCalled();
  });

  it('«Оставить на карте» закрывает диалог и оставляет оверлей, в т.ч. после повторного открытия', async () => {
    const o = setup();
    o.markShown();
    o.keepOnMap();
    await nextTick();
    expect(o.visible.value).toBe(false);
    expect(o.clear).not.toHaveBeenCalled();
    o.visible.value = true;
    await nextTick();
    o.visible.value = false;
    await nextTick();
    expect(o.clear).not.toHaveBeenCalled();
    expect(o.shown.value).toBe(true);
  });

  it('новый оверлей снова принадлежит диалогу и снимается при закрытии', async () => {
    const o = setup();
    o.markShown();
    o.keepOnMap();
    await nextTick();
    o.visible.value = true;
    await nextTick();
    o.markShown();
    o.visible.value = false;
    await nextTick();
    expect(o.clear).toHaveBeenCalledTimes(1);
  });

  it('снятый вручную оверлей не снимается повторно', async () => {
    const o = setup();
    o.markShown();
    o.markCleared();
    o.visible.value = false;
    await nextTick();
    expect(o.clear).not.toHaveBeenCalled();
  });
});
