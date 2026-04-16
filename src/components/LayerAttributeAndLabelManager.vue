const updateStyle = async (property: string, value: any) => {
  if (!props.layerId) return;
  
  console.log('Updating style for layer', props.layerId, {
    property,
    value,
    currentStyle: layerStyle.value,
    layerType: layerType.value,
    isLineLayer: isLineLayer.value,
    isIconLayer: isIconLayer.value
  });

  // Update the style object
  if (layerStyle.value) {
    layerStyle.value[property] = value;
  }

  // Special handling for opacity
  if (property === 'opacity') {
    await handleOpacityChange(value);
    return; // Exit early as opacity is handled separately
  }

  // For other properties, apply the complete style
  await applyStylesToLayers([props.layerId]);
};

const applyStylesToLayers = async (layerIds: string[]) => {
  console.log('Применяем стили к следующим слоям:', layerIds);
  
  for (const layerId of layerIds) {
    const layer = mapStore.getLayerById(layerId);
    if (!layer) {
      console.warn(`Layer ${layerId} not found`);
      continue;
    }

    const layerType = getLayerType(layerId);
    console.log(`Applying properties to layer ${layerId} of type ${layerType}`);

    if (layerType === 'circle') {
      const style = layerStyle.value;
      if (!style) continue;

      // Apply circle properties only if they are defined
      if (style.color) {
        console.log(`Set circle-color=${style.color} for layer ${layerId}`);
        layer.setPaintProperty('circle-color', style.color);
      }
      if (style.opacity !== undefined) {
        console.log(`Set circle-opacity=${style.opacity} for layer ${layerId}`);
        layer.setPaintProperty('circle-opacity', style.opacity);
      }
      if (style.circleRadius !== undefined) {
        console.log(`Set circle-radius=${style.circleRadius} for layer ${layerId}`);
        layer.setPaintProperty('circle-radius', style.circleRadius);
      }
      if (style.lineWidth !== undefined) {
        console.log(`Set circle-stroke-width=${style.lineWidth} for layer ${layerId}`);
        layer.setPaintProperty('circle-stroke-width', style.lineWidth);
      }
      if (style.outlineColor) {
        console.log(`Set circle-stroke-color=${style.outlineColor} for layer ${layerId}`);
        layer.setPaintProperty('circle-stroke-color', style.outlineColor);
      }
    }
    // ... rest of the layer type handling ...
  }
}; 