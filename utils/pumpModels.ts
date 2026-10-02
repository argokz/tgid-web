export interface PumpModelOption {
  id: number
  name: string
}

/** Модели каталога (standardpumps) → пункты списка «Модель (тип насоса)»: «Д2000-100 · насос …» */
export function pumpModelOptions(
  items: ReadonlyArray<{ id: unknown; pump_type?: unknown; name?: unknown; producer?: unknown }>,
): PumpModelOption[] {
  const out: PumpModelOption[] = []
  for (const item of items) {
    const id = Number(item.id)
    if (!Number.isInteger(id) || id <= 0) continue
    const parts = [item.pump_type, item.name].map((v) => String(v ?? '').trim()).filter(Boolean)
    const label = parts.length ? parts.join(' · ') : `Модель №${id}`
    out.push({ id, name: item.producer ? `${label} (${String(item.producer).trim()})` : label })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

/** Текущее значение должно быть в списке, даже если каталог ещё не загружен */
export function withCurrentOption(
  options: ReadonlyArray<PumpModelOption>,
  currentId: unknown,
  currentLabel?: unknown,
): PumpModelOption[] {
  const id = Number(currentId)
  if (currentId == null || !Number.isInteger(id) || options.some((o) => o.id === id)) return [...options]
  return [{ id, name: String(currentLabel || `Модель №${id}`) }, ...options]
}
