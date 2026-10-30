import { describe, expect, it } from 'vitest';
import { appRelativePath, frameHeaders } from '~/utils/frameAncestors';

const SELF = { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' };
const ANY = { 'Content-Security-Policy': 'frame-ancestors *' };

describe('показ во фрейме', () => {
  it('путь считается от baseURL, заданного при запуске', () => {
    expect(appRelativePath('/tgid/almaty/embed?key=tge_x', '/tgid/almaty/')).toBe('embed');
    expect(appRelativePath('/itwin-map/outages/', '/itwin-map/')).toBe('outages');
    expect(appRelativePath('/itwin-map/', '/itwin-map/')).toBe('');
    expect(appRelativePath('/embed', '/')).toBe('embed');
  });

  it('встраиваемая и публичная карты — любым сайтам, остальное — только своему', () => {
    expect(frameHeaders('/tgid/almaty/embed?key=tge_x', '/tgid/almaty/')).toEqual(ANY);
    expect(frameHeaders('/itwin-map/outages', '/itwin-map/')).toEqual(ANY);
    expect(frameHeaders('/itwin-map/', '/itwin-map/')).toEqual(SELF);
    expect(frameHeaders('/itwin-map/field', '/itwin-map/')).toEqual(SELF);
    expect(frameHeaders('/itwin-map/embed/../', '/itwin-map/')).toEqual(SELF);
    expect(frameHeaders('/itwin-map/embedded', '/itwin-map/')).toEqual(SELF);
    // /embed другого приложения на том же сайте — не наше исключение
    expect(frameHeaders('/tgid/astana/embed', '/tgid/almaty/')).toEqual(SELF);
  });
});
