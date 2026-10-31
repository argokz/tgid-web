/**
 * Подземный вид теплосети в Cesium: трубы на глубине заложения (utils/network3d.ts) одним примитивом и
 * полупрозрачная земля вблизи, чтобы смотреть снизу; камера может уходить под поверхность.
 * С рельефом (Cesium World Terrain) высота поверхности у концов трубы берётся из рельефа, без него — эллипсоид.
 */
import type { Primitive, Viewer } from 'cesium';
import { depthColor, pipePositions, pipeWidth, type Network3dItem } from '~/utils/network3d';

type CesiumModule = typeof import('cesium');

const GROUND_ALPHA_NEAR = 0.35;     // земля вблизи — насквозь видно трубы
const NEAR_M = 300;
const FAR_M = 5000;                 // дальше — земля непрозрачная, как обычно

/** Прямоугольник вида камеры в градусах; null — камера смотрит в небо */
export function viewBbox(Cesium: CesiumModule, viewer: Viewer): [number, number, number, number] | null {
  const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  if (!rect) return null;
  return [Cesium.Math.toDegrees(rect.west), Cesium.Math.toDegrees(rect.south),
    Cesium.Math.toDegrees(rect.east), Cesium.Math.toDegrees(rect.north)];
}

/** Высоты рельефа у концов труб: {индекс: [у начала, у конца]}; без рельефа — пусто (эллипсоид, 0) */
async function groundHeights(Cesium: CesiumModule, viewer: Viewer, items: Network3dItem[]): Promise<Map<number, [number, number]>> {
  const out = new Map<number, [number, number]>();
  if (viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) return out;
  const points = items.flatMap(([, , , , , xy]) => [
    Cesium.Cartographic.fromDegrees(xy[0], xy[1]),
    Cesium.Cartographic.fromDegrees(xy[xy.length - 2], xy[xy.length - 1]),
  ]);
  const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, points);
  items.forEach((_, i) => out.set(i, [sampled[i * 2].height ?? 0, sampled[i * 2 + 1].height ?? 0]));
  return out;
}

/** Построить трубы одним примитивом (id экземпляра — id участка) */
export async function buildUnderground(Cesium: CesiumModule, viewer: Viewer, items: Network3dItem[]): Promise<Primitive> {
  const ground = await groundHeights(Cesium, viewer, items);
  const instances = items.map((item, i) => {
    const [g0, g1] = ground.get(i) ?? [0, 0];
    const color = Cesium.Color.fromCssColorString(depthColor(item[2], item[3]));
    return new Cesium.GeometryInstance({
      id: item[0],
      geometry: new Cesium.PolylineGeometry({
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(pipePositions(item, g0, g1)),
        width: pipeWidth(item[1]),
        vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        depthFailColor: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
      },
    });
  });
  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineColorAppearance({ translucent: false }),
    // трубы ниже поверхности не проходят тест глубины против земли — рисуются тем же цветом и там
    depthFailAppearance: new Cesium.PolylineColorAppearance({ translucent: false }),
    asynchronous: true,
  });
}

const READY_POLL_MS = 200;
const READY_TIMEOUT_MS = 60_000;

/** Дождаться сборки геометрии в воркерах: в режиме кадров по запросу (requestRenderMode) сам кадр не придёт */
export async function whenReady(viewer: Viewer, primitive: Primitive): Promise<void> {
  const started = Date.now();
  while (!primitive.ready && !primitive.isDestroyed()) {
    if (Date.now() - started > READY_TIMEOUT_MS) throw new Error('Геометрия труб не собралась за минуту');
    viewer.scene.requestRender();
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  viewer.scene.requestRender();
}

/** Включить или выключить подземный вид: полупрозрачная земля вблизи и камера под поверхностью */
export function setUndergroundView(Cesium: CesiumModule, viewer: Viewer, on: boolean): void {
  const globe = viewer.scene.globe;
  globe.translucency.enabled = on;
  globe.translucency.frontFaceAlphaByDistance = on
    ? new Cesium.NearFarScalar(NEAR_M, GROUND_ALPHA_NEAR, FAR_M, 1.0)
    : undefined as unknown as InstanceType<CesiumModule['NearFarScalar']>;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = !on;
  viewer.scene.requestRender();
}
