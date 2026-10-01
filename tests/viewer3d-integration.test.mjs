import assert from "node:assert/strict";
import {
  applyRecolorUiState,
  isTapGesture,
  resolveIntersectionVoxel,
  selectedVisibleVoxels
} from "../viewer3d.js";
import { recolorProjectVoxels, voxelKey } from "../selection3d.js";

function fakeElement(text = "") {
  const classes = new Set();
  return {
    hidden: true,
    textContent: text,
    attributes: {},
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    }
  };
}

const ui = {
  recolorToggle: fakeElement("Recolorar"),
  recolorPanel: fakeElement(),
  modeConnected: fakeElement(),
  modeAllColor: fakeElement(),
  actionReplace: fakeElement(),
  actionAdd: fakeElement(),
  actionRemove: fakeElement()
};

applyRecolorUiState(ui, { active: true, selectionMode: "connected", editAction: "replace" });
assert.equal(ui.recolorToggle.textContent, "Recolorando");
assert.equal(ui.recolorToggle.getAttribute("aria-pressed"), "true");
assert.equal(ui.recolorPanel.hidden, false);
assert.equal(ui.modeConnected.classList.contains("active"), true);
assert.equal(ui.modeAllColor.classList.contains("active"), false);
assert.equal(ui.actionReplace.classList.contains("active"), true);

applyRecolorUiState(ui, { active: false, selectionMode: "all-color", editAction: "add" });
assert.equal(ui.recolorToggle.textContent, "Recolorar");
assert.equal(ui.recolorPanel.hidden, true);
assert.equal(ui.modeAllColor.classList.contains("active"), true);
assert.equal(ui.actionAdd.classList.contains("active"), true);

assert.equal(isTapGesture({ x: 20, y: 20 }, { clientX: 24, clientY: 25 }, 8), true);
assert.equal(isTapGesture({ x: 20, y: 20 }, { clientX: 35, clientY: 20 }, 8), false);

const voxelA = { x: 2, y: 0, z: 3, colorCode: "G" };
const voxelB = { x: 4, y: 5, z: 6, colorCode: "A" };
const mesh = { userData: { voxels: [voxelA, voxelB] } };
assert.equal(resolveIntersectionVoxel([{ object: mesh, instanceId: 1 }]), voxelB);
assert.equal(resolveIntersectionVoxel([{ object: mesh, instanceId: 9 }]), null);
assert.equal(resolveIntersectionVoxel([{ object: {}, instanceId: 0 }]), null);

const visibleVoxels = [voxelA, voxelB];
let selectionKeys = new Set([voxelKey(voxelA)]);
assert.deepEqual(selectedVisibleVoxels(visibleVoxels, selectionKeys), [voxelA]);
selectionKeys = new Set([voxelKey(voxelA), "9,9,9"]);
assert.deepEqual(selectedVisibleVoxels(visibleVoxels, selectionKeys), [voxelA]);

const project = {
  layers: [
    { z: 3, matrix: ["..G.", "....", "...."] },
    { z: 6, matrix: ["....", "....", "....", "....", "....", "...."] }
  ]
};
const changes = recolorProjectVoxels(project, new Set([voxelKey(voxelA)]), "M");
assert.equal(changes.length, 1);
assert.equal(project.layers[0].matrix[0][2], "M");

console.log("viewer 3D integration tests OK");
