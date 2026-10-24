import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, deviceClass } from '~/utils/breakpoints';
import { buildPageTitle } from '~/utils/pageTitle';

describe('breakpoints', () => {
  it('границы Vuetify display: 600 / 960 / 1280', () => {
    expect(BREAKPOINTS).toEqual({ sm: 600, md: 960, lg: 1280 });
  });

  it('класс устройства по ширине: телефон < 960, планшет < 1280, дальше десктоп', () => {
    expect(deviceClass(360)).toBe('phone');
    expect(deviceClass(768)).toBe('phone');
    expect(deviceClass(959)).toBe('phone');
    expect(deviceClass(960)).toBe('tablet');
    expect(deviceClass(1024)).toBe('tablet');
    expect(deviceClass(1279)).toBe('tablet');
    expect(deviceClass(1280)).toBe('desktop');
    expect(deviceClass(2560)).toBe('desktop');
  });
});

describe('buildPageTitle', () => {
  it('контекст — город — ITwin Map, пустые части пропускаются', () => {
    expect(buildPageTitle({ context: 'Инструменты', city: 'Алматы' })).toBe('Инструменты — Алматы — ITwin Map');
    expect(buildPageTitle({ context: null, city: 'Алматы' })).toBe('Алматы — ITwin Map');
    expect(buildPageTitle({ context: ' ', city: '' })).toBe('ITwin Map');
  });
});
