export function projectToVoxels(project) {
  const voxels = [];
  project.layers.forEach((layer) => {
    layer.matrix.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const colorCode = row[x];
        if (colorCode !== ".") voxels.push({ x, y, z: layer.z, colorCode });
      }
    });
  });
  return voxels;
}

export function voxelKey(voxel) {
  return `${voxel.x},${voxel.y},${voxel.z}`;
}

export function buildVoxelIndex(voxels, visibleFilter = () => true) {
  const index = new Map();
  voxels.forEach((voxel) => {
    if (visibleFilter(voxel)) index.set(voxelKey(voxel), voxel);
  });
  return index;
}

export function findConnectedSameColor(voxels, startVoxel, visibleFilter = () => true) {
  if (!startVoxel || !visibleFilter(startVoxel)) return [];
  const index = buildVoxelIndex(voxels, visibleFilter);
  const startKey = voxelKey(startVoxel);
  const indexedStart = index.get(startKey);
  if (!indexedStart) return [];

  const colorCode = indexedStart.colorCode;
  const result = [];
  const seen = new Set();
  const queue = [indexedStart];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const voxel = queue[cursor];
    const key = voxelKey(voxel);
    if (seen.has(key)) continue;
    seen.add(key);
    if (voxel.colorCode !== colorCode) continue;
    result.push(voxel);

    neighbors6(voxel).forEach((neighbor) => {
      const next = index.get(voxelKey(neighbor));
      if (next && !seen.has(voxelKey(next)) && next.colorCode === colorCode) queue.push(next);
    });
  }

  return result;
}

export function findAllSameColor(voxels, colorCode, visibleFilter = () => true) {
  return voxels.filter((voxel) => voxel.colorCode === colorCode && visibleFilter(voxel));
}

export function addManualSelection(selectionKeys, voxel) {
  const next = new Set(selectionKeys);
  if (voxel) next.add(voxelKey(voxel));
  return next;
}

export function removeManualSelection(selectionKeys, voxel) {
  const next = new Set(selectionKeys);
  if (voxel) next.delete(voxelKey(voxel));
  return next;
}

export function clearSelection() {
  return new Set();
}

export function selectionSummary(voxels, selectionKeys, colorNames = {}) {
  const selected = voxels.filter((voxel) => selectionKeys.has(voxelKey(voxel)));
  const colors = new Set(selected.map((voxel) => voxel.colorCode));
  const onlyColor = colors.size === 1 ? selected[0]?.colorCode || null : null;
  return {
    count: selected.length,
    colorCode: onlyColor,
    colorName: onlyColor ? colorNames[onlyColor] || onlyColor : null
  };
}

export function recolorProjectVoxels(project, selectionKeys, newColorCode) {
  const changes = [];
  project.layers.forEach((layer) => {
    const rows = layer.matrix.slice();
    let layerChanged = false;
    rows.forEach((row, y) => {
      let nextRow = row;
      for (let x = 0; x < row.length; x += 1) {
        const key = `${x},${y},${layer.z}`;
        const previousColor = row[x];
        if (!selectionKeys.has(key) || previousColor === "." || previousColor === newColorCode) continue;
        nextRow = nextRow.slice(0, x) + newColorCode + nextRow.slice(x + 1);
        layerChanged = true;
        changes.push({ x, y, z: layer.z, from: previousColor, to: newColorCode });
      }
      rows[y] = nextRow;
    });
    if (layerChanged) layer.matrix = rows;
  });
  return changes;
}

function neighbors6({ x, y, z }) {
  return [
    { x: x + 1, y, z },
    { x: x - 1, y, z },
    { x, y: y + 1, z },
    { x, y: y - 1, z },
    { x, y, z: z + 1 },
    { x, y, z: z - 1 }
  ];
}
