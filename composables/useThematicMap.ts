import { computed, shallowRef } from 'vue';
import type { ThematicPipesResponse } from '~/services/fastApiService';
import { useMapStore } from '~/stores/mapStore';
import { useOverlayLayer } from '~/composables/useOverlayLayer';
import { isStyleMutable, waitForStyleMutable } from '~/services/mapService';
import {
  colorExpression,
  layerFilter,
  legendRows,
  widthExpression,
  type ThematicLegendRow,
  type ThematicStyle,
} from '~/utils/thematicStyle';

/**
 * Тематическая карта участков на карте (Smart Mapping): один слой на всё приложение. Строит его диалог
 * (ThematicMapDialog), легенда (ThematicLegend) живёт на карте и после закрытия диалога — тема не
 * «оверлей диалога», а слой, который снимают кнопкой в легенде.
 */
const SOURCE_ID = 'thematic-map';
const CASING_ID = 'thematic-map-casing';
const LINE_ID = 'thematic-map-lines';
/** Подложка под цветной линией: тема читается на тёмной и на светлой подложке */
const CASING_COLOR = '#ffffff';

const result = shallowRef<ThematicPipesResponse | null>(null);
const style = shallowRef<ThematicStyle | null>(null);
/** Название сохранённого стиля, если тема построена по нему */
const styleName = shallowRef<string>('');

let overlay: ReturnType<typeof useOverlayLayer> | null = null;
// создаётся при первом показе (из обработчика, не из setup): слой не снимается вместе с компонентом
const getOverlay = () => {
  overlay ??= useOverlayLayer(() => useMapStore().map, SOURCE_ID, { layerIds: [CASING_ID, LINE_ID] });
  return overlay;
};

const values = computed(() => result.value?.geojson.features.map((f) => f.properties.v) ?? []);

const categoryLabels = computed<Record<number, string>>(() =>
  Object.fromEntries((result.value?.summary.categories ?? []).map((c) => [c.value, c.label])));

const legend = computed<ThematicLegendRow[]>(() => {
  if (!result.value || !style.value) return [];
  return legendRows(style.value, values.value, {
    digits: result.value.theme.digits, units: result.value.theme.units, labels: categoryLabels.value,
  });
});

const casingWidth = (width: number) => ['interpolate', ['linear'], ['zoom'], 11, Math.max(1, width * 0.6) + 2,
  15, width + 2, 18, width * 1.8 + 2];

const applyStyle = (next: ThematicStyle) => {
  const ov = getOverlay();
  const map = useMapStore().map as { setFilter?: (id: string, filter: unknown) => void } | null;
  ov.setPaint(LINE_ID, 'line-color', colorExpression(next));
  ov.setPaint(LINE_ID, 'line-width', widthExpression(next.width));
  ov.setPaint(LINE_ID, 'line-opacity', next.opacity);
  ov.setPaint(CASING_ID, 'line-width', casingWidth(next.width));
  ov.setPaint(CASING_ID, 'line-opacity', Math.min(0.8, next.opacity));
  for (const id of [CASING_ID, LINE_ID]) map?.setFilter?.(id, layerFilter(next) ?? null);
};

export function useThematicMap() {
  /** Нарисовать тему; false — карты нет. Карта ещё грузит стиль — дождаться (иначе addSource падает) */
  const show = async (data: ThematicPipesResponse, next: ThematicStyle, name = ''): Promise<boolean> => {
    const map = useMapStore().map;
    if (!map) return false;
    if (!isStyleMutable(map as any)) await waitForStyleMutable(map as any);
    const filter = layerFilter(next);
    const lineLayout = { 'line-cap': 'round', 'line-join': 'round' };
    const ok = getOverlay().show(data.geojson, [
      {
        id: CASING_ID, type: 'line', layout: lineLayout, ...(filter ? { filter } : {}),
        paint: { 'line-color': CASING_COLOR, 'line-width': casingWidth(next.width), 'line-opacity': Math.min(0.8, next.opacity) },
      },
      {
        id: LINE_ID, type: 'line', layout: lineLayout, ...(filter ? { filter } : {}),
        paint: { 'line-color': colorExpression(next), 'line-width': widthExpression(next.width), 'line-opacity': next.opacity },
      },
    ]);
    if (!ok) return false;
    result.value = data;
    style.value = next;
    styleName.value = name;
    return true;
  };

  /** Сменить классы, цвета, толщину без повторной загрузки участков */
  const restyle = (next: ThematicStyle, name?: string) => {
    if (!result.value) return;
    style.value = next;
    if (name !== undefined) styleName.value = name;
    applyStyle(next);
  };

  const clear = () => {
    try {
      getOverlay().clear();
    } catch {
      // карта уже уничтожена — снимать нечего
    }
    result.value = null;
    style.value = null;
    styleName.value = '';
  };

  return {
    result,
    style,
    styleName,
    values,
    legend,
    categoryLabels,
    shown: computed(() => result.value !== null),
    show,
    restyle,
    clear,
  };
}
