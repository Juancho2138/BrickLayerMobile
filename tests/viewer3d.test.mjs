import assert from "node:assert/strict";
import fs from "node:fs";
import { BRICK_PHYSICAL_SIZE, BRICK_RENDER_SCALE, normalizeViewer3dBackground } from "../viewer3d-model.js";
import { collectBlocks, countLogicalVisibleVoxels } from "../viewer3d.js";

const viewerSource = fs.readFileSync(new URL("../viewer3d.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

assert.deepEqual(BRICK_PHYSICAL_SIZE, { width: 7, depth: 7, height: 5 });
assert.equal(BRICK_RENDER_SCALE.stepZ, 5 / 7);
assert.equal(BRICK_RENDER_SCALE.stepX, 1);
assert.equal(BRICK_RENDER_SCALE.stepY, 1);
assert.ok(BRICK_RENDER_SCALE.bodyHeight < BRICK_RENDER_SCALE.stepZ);
assert.ok(BRICK_RENDER_SCALE.bodyWidth < BRICK_RENDER_SCALE.stepX);
assert.ok(BRICK_RENDER_SCALE.bodyDepth < BRICK_RENDER_SCALE.stepY);

assert.equal(normalizeViewer3dBackground("dark"), "#080b10");
assert.equal(normalizeViewer3dBackground("black"), "#000000");
assert.equal(normalizeViewer3dBackground("custom", "#123abc"), "#123abc");
assert.equal(normalizeViewer3dBackground("custom", "bad"), "#080b10");

const sampleProject = {
  name: "Viewer",
  size: { x: 2, y: 1 },
  palette: { A: "#F4C400", G: "#808080" },
  layers: [
    { z: 0, matrix: ["AG"] },
    { z: 1, matrix: ["A."] }
  ]
};
assert.equal(collectBlocks(sampleProject, [sampleProject.layers[0]]).length, 2);
assert.equal(collectBlocks(sampleProject, sampleProject.layers).length, 3);

const tenVoxelProject = {
  name: "Ten",
  size: { x: 5, y: 2 },
  palette: { A: "#F4C400" },
  layers: [{ z: 0, matrix: ["AAAAA", "AAAAA"] }]
};
assert.equal(countLogicalVisibleVoxels(tenVoxelProject, tenVoxelProject.layers), 10);
const visualPartsPerVoxel = 3;
const highlightedVoxels = 4;
assert.equal(countLogicalVisibleVoxels(tenVoxelProject, tenVoxelProject.layers), 10);
assert.notEqual(10 * visualPartsPerVoxel + highlightedVoxels, countLogicalVisibleVoxels(tenVoxelProject, tenVoxelProject.layers));

assert.ok(viewerSource.includes("userData.voxels[index] = voxel"));
assert.ok(viewerSource.includes("hit.object.userData.voxels[hit.instanceId]"));
assert.ok(viewerSource.includes("findConnectedSameColor(visibleVoxels, voxel)"));
assert.ok(viewerSource.includes("findAllSameColor(visibleVoxels, voxel.colorCode)"));
assert.ok(viewerSource.includes("isTapGesture(pointerStart, event, 8)"));
assert.ok(viewerSource.includes("emptyMessage.hidden = total > 0"));
assert.ok(viewerSource.includes('emptyMessage.style.display = total > 0 ? "none" : "grid"'));
assert.ok(viewerSource.includes("CylinderGeometry(BRICK_RENDER_SCALE.studRadius"));
assert.ok(viewerSource.includes("TorusGeometry"));
assert.ok(viewerSource.includes("bottomSocketRadius"));
assert.ok(viewerSource.includes("InstancedMesh"));
assert.ok(viewerSource.includes("getViewerBackground"));

assert.ok(htmlSource.includes('data-view3d="bottom"'));
assert.ok(htmlSource.includes('id="viewer3dRecolorToggle"'));
assert.ok(htmlSource.includes('id="viewer3dRecolorPanel" class="viewer3d-recolor-bar"'));
assert.ok(htmlSource.includes('data-selection-mode="connected"'));
assert.ok(htmlSource.includes('data-selection-mode="all-color"'));
assert.ok(htmlSource.includes('id="viewer3dColorSwatch"'));
assert.ok(htmlSource.includes('id="viewer3dColorPopover"'));
assert.ok(htmlSource.includes('id="viewer3dApplyColor"'));
assert.ok(htmlSource.includes('data-viewer-background="dark"'));
assert.ok(htmlSource.includes('src="./app.js?v=viewer3d-recolor-v3"'));
assert.ok(cssSource.includes(".viewer3d-empty[hidden]"));
assert.ok(cssSource.includes(".viewer3d-recolor-bar"));
assert.ok(cssSource.includes(".viewer3d-color-popover"));
assert.ok(cssSource.includes("background: var(--viewer3d-bg);"));

console.log("viewer 3D tests OK");
