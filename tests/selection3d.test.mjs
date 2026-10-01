import assert from "node:assert/strict";
import {
  addManualSelection,
  clearSelection,
  findAllSameColor,
  findConnectedSameColor,
  projectToVoxels,
  recolorProjectVoxels,
  removeManualSelection,
  voxelKey
} from "../selection3d.js";

function project(layers) {
  return {
    size: { x: 4, y: 4 },
    palette: { A: "#F4C400", G: "#808080", M: "#9B5A2E" },
    layers: layers.map(([z, matrix]) => ({ z, matrix }))
  };
}

function keys(voxels) {
  return voxels.map(voxelKey).sort();
}

let p = project([[0, ["G...", "....", "....", "...."]]]);
let voxels = projectToVoxels(p);
assert.deepEqual(keys(findConnectedSameColor(voxels, voxels[0])), ["0,0,0"]);

p = project([[0, ["GG..", "....", "....", "...."]]]);
voxels = projectToVoxels(p);
assert.deepEqual(keys(findConnectedSameColor(voxels, voxels[0])), ["0,0,0", "1,0,0"]);

p = project([[0, ["G...", "G...", "....", "...."]]]);
voxels = projectToVoxels(p);
assert.deepEqual(keys(findConnectedSameColor(voxels, voxels[0])), ["0,0,0", "0,1,0"]);

p = project([
  [0, ["G...", "....", "....", "...."]],
  [1, ["G...", "....", "....", "...."]]
]);
voxels = projectToVoxels(p);
assert.deepEqual(keys(findConnectedSameColor(voxels, voxels[0])), ["0,0,0", "0,0,1"]);

p = project([[0, ["G...", ".G..", "....", "...."]]]);
voxels = projectToVoxels(p);
assert.deepEqual(keys(findConnectedSameColor(voxels, voxels[0])), ["0,0,0"]);

p = project([
  [0, ["G...", "....", "....", "...."]],
  [1, [".G..", "....", "....", "...."]]
]);
voxels = projectToVoxels(p);
assert.deepEqual(keys(findConnectedSameColor(voxels, voxels[0])), ["0,0,0"]);

p = project([[0, ["GG.G", "....", "....", "...."]]]);
voxels = projectToVoxels(p);
assert.deepEqual(keys(findConnectedSameColor(voxels, voxels[0])), ["0,0,0", "1,0,0"]);

p = project([[0, ["GGGG", "GGGG", "GGGG", "GGGG"]]]);
voxels = projectToVoxels(p);
assert.equal(findConnectedSameColor(voxels, voxels[0]).length, 16);

p = project([
  [0, ["GMG.", "....", "....", "...."]],
  [1, ["G.G.", "....", "....", "...."]]
]);
voxels = projectToVoxels(p);
assert.deepEqual(keys(findAllSameColor(voxels, "G")), ["0,0,0", "0,0,1", "2,0,0", "2,0,1"]);
assert.deepEqual(keys(findAllSameColor(voxels, "G", (voxel) => voxel.z <= 0)), ["0,0,0", "2,0,0"]);

let selection = new Set();
selection = addManualSelection(selection, { x: 0, y: 0, z: 0, colorCode: "G" });
selection = addManualSelection(selection, { x: 2, y: 0, z: 1, colorCode: "M" });
assert.deepEqual([...selection].sort(), ["0,0,0", "2,0,1"]);
selection = removeManualSelection(selection, { x: 0, y: 0, z: 0, colorCode: "G" });
assert.deepEqual([...selection], ["2,0,1"]);
selection = clearSelection();
assert.equal(selection.size, 0);

p = project([
  [0, ["GM..", "....", "....", "...."]],
  [1, ["G...", "....", "....", "...."]]
]);
const beforePositions = keys(projectToVoxels(p));
const beforeSerialized = JSON.stringify(p);
const undoStack = [beforeSerialized];
const changes = recolorProjectVoxels(p, new Set(["0,0,0", "0,0,1"]), "M");
assert.equal(changes.length, 2);
assert.deepEqual(p.layers[0].matrix, ["MM..", "....", "....", "...."]);
assert.deepEqual(p.layers[1].matrix, ["M...", "....", "....", "...."]);
assert.deepEqual(keys(projectToVoxels(p)), beforePositions);
assert.equal(undoStack.length, 1);

const redoSnapshot = JSON.stringify(p);
p = JSON.parse(undoStack.pop());
assert.deepEqual(p.layers[0].matrix, ["GM..", "....", "....", "...."]);
p = JSON.parse(redoSnapshot);
assert.deepEqual(p.layers[1].matrix, ["M...", "....", "....", "...."]);

console.log("selection 3D tests OK");
