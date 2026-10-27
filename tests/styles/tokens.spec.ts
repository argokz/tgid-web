import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Z_TOOLTIP } from '../../utils/zLayers';

/** Токены — контракт для примитивов: имена и защитные медиазапросы не должны пропасть при правках */
const tokens = readFileSync(resolve(__dirname, '../../assets/styles/_tokens.scss'), 'utf8');
const variables = readFileSync(resolve(__dirname, '../../assets/styles/_variables.scss'), 'utf8');
const vuetify = readFileSync(resolve(__dirname, '../../plugins/vuetify.ts'), 'utf8');

describe('дизайн-токены', () => {
  it('объявляет шкалы отступов, радиусов, теней, z-слоёв, движения, акцента и стекла', () => {
    for (const name of [
      '--space-1', '--space-2', '--space-3', '--space-4', '--space-6',
      '--radius-sm', '--radius-md', '--radius-lg',
      '--shadow-1', '--shadow-2', '--shadow-3',
      '--z-map', '--z-hud', '--z-controls', '--z-toolbar', '--z-inspector', '--z-popover', '--z-tooltip', '--z-overlay', '--z-toast',
      '--duration-fast', '--duration-base', '--duration-slow', '--ease-out', '--ease-in', '--ease-spring',
      '--accent', '--accent-rgb', '--accent-text', '--accent-soft',
      '--glass-1-bg', '--glass-1-filter', '--glass-solid-bg', '--glass-border',
      '--surface-hover', '--surface-pressed', '--surface-selected', '--border-subtle',
      '--text-strong', '--text-muted', '--text-faint',
      '--shell-top', '--shell-inset', '--shell-gap', '--controls-w', '--toolbar-row', '--modes-offset', '--corner-btn', '--hud-top', '--measure',
    ]) {
      expect(tokens, name).toMatch(new RegExp(name + ':[ ]*[^;]+;'));
    }
  });

  it('z-слои идут снизу вверх и не поднимаются выше оверлея Vuetify', () => {
    const z = (name: string) => Number(tokens.match(new RegExp(name + ':[ ]*([0-9]+);'))![1]);
    const order = ['--z-map', '--z-hud', '--z-controls', '--z-toolbar', '--z-inspector', '--z-popover', '--z-tooltip', '--z-overlay', '--z-toast'].map(z);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(z('--z-overlay')).toBe(2400);
    expect(z('--z-toast')).toBe(10000);
    // Умолчание v-tooltip в plugins/vuetify.ts — тот же слой
    expect(z('--z-tooltip')).toBe(Z_TOOLTIP);
  });

  it('есть fallback без linear() и backdrop-filter и отключение движения по prefers-reduced-motion', () => {
    expect(tokens).toMatch(/@supports \(animation-timing-function: linear\(0, 1\)\)/);
    expect(tokens).toMatch(/@supports not \(\(backdrop-filter/);
    expect(tokens).toMatch(/prefers-reduced-transparency: reduce/);
    expect(tokens).toMatch(/prefers-contrast: more/);
    expect(tokens).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{\s*--duration-fast: 0ms/);
  });

  it('SCSS-зеркало совпадает с CSS-токенами', () => {
    for (const [name, value] of [['space-2', '8px'], ['radius-md', '8px'], ['radius-lg', '12px'], ['duration-slow', '280ms']]) {
      expect(tokens).toContain(`--${name}: ${value}`);
      expect(variables).toContain(`$${name}: ${value}`);
    }
  });

  it('брейкпоинты SCSS совпадают с utils/breakpoints.ts', () => {
    const breakpoints = readFileSync(resolve(__dirname, '../../utils/breakpoints.ts'), 'utf8');
    for (const [name, value] of [['sm', '600'], ['md', '960'], ['lg', '1280']]) {
      expect(breakpoints, name).toMatch(new RegExp(name + ':[ ]*' + value + '[^0-9]'));
      expect(variables).toContain(`$breakpoint-${name}: ${value}px`);
    }
  });

  it('мобильный режим Vuetify — с границы телефона приложения', () => {
    expect(vuetify).toMatch(/mobileBreakpoint:\s*BREAKPOINTS\.md/);
  });

  it('тема Vuetify одна — светлая, с тёплым акцентом', () => {
    expect(vuetify).not.toMatch(/dark:\s*\{/);
    expect(vuetify).not.toMatch(/dark:\s*true/);
    expect(vuetify).toMatch(/accent:\s*'#D97706'/);
    expect(tokens).toMatch(/--accent:\s*#d97706/i);
  });
});
