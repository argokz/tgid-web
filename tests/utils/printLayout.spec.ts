import { describe, expect, it } from 'vitest';
import { jpegToPdf } from '~/utils/pdfImage';
import {
  computeLayout,
  firstColor,
  legendColor,
  mmToPx,
  niceScaleBar,
  pageSizeMm,
  roundScale,
  scaleForZoom,
  zoomForScale,
} from '~/utils/printLayout';

describe('print layout geometry', () => {
  it('swaps paper sides by orientation', () => {
    expect(pageSizeMm('A4', 'portrait')).toEqual({ width: 210, height: 297 });
    expect(pageSizeMm('A3', 'landscape')).toEqual({ width: 420, height: 297 });
  });

  it('places frame by GOST margins, map under title, stamp in bottom-right corner', () => {
    const l = computeLayout('A4', 'landscape');
    expect(l.frame).toEqual({ x: 20, y: 5, width: 272, height: 200 });
    expect(l.map.y).toBe(17);
    expect(l.map.y + l.map.height).toBe(205);
    expect(l.stamp.x + l.stamp.width).toBe(292);
    expect(l.stamp.y + l.stamp.height).toBe(205);
  });

  it('converts mm to pixels by dpi', () => {
    expect(mmToPx(25.4, 150)).toBe(150);
    expect(mmToPx(297, 150)).toBe(1754);
  });
});

describe('scale and zoom', () => {
  it('zoomForScale and scaleForZoom are inverse', () => {
    for (const scale of [500, 2000, 10000]) {
      expect(scaleForZoom(zoomForScale(scale, 43.2), 43.2)).toBeCloseTo(scale, 6);
    }
  });

  it('larger scale denominator means smaller zoom (one step = x2)', () => {
    expect(zoomForScale(1000, 43) - zoomForScale(2000, 43)).toBeCloseTo(1, 9);
  });

  it('rounds scale to two significant digits', () => {
    expect(roundScale(2347)).toBe(2300);
    expect(roundScale(987.6)).toBe(990);
    expect(roundScale(0)).toBe(0);
  });

  it('picks a round scale bar length', () => {
    expect(niceScaleBar(730)).toEqual({ meters: 500, label: '500 м' });
    expect(niceScaleBar(2600)).toEqual({ meters: 2000, label: '2 км' });
    expect(niceScaleBar(1.3).meters).toBe(1);
  });
});

describe('legend colors', () => {
  it('reads plain colors and the default branch of expressions', () => {
    expect(firstColor('#ff0000')).toBe('#ff0000');
    expect(firstColor(['match', ['get', 'type'], 'a', '#111111', '#222222'])).toBe('#222222');
    expect(firstColor(['interpolate', ['linear'], ['zoom'], 10, 'rgb(1,2,3)', 16, 5])).toBe('rgb(1,2,3)');
    expect(firstColor('red-ish')).toBeNull();
  });

  it('uses the paint property matching layer type', () => {
    expect(legendColor('line', { 'line-color': '#00f' })).toBe('#00f');
    expect(legendColor('circle', { 'circle-color': '#0f0', 'line-color': '#00f' })).toBe('#0f0');
    expect(legendColor('fill', undefined)).toBeNull();
  });
});

describe('jpeg to pdf', () => {
  it('builds a one-page pdf with a valid xref table', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = jpegToPdf(jpeg, 10, 20, 297, 210);
    const text = Array.from(pdf, (b) => String.fromCharCode(b)).join('');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 841.89 595.28]');
    expect(text).toContain('/Width 10 /Height 20');
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(6);
    offsets.forEach((off, i) => expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});
