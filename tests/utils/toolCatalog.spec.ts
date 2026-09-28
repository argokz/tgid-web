import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_TOOLS, TOOL_EVENT_TO_DIALOG } from '~/utils/toolCatalog';

describe('toolCatalog: регистрация диалогов', () => {
  it('у каждого инструмента свой диалог, событие → диалог однозначно', () => {
    const events = ALL_TOOLS.map((t) => t.event);
    expect(new Set(events).size).toBe(events.length);
    const dialogs = ALL_TOOLS.map((t) => t.dialog);
    expect(new Set(dialogs).size).toBe(dialogs.length);
    for (const tool of ALL_TOOLS) {
      expect(TOOL_EVENT_TO_DIALOG[tool.event]).toBe(tool.dialog);
    }
  });

  it('MapViewer монтирует компонент для каждого диалога каталога', () => {
    const src = readFileSync(resolve(process.cwd(), 'components/MapViewer.vue'), 'utf-8');
    const table = src.slice(src.indexOf('const toolDialogs: ToolDialogEntry[] = ['));
    const keys = [...table.matchAll(/key: '([A-Za-z]+)'/g)].map((m) => m[1]);
    for (const tool of ALL_TOOLS) {
      expect(keys, tool.dialog).toContain(tool.dialog);
    }
  });
});
