import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUiStore } from '~/stores/uiStore';

describe('uiStore — менеджер панелей', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('«Инструменты» и «Измерения» не открыты одновременно, побеждает последняя', () => {
    const ui = useUiStore();
    ui.toggleToolsPanel();
    expect(ui.toolsPanelOpen).toBe(true);
    ui.toggleDrawPanel(true);
    expect(ui.drawPanelOpen).toBe(true);
    expect(ui.toolsPanelOpen).toBe(false);
    // прямая запись (v-model в MapViewer) подчиняется тем же правилам
    ui.toolsPanelOpen = true;
    expect(ui.drawPanelOpen).toBe(false);
    expect(ui.openPanels).toEqual(['tools']);
  });

  it('на десктопе карточка живёт рядом с панелями, на телефоне — одна панель на экране', () => {
    const ui = useUiStore();
    ui.setViewport('desktop');
    ui.setPanel('tools', true);
    ui.setPanel('card', true);
    expect(ui.openPanels).toEqual(['tools', 'card']);

    ui.setViewport('phone');
    ui.setPanel('card', false);
    ui.setPanel('tools', true);
    ui.setPanel('draw', true);
    expect(ui.openPanels).toEqual(['draw']);
    ui.setPanel('card', true);
    expect(ui.openPanels).toEqual(['card']);
    expect(ui.isOpen('draw')).toBe(false);
  });

  it('карточку менеджер не закрывает: её закрывает владелец с подтверждением правок', () => {
    const ui = useUiStore();
    ui.setViewport('phone');
    ui.setPanel('card', true);
    ui.setPanel('tools', true);
    expect(ui.isOpen('card')).toBe(true);
    ui.closeAll();
    expect(ui.openPanels).toEqual(['card']);
  });

  it('сужение окна до телефона закрывает панели под открытой карточкой', () => {
    const ui = useUiStore();
    ui.setViewport('tablet');
    ui.setPanel('tools', true);
    ui.setPanel('card', true);
    expect(ui.openPanels).toEqual(['tools', 'card']);
    ui.setViewport('phone');
    expect(ui.openPanels).toEqual(['card']);
  });

  it('closeAll закрывает всё, запрос диалога нумеруется', () => {
    const ui = useUiStore();
    ui.setPanel('tools', true);
    ui.closeAll();
    expect(ui.openPanels).toEqual([]);
    ui.requestToolDialog('defect', { lineId: 1 });
    ui.requestToolDialog('defect');
    expect(ui.toolDialogRequest?.seq).toBe(2);
  });

  it('rightInset — целое неотрицательное число', () => {
    const ui = useUiStore();
    ui.setRightInset(459.6);
    expect(ui.rightInset).toBe(460);
    ui.setRightInset(-5);
    expect(ui.rightInset).toBe(0);
  });

  it('Esc берёт верхний обработчик, который согласился; снятые обработчики не вызываются', () => {
    const ui = useUiStore();
    const bottom = vi.fn(() => true);
    const middle = vi.fn(() => false);
    const top = vi.fn(() => true);
    const offBottom = ui.pushEscape(bottom);
    ui.pushEscape(middle);
    const offTop = ui.pushEscape(top);
    expect(ui.escapeDepth).toBe(3);

    expect(ui.handleEscape()).toBe(true);
    expect(top).toHaveBeenCalledTimes(1);
    expect(middle).not.toHaveBeenCalled();

    offTop();
    expect(ui.handleEscape()).toBe(true);
    expect(middle).toHaveBeenCalledTimes(1);
    expect(bottom).toHaveBeenCalledTimes(1);

    offBottom();
    expect(ui.handleEscape()).toBe(false);
    expect(ui.escapeDepth).toBe(1);
  });
});
