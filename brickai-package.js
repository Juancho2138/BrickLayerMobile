import { BRICKLAYER_COLORS } from "./palette.js";
import { projectToVoxels } from "./selection3d.js";
import { BRICK_PHYSICAL_SIZE } from "./viewer3d-model.js";
import { createZipBlob, entryToBytes } from "./brickai-zip.js";

export const BRICKAI_FORMAT = "brickai-training-v1";
export const BRICKAI_PACKAGE_FORMAT = "brickai-package";
export const BRICKAI_RENDER_SIZE = 1024;
export const BRICKAI_BACKGROUND = "#343941";
export const BRICKAI_VIEWS = Object.freeze([
  { key: "front", file: "front.png", label: "Frente" },
  { key: "back", file: "back.png", label: "Atras" },
  { key: "left", file: "left.png", label: "Izquierda" },
  { key: "right", file: "right.png", label: "Derecha" },
  { key: "top", file: "top.png", label: "Arriba" },
  { key: "bottom", file: "bottom.png", label: "Abajo" },
  { key: "isoFrontLeft", file: "iso_front_left.png", label: "Isometrica 1" },
  { key: "isoFrontRight", file: "iso_front_right.png", label: "Isometrica 2" },
  { key: "isoBack", file: "iso_back.png", label: "Isometrica 3" }
]);

export function createBrickAiManifest() {
  return {
    format: BRICKAI_PACKAGE_FORMAT,
    version: 1,
    model: "model.bricklayers",
    metadata: "metadata.json",
    views: Object.fromEntries(BRICKAI_VIEWS.map((view) => [view.key, `views/${view.file}`]))
  };
}

export function createBrickAiMetadata(project) {
  const voxels = projectToVoxels(project);
  const colorStats = countBy(voxels, (voxel) => voxel.colorCode);
  const layerStats = project.layers.map((layer) => ({
    z: layer.z,
    voxelCount: countLayerVoxels(layer)
  }));
  const zMax = project.layers.length ? Math.max(...project.layers.map((layer) => layer.z)) : 0;
  const dimensions = {
    x: project.size.x,
    y: project.size.y,
    z: zMax + 1
  };
  const paletteCodesUsed = BRICKLAYER_COLORS
    .map((color) => color.code)
    .filter((code) => colorStats.get(code));

  return {
    format: BRICKAI_FORMAT,
    generator: "BrickLayer Mobile",
    modelName: project.name || "Modelo",
    block: {
      x_mm: BRICK_PHYSICAL_SIZE.width,
      y_mm: BRICK_PHYSICAL_SIZE.depth,
      z_mm: BRICK_PHYSICAL_SIZE.height
    },
    dimensions,
    physicalDimensionsMm: {
      width: dimensions.x * BRICK_PHYSICAL_SIZE.width,
      depth: dimensions.y * BRICK_PHYSICAL_SIZE.depth,
      height: dimensions.z * BRICK_PHYSICAL_SIZE.height
    },
    voxelCount: voxels.length,
    layerCount: project.layers.length,
    paletteCodesUsed,
    colors: BRICKLAYER_COLORS
      .filter((color) => colorStats.get(color.code))
      .map((color) => ({
        code: color.code,
        name: color.name,
        hex: color.hex,
        voxelCount: colorStats.get(color.code)
      })),
    layers: layerStats,
    views: BRICKAI_VIEWS.map((view) => ({
      key: view.key,
      file: `views/${view.file}`,
      width: BRICKAI_RENDER_SIZE,
      height: BRICKAI_RENDER_SIZE,
      background: BRICKAI_BACKGROUND
    }))
  };
}

export async function createBrickAiPackage({ project, modelText, viewImages }) {
  const manifest = createBrickAiManifest();
  const metadata = createBrickAiMetadata(project);
  const entries = [
    { path: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    { path: "model.bricklayers", data: modelText },
    { path: "metadata.json", data: JSON.stringify(metadata, null, 2) }
  ];

  BRICKAI_VIEWS.forEach((view) => {
    entries.push({ path: `views/${view.file}`, data: viewImages[view.key] });
  });

  await validateBrickAiPackageEntries({ entries, manifest, metadata, project, modelText });
  return {
    blob: await createZipBlob(entries),
    manifest,
    metadata,
    entries
  };
}

export async function validateBrickAiPackageEntries({ entries, manifest, metadata, project, modelText }) {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const requiredPaths = [
    "manifest.json",
    "model.bricklayers",
    "metadata.json",
    ...BRICKAI_VIEWS.map((view) => `views/${view.file}`)
  ];
  requiredPaths.forEach((path) => {
    if (!byPath.has(path)) throw new Error(`Falta ${path} en el paquete .brickai.`);
  });

  const model = JSON.parse(modelText);
  const modelVoxelCount = projectToVoxels(model).length;
  const projectVoxelCount = projectToVoxels(project).length;
  if (metadata.voxelCount !== modelVoxelCount || modelVoxelCount !== projectVoxelCount) {
    throw new Error("El conteo de voxels de metadata no coincide con model.bricklayers.");
  }
  if (metadata.dimensions.x !== project.size.x || metadata.dimensions.y !== project.size.y) {
    throw new Error("Las dimensiones XY de metadata no coinciden con el proyecto.");
  }
  const expectedZ = project.layers.length ? Math.max(...project.layers.map((layer) => layer.z)) + 1 : 0;
  if (metadata.dimensions.z !== expectedZ) {
    throw new Error("La dimension Z de metadata no coincide con el proyecto.");
  }
  if (manifest.model !== "model.bricklayers" || manifest.metadata !== "metadata.json") {
    throw new Error("Manifest .brickai invalido.");
  }

  for (const view of BRICKAI_VIEWS) {
    const path = `views/${view.file}`;
    if (manifest.views[view.key] !== path) throw new Error(`Manifest no referencia ${path}.`);
    const bytes = await entryToBytes(byPath.get(path).data);
    if (!isPng(bytes) || bytes.length < 128) throw new Error(`Vista PNG invalida o vacia: ${path}.`);
  }
}

export function sanitizeBrickAiFileName(name) {
  return `${String(name || "modelo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "modelo"}.brickai`;
}

function countLayerVoxels(layer) {
  return layer.matrix.reduce((sum, row) => {
    let count = 0;
    for (const char of row) if (char !== ".") count += 1;
    return sum + count;
  }, 0);
}

function countBy(items, keyFn) {
  const counts = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function isPng(bytes) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}
