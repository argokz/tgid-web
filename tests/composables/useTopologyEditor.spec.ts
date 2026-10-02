import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

const { api, notify, vertex, markers } = vi.hoisted(() => ({
  markers: [] as any[],
  api: {
    getTopologyVersions: vi.fn(),
    getLastTopologyOperation: vi.fn(),
    undoTopologyOperation: vi.fn(),
    createNode: vi.fn(),
    createLine: vi.fn(),
    moveNode: vi.fn(),
    previewMergeNodes: vi.fn(),
    mergeNodes: vi.fn(),
    previewSplitLine: vi.fn(),
    splitLine: vi.fn(),
    deleteNode: vi.fn(),
    deleteLine: vi.fn(),
  },
  notify: {
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
    showError: vi.fn(),
    showConflict: vi.fn(),
  },
  vertex: {} as any,
}));

vi.mock('~/services/fastApiService', () => {
  class ApiError extends Error {
    constructor(public userMessage: string, public isVersionConflict = false) { super(userMessage); }
  }
  return { ApiError, fastApiService: api };
});
vi.mock('~/stores/notificationStore', () => ({ useNotificationStore: () => notify }));
vi.mock('~/composables/useLineVertexEditor', async () => {
  const { ref: vref } = await import('vue');
  return {
    useLineVertexEditor: () => {
      Object.assign(vertex, {
        dirty: vref(false),
        active: vref(false),
        stop: vi.fn(),
        load: vi.fn(),
        onMouseDown: vi.fn(),
        onMouseMove: vi.fn(),
        onMouseUp: vi.fn(() => false),
        onContextMenu: vi.fn(),
      });
      return vertex;
    },
  };
});
vi.mock('maplibre-gl', () => {
  class Marker {
    lngLat: any;
    constructor(public opts: any) { markers.push(this); }
    setLngLat(v: any) { this.lngLat = Array.isArray(v) ? { lng: v[0], lat: v[1] } : v; return this; }
    getLngLat() { return this.lngLat; }
    addTo() { return this; }
    remove() { return this; }
  }
  return { default: { Marker } };
});

import { ApiError } from '~/services/fastApiService';
import { useTopologyEditor } from '~/composables/useTopologyEditor';
import { confirmState, settleConfirm } from '~/composables/useConfirm';

const nodeFeature = (id: number, coords = [76.9, 43.2]) => ({
  layer: { id: 'tgid-nodes' }, properties: { id }, geometry: { type: 'Point', coordinates: coords },
});
const lineFeature = (id: number) => ({
  layer: { id: 'tgid-lines' }, properties: { id }, geometry: { type: 'LineString', coordinates: [] },
});

// Копии объекта в разных фрагментах (MVT uzel / heatpipesections), QA F53
const uzel = (id: number, fileid: number) => ({
  id, layer: { id: 'mvt__AlmatyGIS__uzel-6-rule-7-point-1' }, sourceLayer: 'uzel',
  properties: { fileid, tab: 'generalizedconsumers' }, geometry: { type: 'Point', coordinates: [76.89, 43.23] },
});
const pipe = (id: number, fileid: number) => ({
  id, layer: { id: 'mvt__AlmatyGIS__heatpipesections-2' }, sourceLayer: 'heatpipesections',
  properties: { fileid, code: 'UT' }, geometry: { type: 'LineString', coordinates: [] },
});

