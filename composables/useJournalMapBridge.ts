/**
 * Связь журналов с картой: показ контура (GeoJSON участков) и выбор участков контура кликами.
 * Состояние общее для приложения (модульный singleton): журнал запрашивает, MapViewer рисует.
 */
import { reactive, watch } from 'vue';

export interface ContourOverlay {
  label: string;
  geojson: { type: 'FeatureCollection'; features: any[] };
  bbox: [number, number, number, number] | null;
}

export type PickKind = 'line' | 'node';

interface PickState {
  active: boolean;
  label: string;
  /** Что выбирается кликом: участки (контуры журналов) или узлы (групповые установщики) */
  kind: PickKind;
  /** id выбранных объектов (linesobj.id для участков, nodes.id для узлов) */
  lineIds: number[];
  /** Геометрия выбранных кликом объектов — чтобы подсветить их до сохранения */
  features: Record<number, any>;
}

const state = reactive({
  overlay: null as ContourOverlay | null,
  overlayVersion: 0,
  pick: { active: false, label: '', kind: 'line', lineIds: [], features: {} } as PickState,
});

let resolvePick: ((ids: number[] | null) => void) | null = null;

export function useJournalMapBridge() {
  const showContour = (overlay: ContourOverlay) => {
    state.overlay = overlay;
    state.overlayVersion += 1;
  };

  const clearContour = () => {
    state.overlay = null;
    state.overlayVersion += 1;
  };

  /** Выбор участков (или узлов) на карте; Promise — итоговый список id (null — отмена) */
  const startPick = (initialIds: number[], label: string, kind: PickKind = 'line'): Promise<number[] | null> => {
    if (resolvePick) resolvePick(null);
    state.pick.active = true;
    state.pick.label = label;
    state.pick.kind = kind;
    state.pick.lineIds = [...initialIds];
    state.pick.features = {};
    return new Promise((resolve) => {
      resolvePick = resolve;
    });
  };

  const togglePicked = (lineId: number, feature?: any) => {
    if (!state.pick.active) return;
    const index = state.pick.lineIds.indexOf(lineId);
    if (index >= 0) {
      state.pick.lineIds.splice(index, 1);
      delete state.pick.features[lineId];
    } else {
      state.pick.lineIds.push(lineId);
      if (feature?.geometry) {
        state.pick.features[lineId] = { type: 'Feature', geometry: feature.geometry, properties: { line_id: lineId } };
      }
    }
  };

  const finishPick = (commit: boolean) => {
    const ids = commit ? [...state.pick.lineIds] : null;
    state.pick.active = false;
    state.pick.features = {};
    const resolve = resolvePick;
    resolvePick = null;
    resolve?.(ids);
  };

  return { state, showContour, clearContour, startPick, togglePicked, finishPick };
}

/**
 * Журнал закрывается, когда другой журнал начинает «Выбрать на карте» (QA F48): иначе его окно
 * остаётся поверх карты. Журнал-инициатор к этому моменту уже скрыт сам (hideForMap) — его не трогаем.
 * Вызывать в setup диалога.
 */
export function useCloseOnMapPick(isOpen: () => boolean, close: () => void) {
  watch(() => state.pick.active, (active) => {
    if (active && isOpen()) close();
  });
}
