import { describe, expect, it } from 'vitest'
import { ALMATY_BBOX, nominatimSearchUrl } from '~/composables/useNominatim'

describe('поиск адреса ограничен Алматы (QA F25)', () => {
  it('viewbox Алматы и bounded=1', () => {
    const url = new URL(nominatimSearchUrl('Абая 10'))
    expect(url.searchParams.get('viewbox')).toBe(ALMATY_BBOX.join(','))
    expect(url.searchParams.get('bounded')).toBe('1')
    expect(url.searchParams.get('q')).toBe('Абая 10')
  })
})
