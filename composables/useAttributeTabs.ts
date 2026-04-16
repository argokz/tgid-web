/**
 * Composable для работы с вкладками и названиями атрибутов
 */

export interface TabStructure {
  [tabName: string]: Array<{
    [sectionName: string]: string[]
  }>
}

export interface AttributeNames {
  [key: string]: string
}

export interface GroupedAttribute {
  key: string
  value: any
  label: string
}

export interface TabData {
  tabName: string
  sections: Array<{
    sectionName: string
    fields: GroupedAttribute[]
  }>
}

export const useAttributeTabs = () => {
  const getAttributeLabel = (fieldKey: string, attributeNames?: AttributeNames): string => {
    const names = attributeNames || {}
    const keyLower = fieldKey.toLowerCase()

    if (names[keyLower]) return names[keyLower]

    for (const [key, value] of Object.entries(names)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedField = keyLower.replace(/[^a-z0-9]/g, '')
      if (normalizedKey === normalizedField) return value
    }

    return fieldKey
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const groupAttributesByTabs = (
    attributes: Record<string, any>,
    tabsStructure: TabStructure[],
    attributeNames: AttributeNames
  ): TabData[] => {
    const result: TabData[] = []

    tabsStructure.forEach((tabObj) => {
      Object.entries(tabObj).forEach(([tabName, sections]) => {
        if (!Array.isArray(sections)) return

        const tabData: TabData = { tabName, sections: [] }

        sections.forEach((sectionObj) => {
          if (!sectionObj || typeof sectionObj !== 'object') return

          Object.entries(sectionObj).forEach(([sectionName, fieldKeys]) => {
            if (!Array.isArray(fieldKeys)) return

            const sectionData = {
              sectionName,
              fields: [] as GroupedAttribute[]
            }

            fieldKeys.forEach(fieldKey => {
              const foundKey = Object.keys(attributes).find(k => k.toLowerCase() === fieldKey.toLowerCase())
              if (foundKey) {
                sectionData.fields.push({
                  key: foundKey,
                  value: attributes[foundKey],
                  label: getAttributeLabel(foundKey, attributeNames)
                })
              }
            })

            if (sectionData.fields.length > 0) {
              tabData.sections.push(sectionData)
            }
          })
        })

        if (tabData.sections.length > 0) result.push(tabData)
      })
    })

    return result
  }

  const getUncategorizedAttributes = (
    attributes: Record<string, any>,
    tabsStructure: TabStructure[],
    attributeNames: AttributeNames
  ): GroupedAttribute[] => {
    const categorizedKeys = new Set<string>()

    tabsStructure.forEach(tabObj => {
      Object.values(tabObj).forEach(sections => {
        sections.forEach(sectionObj => {
          Object.values(sectionObj).forEach(fieldKeys => {
            fieldKeys.forEach(key => {
              categorizedKeys.add(key.toLowerCase())
              Object.keys(attributes).forEach(attrKey => {
                if (attrKey.toLowerCase() === key.toLowerCase()) categorizedKeys.add(attrKey.toLowerCase())
              })
            })
          })
        })
      })
    })

    const excludedKeys = ['tg_tabs', 'tg_names', 'id', 'geometry', 'type', 'properties']

    return Object.entries(attributes)
      .filter(([key]) => !excludedKeys.includes(key.toLowerCase()) && !categorizedKeys.has(key.toLowerCase()))
      .map(([key, value]) => ({
        key,
        value,
        label: getAttributeLabel(key, attributeNames)
      }))
  }

  return { getAttributeLabel, groupAttributesByTabs, getUncategorizedAttributes }
}
