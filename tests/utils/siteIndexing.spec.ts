import { describe, expect, it } from 'vitest';
import { canonicalUrl, parseIndexable, robotsMetaContent, robotsTxt, siteIndexingWarnings } from '~/utils/siteIndexing';

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

  it('флаг строго: только true или «true»; 1, yes, опечатки — закрыто', () => {
    expect(parseIndexable(true)).toBe(true);
    expect(parseIndexable('true')).toBe(true);
    for (const v of [1, '1', 'yes', 'on', 'TRUE ', 'tru', '', undefined, null, false, 'false']) expect(parseIndexable(v)).toBe(false);
  });

  it('предупреждения при запуске: нераспознанный флаг и прод без абсолютного адреса', () => {
    expect(siteIndexingWarnings('', '')).toEqual([]);
    expect(siteIndexingWarnings('false', '')).toEqual([]);
    expect(siteIndexingWarnings('true', 'https://itwin.kz/itwin-map/')).toEqual([]);
    expect(siteIndexingWarnings('yes', '')).toHaveLength(1);
    expect(siteIndexingWarnings(true, 'itwin.kz')[0]).toContain('canonical');
  });
});
