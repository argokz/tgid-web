import { describe, expect, it } from 'vitest'
import { desktopCardKind, desktopCardProps, parseDesktopCardPair } from '~/utils/desktopCard'

describe('desktopCard', () => {
  it('вид запроса карточки по таблице', () => {
    expect(desktopCardKind('heatsources')).toBe('node')
    expect(desktopCardKind('HeatPipeSections')).toBe('line')
    expect(desktopCardKind('zdaniya_tu')).toBeNull()
  })

  it('вкладки, разделы и подписи API → tg_tabs/tg_names с уникальными ключами', () => {
    const props = desktopCardProps([
      {
        title: 'Участок',
        subsections: [
          { title: 'Начальный узел', fields: [{ table: 'nodes', field: 'externalCodeID', label: 'Код', value: 'М52', id: 1, type: 'select', code: 7 }] },
          { title: 'Конечный узел', fields: [{ table: 'nodes', field: 'externalCodeID', label: 'Код', value: 'М49', id: 2, type: 'select', code: 8 }] },
          { title: 'Пусто', fields: [] },
        ],
      },
      { title: 'Пустая вкладка', subsections: [] },
    ])!
    const tabs = JSON.parse(props.tg_tabs)
    expect(tabs).toEqual([{ Участок: [{ 'Начальный узел': ['tgc_0_externalcodeid'] }, { 'Конечный узел': ['tgc_1_externalcodeid'] }] }])
    expect(JSON.parse(props.tg_names)).toEqual({ tgc_0_externalcodeid: 'Код', tgc_1_externalcodeid: 'Код' })
    expect(props.values).toEqual({ tgc_0_externalcodeid: 'М52', tgc_1_externalcodeid: 'М49' })
  })

  it('участок-пара: вторая колонка и заголовки', () => {
    const props = desktopCardProps([
      { title: 'Участок', subsections: [{ title: 'Общая', fields: [
        { table: 'linesobj', field: 'externalSignLineID', label: 'Признак', value: 'подающий', value2: 'обратный', id: 1, type: 'select' },
      ] }] },
    ], ['Подача', 'Обратка'])!
    expect(props.values).toEqual({ tgc_0_externalsignlineid: 'подающий', tgc_0_externalsignlineid__2: 'обратный' })
    expect(parseDesktopCardPair(props.tg_pair)).toEqual({
      columns: ['Подача', 'Обратка'],
      keys: { tgc_0_externalsignlineid: 'tgc_0_externalsignlineid__2' },
    })
    // одна колонка — без tg_pair
    expect(desktopCardProps([{ title: 'У', subsections: [{ title: 'Р', fields: [
      { table: 't', field: 'a', label: 'A', value: 1, id: 1, type: 'text' }] }] }])!.tg_pair).toBeUndefined()
    expect(parseDesktopCardPair(undefined)).toBeNull()
  })

  it('пустой ответ — null (остаётся карточка GeoServer)', () => {
    expect(desktopCardProps([])).toBeNull()
    expect(desktopCardProps(undefined)).toBeNull()
  })
})
