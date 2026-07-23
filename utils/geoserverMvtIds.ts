/** ID векторного слоя MVT: workspace и sourceLayer не должны содержать «__». */
export function buildMvtLayerIdentifiers(workspaceName: string, sourceLayer: string): {
  layerId: string
  sourceId: string
  id: string
} {
  const ws = String(workspaceName)
  const sl = String(sourceLayer)
  const core = `__${ws}__${sl}`
  return {
    id: `mvt${core}`,
    layerId: `mvt${core}`,
    sourceId: `vec${core}`
  }
}

/** Источник растровых тайлов WMS (отдельно от vec__, чтобы переключать MVT↔WMS). */
export function buildWmsRasterSourceId(workspaceName: string, sourceLayer: string): string {
  const ws = String(workspaceName)
  const sl = String(sourceLayer)
  return `rast__${ws}__${sl}`
}

/** Только WMS в каталоге (без успешного MVT). */
export function buildWmsOnlyLayerIdentifiers(workspaceName: string, sourceLayer: string): {
  layerId: string
  sourceId: string
  id: string
} {
  const ws = String(workspaceName)
  const sl = String(sourceLayer)
  const core = `__${ws}__${sl}`
  return {
    id: `wms${core}`,
    layerId: `wms${core}`,
    sourceId: `rast${core}`
  }
}

/** Разбор layerId / sourceId MVT/WMS (новый формат и обратная совместимость). */
export function parseMvtLayerId(
  layerId: string,
  fallbackWorkspace: string
): { workspace: string; sourceLayer: string } {
  const id = String(layerId || '')
  if (id.includes('__')) {
    const parts = id.split('__')
    if (parts.length >= 3) {
      const kind = parts[0]
      if (kind === 'mvt' || kind === 'vec' || kind === 'wms' || kind === 'rast') {
        return { workspace: parts[1], sourceLayer: parts.slice(2).join('__') }
      }
    }
  }
  const hybrid = id.match(/^mvt-([^-]+)-(.+)$/)
  if (hybrid) return { workspace: hybrid[1], sourceLayer: hybrid[2] }
  const legacy = id.match(/^mvt-almaty-(.+)$/i)
  if (legacy) return { workspace: fallbackWorkspace, sourceLayer: legacy[1] }
  return { workspace: fallbackWorkspace, sourceLayer: id.replace(/^mvt-/, '') || id }
}
