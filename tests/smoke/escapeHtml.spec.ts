import { describe, expect, it } from 'vitest';
import { escapeHtml } from '~/utils/escapeHtml';

describe('escapeHtml', () => {
  it('escapes unsafe HTML characters', () => {
    const value = `<script>alert("xss")</script>`;
    expect(escapeHtml(value)).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('handles non-string values safely', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
