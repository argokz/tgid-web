import { describe, expect, it } from 'vitest'
import {
  draftChanges, draftKey, fieldColumns, hiddenByVis, initialDraft, parseInput, ruleValues, validateDraft, visText,
  type CardField, type CardTab,
} from '~/utils/objectCard'
import { clampFloat, clampPanelWidth } from '~/composables/useObjectCardLayout'

const edit = (over: Partial<NonNullable<CardField['edit']>> = {}): NonNullable<CardField['edit']> => ({
  kind: 'float', max_length: null, list: null, fun: null, fun_name: null, not_null: false,
  readonly: [false, false], raw: [150, 125], ...over,
})

// участок-пара: подача 10 / обратка 11 (heatpipesections 100/101)
const pairCard = (): { tabs: CardTab[] } => ({
  tabs: [
    {
      title: 'Участок',
      subsections: [{
        title: 'Участок трубопровода',
        fields: [
          { table: 'heatPipeSections', field: 'diameterCondit', label: 'Ду', value: 150, value2: 125, id: 100, id2: 101, type: 'text', edit: edit() },
          {
            table: 'heatPipeSections', field: 'pipeSectStateIDflow', label: 'Подача', value: 'открыто', value2: 'открыто', id: 100, id2: 101,
            type: 'select', code: 1, code2: 1, edit: edit({ kind: 'int', list: 'inline', readonly: [false, true], raw: [1, 1] }),
          },
          { table: 'heatPipeSections', field: 'mestn', label: 'Местные', value: '', value2: '', id: 100, id2: 101, type: 'text', hidden: true, edit: edit({ kind: 'str', raw: ['', ''] }) },
          { table: 'nodes', field: 'externalNodeName', label: 'Узел', value: 'тк', value2: 'тк', id: 5, id2: 5, type: 'text', edit: edit({ kind: 'str', readonly: [true, true], raw: ['тк', 'тк'] }) },
        ],
      }],
    },
    { title: 'Результат расчета', readonly: true, subsections: [{ title: 'Р', fields: [{ table: 'ut_out', field: 'g', label: 'G', value: 1, id: 1, type: 'text' }] }] },
  ],
})

describe('objectCard', () => {
  it('fieldColumns: колонки пары и только для чтения', () => {
    const f = pairCard().tabs[0].subsections[0].fields[1]
    expect(fieldColumns(f)).toEqual([{ id: 100, raw: 1, readonly: false }, { id: 101, raw: 1, readonly: true }])
    const view = pairCard().tabs[1].subsections[0].fields[0]
    expect(fieldColumns(view)[0].readonly).toBe(true)
  })

  it('initialDraft/draftChanges: только правимые поля, изменения по строкам', () => {
    const card = pairCard()
    const draft = initialDraft(card)
    expect(Object.keys(draft).sort()).toEqual([
      'heatpipesections:100:diametercondit', 'heatpipesections:100:mestn', 'heatpipesections:100:pipesectstateidflow',
      'heatpipesections:101:diametercondit', 'heatpipesections:101:mestn',
    ])
    expect(draftChanges(card, draft)).toEqual([])
    draft[draftKey('heatPipeSections', 101, 'diameterCondit')] = '125,0' // то же число
    draft[draftKey('heatPipeSections', 100, 'diameterCondit')] = 200
    draft[draftKey('heatPipeSections', 100, 'mestn')] = ''
    expect(draftChanges(card, draft)).toEqual([{ table: 'heatPipeSections', id: 100, field: 'diameterCondit', value: 200 }])
  })

  it('hiddenByVis: как init_map_b десктопа', () => {
    const rules = { pipesectstateidflow: { '-1': ['mestn'], '1': [], '2': [] } }
    expect([...hiddenByVis(rules, { pipesectstateidflow: 1 })]).toEqual(['mestn'])
    expect([...hiddenByVis(rules, { pipesectstateidflow: -1 })]).toEqual([])
    // пусто → «1»
    expect([...hiddenByVis({ k: { '1': ['a'], '2': ['b'] } }, { k: null })]).toEqual(['b'])
    // ключа нет в карточке — правило не применяется
    expect([...hiddenByVis(rules, {})]).toEqual([])
    expect(visText(1.0)).toBe('1')
    expect(visText('2.0')).toBe('2')
  })

  it('ruleValues: значения колонки из черновика', () => {
    const card = pairCard()
    const draft = initialDraft(card)
    draft[draftKey('heatPipeSections', 100, 'pipeSectStateIDflow')] = -1
    expect(ruleValues(card, draft, 'heatpipesections', 0).pipesectstateidflow).toBe(-1)
    expect(ruleValues(card, draft, 'heatpipesections', 1).pipesectstateidflow).toBe(1)
  })

  it('validateDraft: обязательные, числа, длина', () => {
    const card = pairCard()
    card.tabs[0].subsections[0].fields[2].edit = edit({ kind: 'str', not_null: true, max_length: 3, raw: ['', ''] })
    const draft = initialDraft(card)
    draft[draftKey('heatPipeSections', 100, 'diameterCondit')] = 'abc'
    draft[draftKey('heatPipeSections', 101, 'mestn')] = 'длинно'
    const errors = validateDraft(card, draft)
    expect(errors['heatpipesections:100:diametercondit']).toBe('Ожидается число')
    expect(errors['heatpipesections:100:mestn']).toBe('Обязательное поле')
    expect(errors['heatpipesections:101:mestn']).toBe('Не длиннее 3 символов')
  })

  it('parseInput: запятая в числах, пусто → null', () => {
    expect(parseInput('float', '1,5')).toBe(1.5)
    expect(parseInput('int', ' ')).toBeNull()
    expect(parseInput('str', ' тк ')).toBe('тк')
  })

  it('размещение окна: ширина панели и окно в пределах экрана', () => {
    expect(clampPanelWidth(100, 1600)).toBe(360)
    expect(clampPanelWidth(2000, 1600)).toBe(900)
    expect(clampPanelWidth(800, 700)).toBe(580)
    expect(clampFloat({ x: -50, y: 2000, w: 5000, h: 300 }, 1280, 800)).toEqual({ x: 8, y: 492, w: 1264, h: 300 })
  })
})
