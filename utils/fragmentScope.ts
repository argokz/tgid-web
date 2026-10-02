export interface FragmentScopeItem {
  value: number
  title: string
}

/**
 * Пункты выпадающего списка «Фрагмент»: все известные фрагменты + выбранные id,
 * которых ещё нет в списке (список фрагментов грузится асинхронно — чипы не должны пропадать).
 */
export function fragmentScopeItems(
  fragments: ReadonlyArray<{ id: number | string; name?: string | null }>,
  selected: ReadonlyArray<number> = [],
): FragmentScopeItem[] {
  const items: FragmentScopeItem[] = []
  const seen = new Set<number>()
  for (const f of fragments) {
    const id = Number(f.id)
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    items.push({ value: id, title: f.name ? `${f.name} (#${id})` : `Фрагмент #${id}` })
  }
  for (const id of selected) {
    if (seen.has(id)) continue
    seen.add(id)
    items.push({ value: id, title: `Фрагмент #${id}` })
  }
  return items
}