const setup = (extra: Record<string, any> = {}) => {
  let features: any[] = [];
  const map = {
    queryRenderedFeatures: vi.fn(() => features),
    project: (c: [number, number]) => ({ x: c[0], y: c[1] }),
    dragPan: { enable: vi.fn(), disable: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
  };
  const opts = {
    getMap: () => map as any,
    enabled: ref(true),
    isTraceMode: ref(true),
    isDrawActive: vi.fn(() => false),
    setIdentifyMode: vi.fn(),
    refreshLayers: vi.fn(),
    getSelectedFeature: vi.fn(() => ({ layerId: 'tgid-nodes' })),
    closeCard: vi.fn(),
    ...extra,
  };
  const editor = useTopologyEditor(opts);
  const click = (lng = 76.95, lat = 43.25) => editor.onMapClickForTopology({ point: { x: 10, y: 10 }, lngLat: { lng, lat } });
  return { map, opts, editor, click, setFeatures: (f: any[]) => { features = f; } };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useTopologyEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTopologyVersions.mockImplementation(async (req: any) => {
      const kind = Object.keys(req)[0];
      return { [kind]: Object.fromEntries(req[kind].map((id: number) => [String(id), { version: `v${id}` }])) };
    });
    api.getLastTopologyOperation.mockResolvedValue(null);
  });

  it('включение/выключение режима: identify, трассировка, запрет во время рисования', async () => {
    const { editor, opts } = setup();
    opts.isDrawActive.mockReturnValueOnce(true);
    editor.toggleEditTopologyMode();
    expect(editor.isEditTopologyMode.value).toBe(false);
    expect(notify.showWarning).toHaveBeenCalled();

    editor.toggleEditTopologyMode();
    expect(editor.isEditTopologyMode.value).toBe(true);
    expect(opts.isTraceMode.value).toBe(false);
    expect(opts.setIdentifyMode).toHaveBeenLastCalledWith(false);
    expect(api.getLastTopologyOperation).toHaveBeenCalled();

    editor.toggleEditTopologyMode();
    expect(editor.isEditTopologyMode.value).toBe(false);
    expect(opts.setIdentifyMode).toHaveBeenLastCalledWith(true);
  });

  it('потеря права на правку закрывает режим', async () => {
    const { editor, opts } = setup();
    editor.toggleEditTopologyMode();
    opts.enabled.value = false;
    await nextTick();
    expect(editor.isEditTopologyMode.value).toBe(false);
  });

  it('клик по пустому месту создаёт узел; вне режима клики игнорируются', async () => {
    const { editor, opts, click } = setup();
    await click();
    expect(api.createNode).not.toHaveBeenCalled();
    editor.toggleEditTopologyMode();
    api.createNode.mockResolvedValue({ id: 101, fileid: 3 });
    await click(76.95, 43.25);
    expect(api.createNode).toHaveBeenCalledWith(76.95, 43.25);
    expect(opts.refreshLayers).toHaveBeenCalled();
  });

  it('два узла подряд создают участок с версиями обоих узлов', async () => {
    const { editor, click, setFeatures } = setup();
    editor.toggleEditTopologyMode();
    api.createLine.mockResolvedValue({ passport: { template_line_id: 9 } });
    setFeatures([nodeFeature(1)]);
    await click();
    setFeatures([nodeFeature(2)]);
    await click();
    expect(api.createLine).toHaveBeenCalledWith(1, 2, { nodeid1: 'v1', nodeid2: 'v2' });
  });

  it('перетаскивание узла пишет moveNode с версией на момент захвата; клик без сдвига — нет', async () => {
    const { editor, setFeatures, map } = setup();
    editor.toggleEditTopologyMode();
    setFeatures([nodeFeature(5, [76.9, 43.2])]);
    const down = { point: { x: 0, y: 0 }, lngLat: { lng: 76.9, lat: 43.2 }, preventDefault: vi.fn() };
    editor.onMapMouseDownForTopology(down);
    await editor.onNodeDragEnd();
    expect(api.moveNode).not.toHaveBeenCalled();

    editor.onMapMouseDownForTopology(down);
    setFeatures([]);
    editor.onMapMouseMoveForTopology({ point: { x: 50, y: 0 }, lngLat: { lng: 77, lat: 43.3 } });
    await editor.onNodeDragEnd();
    expect(api.moveNode).toHaveBeenCalledWith(5, 77, 43.3, 'v5');
    expect(map.dragPan.enable).toHaveBeenCalled();
  });

  it('слияние: целевой узел, источник → превью; подтверждение уходит с версиями превью', async () => {
    const { editor, click, setFeatures } = setup();
    editor.toggleEditTopologyMode();
    editor.toggleMergeMode();
    api.previewMergeNodes.mockResolvedValue({ versions: { 'node:1': 'a', 'node:2': 'b' } });
    api.mergeNodes.mockResolvedValue({ merged_lines: 2, transferred: {} });
    setFeatures([nodeFeature(1)]);
    await click();
    setFeatures([nodeFeature(2)]);
    await click();
    expect(editor.mergeConfirmDialogOpen.value).toBe(true);
    await editor.confirmMerge();
    expect(api.mergeNodes).toHaveBeenCalledWith({ target_node_id: 1, source_node_id: 2, target_version: 'a', source_version: 'b' });
    expect(editor.isMergeMode.value).toBe(false);
  });

  it('разрезание: клик по участку → превью, подтверждение с версией участка', async () => {
    const { editor, click, setFeatures } = setup();
    editor.toggleEditTopologyMode();
    api.previewSplitLine.mockResolvedValue({ transferred: {}, versions: { 'line:7': 'L7' } });
    api.splitLine.mockResolvedValue({ new_node_id: 1, new_line_id: 2, transferred: {} });
    setFeatures([lineFeature(7)]);
    await click(76.1, 43.1);
    expect(editor.splitPreviewOpen.value).toBe(true);
    await editor.confirmSplit();
    expect(api.splitLine).toHaveBeenCalledWith(7, 76.1, 43.1, 'L7', {});
    expect(editor.splitPreviewOpen.value).toBe(false);
  });

  it('409 при перемещении показывает конфликт с кнопкой перезагрузки', async () => {
    const { editor, setFeatures, opts } = setup();
    editor.toggleEditTopologyMode();
    setFeatures([nodeFeature(5)]);
    api.moveNode.mockRejectedValue(new (ApiError as any)('Изменён другим пользователем', true));
    editor.onMapMouseDownForTopology({ point: { x: 0, y: 0 }, lngLat: { lng: 1, lat: 1 }, preventDefault: vi.fn() });
    setFeatures([]);
    editor.onMapMouseMoveForTopology({ point: { x: 40, y: 0 }, lngLat: { lng: 2, lat: 2 } });
    await editor.onNodeDragEnd();
    expect(notify.showConflict).toHaveBeenCalledWith('Изменён другим пользователем', expect.any(Function));
    await notify.showConflict.mock.calls[0][1]();
    expect(opts.refreshLayers).toHaveBeenCalled();
  });

  it('отмена последней операции и удаление из карточки', async () => {
    const { editor, opts } = setup();
    api.getLastTopologyOperation.mockResolvedValue({ operation_id: 42, operation: 'create_node', undo_supported: true });
    editor.toggleEditTopologyMode();
    await flush();
    expect(editor.lastTopologyOperation.value?.operation_id).toBe(42);
    api.undoTopologyOperation.mockResolvedValue({ deleted: { nodes: [1] }, restored: {} });
    await editor.undoLastTopologyOperation();
    expect(api.undoTopologyOperation).toHaveBeenCalledWith(42);

    // QA F45: подтверждение своим диалогом, не window.confirm
    const pending = editor.onDeleteFeature(11, 'ver');
    await flush();
    expect(confirmState.visible).toBe(true);
    expect(confirmState.text).toContain('узел 11');
    settleConfirm(true);
    await pending;
    expect(api.deleteNode).toHaveBeenCalledWith(11, 'ver');
    expect(opts.closeCard).toHaveBeenCalled();
  });

  it('QA F52: клик по узлу (mousedown → mouseup → click) выбирает его, маркер не создаётся', async () => {
    const { editor, setFeatures, map } = setup();
    editor.toggleEditTopologyMode();
    api.createLine.mockResolvedValue({});
    markers.length = 0;
    const press = async (id: number) => {
      setFeatures([nodeFeature(id)]);
      editor.onMapMouseDownForTopology({ point: { x: 10, y: 10 }, lngLat: { lng: 76.9, lat: 43.2 }, preventDefault: vi.fn() });
      editor.onMapMouseMoveForTopology({ point: { x: 11, y: 10 }, lngLat: { lng: 76.9, lat: 43.2 } }); // дрожь < порога
      await editor.onNodeDragEnd();
      await editor.onMapClickForTopology({ point: { x: 10, y: 10 }, lngLat: { lng: 76.9, lat: 43.2 } });
    };
    await press(1);
    expect(markers).toHaveLength(0);
    expect(api.moveNode).not.toHaveBeenCalled();
    expect(map.dragPan.enable).toHaveBeenCalled();
    expect(editor.topologyStartNode.value).toBe(1);
    await press(2);
    expect(api.createLine).toHaveBeenCalledWith(1, 2, { nodeid1: 'v1', nodeid2: 'v2' });
  });

  it('QA F53: разрезание и выбор узла — объекты активного фрагмента, а не первые под курсором', async () => {
    const { editor, click, setFeatures } = setup({ getActiveFragmentIds: () => [74] });
    editor.toggleEditTopologyMode();
    api.previewSplitLine.mockResolvedValue({ transferred: {}, versions: {} });
    setFeatures([pipe(381, 1), pipe(324388, 74), pipe(370367, 89)]);
    await click(76.1, 43.1);
    expect(api.previewSplitLine).toHaveBeenCalledWith(324388, 76.1, 43.1);

    setFeatures([uzel(13402, 4), uzel(535475, 74), uzel(888, 1)]);
    await click();
    expect(editor.topologyStartNode.value).toBe(535475);
  });

  it('QA F53: несколько кандидатов — меню выбора; отказ в меню ничего не делает', async () => {
    const chooseCandidate = vi.fn(async (c: any[]) => c.find((x) => x.fragmentId === 74));
    const { editor, click, setFeatures } = setup({ chooseCandidate });
    editor.toggleEditTopologyMode();
    api.previewSplitLine.mockResolvedValue({ transferred: {}, versions: {} });
    setFeatures([pipe(381, 1), pipe(324388, 74)]);
    await click(76.1, 43.1);
    expect(chooseCandidate.mock.calls[0][0].map((c: any) => c.id)).toEqual([381, 324388]);
    expect(api.previewSplitLine).toHaveBeenCalledWith(324388, 76.1, 43.1);

    chooseCandidate.mockResolvedValueOnce(undefined as any);
    setFeatures([uzel(888, 1), uzel(535475, 74)]);
    await click();
    expect(editor.topologyStartNode.value).toBeNull();
    expect(api.createNode).not.toHaveBeenCalled();
  });

  it('QA F53: второй узел участка — только из фрагмента первого; чужой — отказ, без нового узла', async () => {
    const { editor, click, setFeatures } = setup();
    editor.toggleEditTopologyMode();
    setFeatures([uzel(535475, 74)]);
    await click();
    setFeatures([uzel(888, 1)]);
    await click();
    expect(api.createLine).not.toHaveBeenCalled();
    expect(api.createNode).not.toHaveBeenCalled();
    expect(notify.showWarning).toHaveBeenCalledWith(expect.stringContaining('фрагмента 74'));
    expect(editor.topologyStartNode.value).toBe(535475);

    api.createLine.mockResolvedValue({});
    setFeatures([uzel(889, 1), uzel(535476, 74)]); // копии: берётся узел фрагмента 74 без меню
    await click();
    expect(api.createLine).toHaveBeenCalledWith(535475, 535476, expect.any(Object));
  });

  it('QA F53: копии узла в нескольких фрагментах не перетаскиваются', async () => {
    const { editor, setFeatures, map } = setup();
    editor.toggleEditTopologyMode();
    setFeatures([uzel(888, 1), uzel(535475, 74)]);
    editor.onMapMouseDownForTopology({ point: { x: 0, y: 0 }, lngLat: { lng: 1, lat: 1 }, preventDefault: vi.fn() });
    expect(map.dragPan.disable).not.toHaveBeenCalled();
    editor.onMapMouseMoveForTopology({ point: { x: 40, y: 0 }, lngLat: { lng: 2, lat: 2 } });
    await editor.onNodeDragEnd();
    expect(api.moveNode).not.toHaveBeenCalled();
  });

  it('attach/detach подписывают и снимают обработчики карты', () => {
    const { editor, map } = setup();
    editor.attach(map as any);
    expect(map.on.mock.calls.map((c: any[]) => c[0])).toEqual(['mousedown', 'mousemove', 'mouseup', 'click', 'contextmenu']);
    editor.detach(map as any);
    expect(map.off).toHaveBeenCalledTimes(5);
  });
});
