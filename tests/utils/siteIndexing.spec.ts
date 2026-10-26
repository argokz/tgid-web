import { describe, expect, it } from 'vitest';
import { canonicalUrl, robotsMetaContent, robotsTxt } from '~/utils/siteIndexing';

describe('siteIndexing', () => {
  it('стенд по умолчанию закрыт: noindex и Disallow для всего сайта', () => {
    expect(robotsMetaContent({ indexable: false })).toBe('noindex, nofollow');
    expect(robotsTxt({ indexable: false }, '/itwin-map/')).toBe('User-agent: *\nDisallow: /\n');
  });

  it('прод с флагом: без meta robots, открыт только путь приложения', () => {
    expect(robotsMetaContent({ indexable: true })).toBeNull();
    expect(robotsTxt({ indexable: true }, '/itwin-map')).toBe('User-agent: *\nAllow: /itwin-map/\n');
  });

  it('canonical — только абсолютный http(s) адрес, со слешем в конце', () => {
    expect(canonicalUrl({ indexable: true, siteUrl: 'https://itwin.kz/itwin-map' })).toBe('https://itwin.kz/itwin-map/');
    expect(canonicalUrl({ indexable: true, siteUrl: ' https://itwin.kz/itwin-map/ ' })).toBe('https://itwin.kz/itwin-map/');
    expect(canonicalUrl({ indexable: true, siteUrl: '/itwin-map/' })).toBeNull();
    expect(canonicalUrl({ indexable: true, siteUrl: 'javascript:alert(1)' })).toBeNull();
    expect(canonicalUrl({ indexable: true })).toBeNull();
  });
});
