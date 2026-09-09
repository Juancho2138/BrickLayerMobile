export function quickPdfSettings(project) {
  const minZ = minLayerZ(project);
  const maxZ = maxLayerZ(project);
  return {
    profile: "quick",
    layerMode: "all",
    fromZ: minZ,
    toZ: maxZ,
    pageOrientation: "auto",
    useOrganization: true,
    includeLayerNumber: true,
    includeMatrix: true,
    includeColors: true,
    includePieceDivisions: true,
    includeReferences: true,
    includeLayerPieceCount: true,
    includeInventory: false,
    include3dViews: false,
    includeStats: true,
    includePieceIds: false,
    cumulative3d: "cover"
  };
}

export function professionalPdfSettings(project) {
  const minZ = minLayerZ(project);
  const maxZ = maxLayerZ(project);
  return {
    profile: "professional",
    layerMode: "all",
    fromZ: minZ,
    toZ: maxZ,
    pageOrientation: "auto",
    useOrganization: true,
    includeLayerNumber: true,
    includeMatrix: true,
    includeColors: true,
    includePieceDivisions: true,
    includeReferences: true,
    includeLayerPieceCount: true,
    includeInventory: true,
    include3dViews: true,
    includeStats: true,
    includePieceIds: false,
    cumulative3d: "every5"
  };
}

function minLayerZ(project) {
  return project.layers.length ? Math.min(...project.layers.map((layer) => layer.z)) : 0;
}

function maxLayerZ(project) {
  return project.layers.length ? Math.max(...project.layers.map((layer) => layer.z)) : 0;
}
