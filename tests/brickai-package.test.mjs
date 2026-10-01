import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "../vendor/three/three.module.js";
import { BRICKLAYER_COLORS } from "../palette.js";
import { projectToVoxels } from "../selection3d.js";
import {
  BRICKAI_BACKGROUND,
  BRICKAI_RENDER_SIZE,
  BRICKAI_VIEWS,
  createBrickAiManifest,
  createBrickAiMetadata,
  createBrickAiPackage,
  sanitizeBrickAiFileName
} from "../brickai-package.js";
import { createZipBytes } from "../brickai-zip.js";
import { calculateBrickAiCameraFrame, cameraDirectionForBrickAiView } from "../brickai-renderer.js";

const project = {
  format: "bricklayers-v1",
  name: "7299 prueba",
  size: { x: 3, y: 2 },
  palette: Object.fromEntries(BRICKLAYER_COLORS.map((color) => [color.code, color.hex])),
  revision: 0,
  references: [],
  reference_image: { data_url: "", x: 0, y: 0, scale: 1, opacity: 100, block_opacity: 100 },
  construction_layout: null,
  layers: [
    { z: 0, matrix: ["AN.", ".B."] },
    { z: 2, matrix: ["A..", "..N"] }
  ]
};
const modelText = JSON.stringify(project, null, 2);
const png = new Uint8Array(160);
png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const manifest = createBrickAiManifest();
assert.equal(manifest.format, "brickai-package");
assert.equal(manifest.version, 1);
assert.equal(manifest.model, "model.bricklayers");
assert.equal(manifest.metadata, "metadata.json");
assert.deepEqual(Object.keys(manifest.views), BRICKAI_VIEWS.map((view) => view.key));
assert.deepEqual(BRICKAI_VIEWS.map((view) => view.file), [
  "front.png",
  "back.png",
  "left.png",
  "right.png",
  "top.png",
  "bottom.png",
  "iso_front_left.png",
  "iso_front_right.png",
  "iso_back.png"
]);

const metadata = createBrickAiMetadata(project);
assert.equal(metadata.format, "brickai-training-v1");
assert.equal(metadata.generator, "BrickLayer Mobile");
assert.deepEqual(metadata.block, { x_mm: 7, y_mm: 7, z_mm: 5 });
assert.deepEqual(metadata.dimensions, { x: 3, y: 2, z: 3 });
assert.deepEqual(metadata.physicalDimensionsMm, { width: 21, depth: 14, height: 15 });
assert.equal(metadata.voxelCount, 5);
assert.equal(metadata.voxelCount, projectToVoxels(project).length);
assert.equal(metadata.layerCount, 2);
assert.deepEqual(metadata.paletteCodesUsed, ["A", "N", "B"]);
assert.deepEqual(metadata.layers, [
  { z: 0, voxelCount: 3 },
  { z: 2, voxelCount: 2 }
]);
assert.deepEqual(metadata.colors.map((color) => ({
  code: color.code,
  name: color.name,
  hex: color.hex,
  voxelCount: color.voxelCount
})), [
  { code: "A", name: "Amarillo", hex: "#F4C400", voxelCount: 2 },
  { code: "N", name: "Negro", hex: "#111111", voxelCount: 2 },
  { code: "B", name: "Blanco", hex: "#F2F2F2", voxelCount: 1 }
]);
assert.equal(metadata.views.length, 9);
metadata.views.forEach((view) => {
  assert.equal(view.width, BRICKAI_RENDER_SIZE);
  assert.equal(view.height, BRICKAI_RENDER_SIZE);
  assert.equal(view.background, BRICKAI_BACKGROUND);
});

const viewImages = Object.fromEntries(BRICKAI_VIEWS.map((view) => [view.key, png]));
const packageResult = await createBrickAiPackage({ project, modelText, viewImages });
assert.equal(packageResult.blob.type, "application/zip");
assert.ok(packageResult.blob.size > modelText.length);

const zipBytes = new Uint8Array(await packageResult.blob.arrayBuffer());
const zipText = new TextDecoder().decode(zipBytes);
[
  "manifest.json",
  "model.bricklayers",
  "metadata.json",
  "views/front.png",
  "views/back.png",
  "views/left.png",
  "views/right.png",
  "views/top.png",
  "views/bottom.png",
  "views/iso_front_left.png",
  "views/iso_front_right.png",
  "views/iso_back.png"
].forEach((path) => assert.ok(zipText.includes(path), `ZIP contiene ${path}`));

assert.equal(JSON.stringify(JSON.parse(modelText), null, 2), modelText, "model.bricklayers conserva el serializador oficial recibido");
assert.equal(sanitizeBrickAiFileName("7299: Modelo Ñ"), "7299_modelo_n.brickai");
assert.ok(createZipBytes([{ path: "a.txt", bytes: new TextEncoder().encode("ok"), date: new Date(0) }]).length > 22);

const rendererSource = fs.readFileSync(new URL("../brickai-renderer.js", import.meta.url), "utf8");
assert.ok(rendererSource.includes("createBrickGeometries"));
assert.ok(!rendererSource.includes("createHighlight"));
assert.ok(!rendererSource.includes("OrbitControls"));

const viewerSource = fs.readFileSync(new URL("../viewer3d.js", import.meta.url), "utf8");
assert.ok(viewerSource.includes("front: [0, distance * 0.42, distance]"));
assert.ok(viewerSource.includes("back: [0, distance * 0.42, -distance]"));
assert.ok(viewerSource.includes("left: [-distance, distance * 0.42, 0]"));
assert.ok(viewerSource.includes("right: [distance, distance * 0.42, 0]"));
assert.ok(viewerSource.includes("top: [0, distance, 0.001]"));
assert.ok(viewerSource.includes("bottom: [0, -distance, 0.001]"));
assert.deepEqual(cameraDirectionForBrickAiView("front").toArray(), [0, 0.42, 1]);
assert.deepEqual(cameraDirectionForBrickAiView("bottom").toArray(), [0, -1, 0.001]);

const bounds = { halfSize: new THREE.Vector3(16.5, 23.2, 16.5), radius: 33 };
for (const view of BRICKAI_VIEWS) {
  const frame = calculateBrickAiCameraFrame(bounds, view.key, 1, 42, 0.18);
  assert.ok(Number.isFinite(frame.distance), `${view.key} distancia finita`);
  assert.ok(frame.distance > frame.projected.depth, `${view.key} encuadra fuera del modelo`);
}

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.ok(appSource.includes("serializeCurrentProjectForExport"));
assert.ok(appSource.includes("const modelText = JSON.stringify(project, null, 2);"));
assert.ok(appSource.includes('setStatus("Modelo .bricklayers...")'));
assert.ok(appSource.includes("await waitForUiFrame();"));
assert.ok(appSource.includes("setStatus(`${view.label} ${index + 1}/${BRICKAI_VIEWS.length}...`)"));
assert.ok(appSource.includes("finally"));
assert.ok(appSource.includes("els.exportBrickAiBtn.disabled = false"));

console.log("brickai package tests OK");
