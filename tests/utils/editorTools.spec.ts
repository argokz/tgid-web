import { describe, expect, it } from 'vitest';
import { EDITOR_HOTKEYS, EDITOR_TOOLS, editorKeyAction, editorStatusHint, type EditorStatus } from '~/utils/editorTools';

const ev = (key: string, extra: Partial<KeyboardEvent> = {}) =>
  ({ key, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra }) as KeyboardEvent;

describe('editorKeyAction', () => {
  it('буквы — инструменты, по физической клавише (русская раскладка)', () => {
    expect(editorKeyAction(ev('v'))).toEqual({ type: 'tool', tool: 'select' });
    expect(editorKeyAction(ev('д', { code: 'KeyL' }))).toEqual({ type: 'tool', tool: 'trace' });
    expect(editorKeyAction(ev('т', { code: 'KeyN' }))).toEqual({ type: 'tool', tool: 'node' });
    expect(editorKeyAction(ev('x'))).toBeNull();
  });

  it('Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z / Ctrl+S; с Ctrl буквы не переключают инструмент', () => {
    expect(editorKeyAction(ev('z', { ctrlKey: true }))).toEqual({ type: 'undo' });
    expect(editorKeyAction(ev('я', { code: 'KeyZ', ctrlKey: true }))).toEqual({ type: 'undo' });
    expect(editorKeyAction(ev('y', { ctrlKey: true }))).toEqual({ type: 'redo' });
    expect(editorKeyAction(ev('Z', { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(editorKeyAction(ev('s', { metaKey: true }))).toEqual({ type: 'save' });
    expect(editorKeyAction(ev('v', { ctrlKey: true }))).toBeNull();
    expect(editorKeyAction(ev('v', { altKey: true }))).toBeNull();
  });

  it('Esc, Del, F, G, ?', () => {
    expect(editorKeyAction(ev('Escape'))).toEqual({ type: 'escape' });
    expect(editorKeyAction(ev('Delete'))).toEqual({ type: 'delete' });
    expect(editorKeyAction(ev('а', { code: 'KeyF' }))).toEqual({ type: 'focus' });
    expect(editorKeyAction(ev('g'))).toEqual({ type: 'coords' });
    expect(editorKeyAction(ev('р', { code: 'KeyH' }))).toEqual({ type: 'history' });
    expect(editorKeyAction(ev('?', { shiftKey: true }))).toEqual({ type: 'help' });
    expect(editorKeyAction(ev(',', { code: 'Slash', shiftKey: true }))).toEqual({ type: 'help' });
  });

  it('у каждого инструмента своя клавиша, и все они — в справке', () => {
    const keys = EDITOR_TOOLS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const help = EDITOR_HOTKEYS.flatMap((g) => g.items.flatMap((i) => i.keys));
    for (const k of keys) expect(help).toContain(k);
  });
});

describe('editorStatusHint', () => {
  const base: EditorStatus = {
    tool: 'select', selection: null, tracing: false, vertexLineId: null, vertexDirty: false,
    mergeTarget: null, nodeTypeTitle: 'Узел', entryHint: '',
  };

  it('подсказка следующего шага по инструменту и состоянию', () => {
    expect(editorStatusHint(base)).toContain('Щёлкните узел или участок');
    expect(editorStatusHint({ ...base, selection: { kind: 'line', id: 9 } })).toContain('Участок 9');
    expect(editorStatusHint({ ...base, tool: 'trace', tracing: true })).toContain('Backspace');
    expect(editorStatusHint({ ...base, tool: 'node', nodeTypeTitle: 'Потребитель' })).toContain('«Потребитель»');
    expect(editorStatusHint({ ...base, tool: 'vertex', vertexLineId: 5, vertexDirty: true })).toContain('Ctrl+S');
    expect(editorStatusHint({ ...base, tool: 'merge', mergeTarget: 3 })).toContain('Целевой узел 3');
    expect(editorStatusHint({ ...base, tool: 'entry', entryHint: 'дом 5' })).toBe('дом 5');
  });
});

describe('подписи операций в «Истории»', () => {
  it('правка карточки — по тексту журнала, сеть — по виду операции', async () => {
    const { topologyOperationLabel } = await import('~/utils/topologyLabels');
    expect(topologyOperationLabel({ operation: 'CARD_EDIT', summary: { text: 'паспорт участка 5 — Ду: 100 → 125' } }))
      .toBe('свойства: паспорт участка 5 — Ду: 100 → 125');
    expect(topologyOperationLabel({ operation: 'DISSOLVE_NODE', summary: { node_id: 7, line_id: 3 } }))
      .toBe('соединение труб через узел 3');
  });
});
