function getRuntimeConfigSafe(): any {
  try {
    return useRuntimeConfig() as any;
  } catch {
    return {};
  }
}

export function getMapTilerKey(): string {
  const runtimeConfig = getRuntimeConfigSafe();
  return runtimeConfig.public?.maptilerKey || '';
}

export function getMapTilerTilesUrl(): string {
  return `https://api.maptiler.com/maps/bright-v2/256/{z}/{x}/{y}@2x.png?key=${getMapTilerKey()}`;
}

export function getMapTilerStreetsStyleUrl(): string {
  return `https://api.maptiler.com/maps/streets-v4/style.json?key=${getMapTilerKey()}`;
}

export function getMapTilerHybridStyleUrl(): string {
  return `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${getMapTilerKey()}`;
}

export function getMapTilerPlanetV4TilesUrl(): string {
  return `https://api.maptiler.com/tiles/v4/{z}/{x}/{y}.pbf?key=${getMapTilerKey()}`;
}

export function getMapTilerPlanetV4TileJsonUrl(): string {
  return `https://api.maptiler.com/tiles/v4/tiles.json?key=${getMapTilerKey()}`;
}

export function getMapTilerStreetsTilesUrl(): string {
  return `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}@2x.png?key=${getMapTilerKey()}`;
}

export function getMapTilerHybridTilesUrl(): string {
  return `https://api.maptiler.com/maps/hybrid-v4/256/{z}/{x}/{y}@2x.jpg?key=${getMapTilerKey()}`;
}

export function getMapTilerGlyphsUrl(): string {
  return `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${getMapTilerKey()}`;
}

export function getMapTilerContoursTilesUrl(): string {
  return `https://api.maptiler.com/tiles/contours-v2/{z}/{x}/{y}.pbf?key=${getMapTilerKey()}`;
}

export function getMapTilerBuildingsTilesUrl(): string {
  return `https://api.maptiler.com/tiles/buildings/{z}/{x}/{y}.pbf?key=${getMapTilerKey()}`;
}

export function getMapTilerHillshadeTilesUrl(): string {
  return `https://api.maptiler.com/tiles/hillshade/{z}/{x}/{y}.webp?key=${getMapTilerKey()}`;
}

export function getMapTilerTerrainRgbTilesUrl(): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${getMapTilerKey()}`;
}
