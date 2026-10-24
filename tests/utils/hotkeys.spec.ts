import { describe, expect, it, vi } from 'vitest';
import { dispatchHotkey, HOTKEY_AREA_ORDER, HOTKEY_DOCS, orderHotkeys, type HotkeyEntry } from '~/utils/hotkeys';

const esc = () => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

describe('реестр хоткеев', () => {
  it('порядок областей: поповер → измерение → редактор → карта → глобальные → панели', () => {
    expect(HOTKEY_AREA_ORDER).toEqual(['popover', 'measure', 'editor', 'map', 'global', 'panels']);
    const entries: HotkeyEntry[] = [
      { id: 'p', area: 'panels', handle: () => true },
      { id: 'e', area: 'editor', handle: () => true },
      { id: 'm', area: 'measure', handle: () => true },
      { id: 'm2', area: 'measure', handle: () => true },
    ];
    expect(orderHotkeys(entries).map((e) => e.id)).toEqual(['m', 'm2', 'e', 'p']);
  });

  it('клавишу получает первый согласившийся по приоритету; выключенные области пропускаются', () => {
    const measure = vi.fn(() => false);
    const editor = vi.fn(() => true);
    const panels = vi.fn(() => true);
    const entries: HotkeyEntry[] = [
      { id: 'panels', area: 'panels', handle: panels },
      { id: 'editor', area: 'editor', enabled: () => true, handle: editor },
      { id: 'measure', area: 'measure', enabled: () => true, handle: measure },
      { id: 'popover', area: 'popover', enabled: () => false, handle: () => true },
    ];
    const hit = dispatchHotkey(entries, esc(), { typing: false, overlay: false });
    expect(hit?.id).toBe('editor');
    expect(measure).toHaveBeenCalledTimes(1);
    expect(panels).not.toHaveBeenCalled();
  });

  it('в поле ввода и при открытом диалоге опрашиваются только обработчики с разрешением', () => {
    const entries: HotkeyEntry[] = [
      { id: 'editor', area: 'editor', handle: () => true },
      { id: 'panels', area: 'panels', allowInInput: true, handle: () => true },
      { id: 'global', area: 'global', allowInOverlay: true, handle: () => true },
    ];
    expect(dispatchHotkey(entries, esc(), { typing: true, overlay: false })?.id).toBe('panels');
    expect(dispatchHotkey(entries, esc(), { typing: false, overlay: true })?.id).toBe('global');
    expect(dispatchHotkey(entries, esc(), { typing: true, overlay: true })).toBeNull();
  });

  it('исключение в обработчике не отнимает клавишу у остальных', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const entries: HotkeyEntry[] = [
      { id: 'broken', area: 'editor', handle: () => { throw new Error('boom'); } },
      { id: 'panels', area: 'panels', handle: () => true },
    ];
    expect(dispatchHotkey(entries, esc(), { typing: false, overlay: false })?.id).toBe('panels');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('справка «?» покрывает общие клавиши, измерения и редактор', () => {
    expect(HOTKEY_DOCS.map((s) => s.area)).toEqual(['global', 'measure', 'editor']);
    const texts = HOTKEY_DOCS.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.keys.join('/'))));
    expect(texts).toContain('?');
    expect(texts).toContain('C');
    expect(texts).toContain('Esc');
    expect(texts).toContain('Ctrl+Z');
  });
});
