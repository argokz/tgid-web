// @vitest-environment jsdom
// DOMPurify в happy-dom не обходит атрибуты и теги как браузер — нужна jsdom
import { describe, expect, it } from 'vitest';
import { objectFromAnchor } from '~/utils/calcProtocol';
import { sanitizeProtocolHtml } from '~/utils/protocolHtml';

const parse = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
};

describe('sanitizeProtocolHtml', () => {
  it('сохраняет разметку sety: цвета, жирный, ссылки на объекты', () => {
    const out = parse(sanitizeProtocolHtml(
      `<span style="color:red">Ошибка</span> <span style="font-weight:bold;">узел</span> `
      + `<a name='node' id='12' href='[Узел 12]'>[Узел 12]</a> <a name='line2' id1='3' id2='4' href='[3-4]'>[3-4]</a>`,
    ));
    expect(out.querySelector('span')?.getAttribute('style')).toBe('color:red');
    expect(out.querySelectorAll('span')[1]?.getAttribute('style')).toBe('font-weight:bold');
    const [node, pair] = Array.from(out.querySelectorAll('a'));
    expect(objectFromAnchor(node!)).toEqual({ kind: 'node', id: 12, label: 'Узел 12' });
    expect(objectFromAnchor(pair!)).toEqual({ kind: 'line2', id1: 3, id2: 4, label: '3-4' });
  });

  it('вырезает скрипты, обработчики, чужие теги и опасные ссылки — текст имён остаётся', () => {
    const out = sanitizeProtocolHtml(
      `Узел <img src=x onerror="alert(1)"><script>alert(2)</script><b onclick="alert(3)">ТК-1</b>`
      + `<a name='node' id='1' href='javascript:alert(4)'>[x]</a><iframe src="//evil"></iframe>`,
    );
    expect(out).not.toMatch(/onerror|onclick|<script|<img|<iframe|javascript:/i);
    expect(out).toContain('ТК-1');
    expect(parse(out).querySelector('a')?.getAttribute('name')).toBe('node');
  });

  it('стиль — только цвет и начертание, без url() и позиционирования', () => {
    const out = parse(sanitizeProtocolHtml(
      `<span style="color:blue;background:url(//evil/x.png);position:fixed;inset:0">a</span>`
      + `<span style="background-image:url(x)">b</span>`,
    ));
    const [a, b] = Array.from(out.querySelectorAll('span'));
    expect(a?.getAttribute('style')).toBe('color:blue');
    expect(b?.hasAttribute('style')).toBe(false);
  });
});
