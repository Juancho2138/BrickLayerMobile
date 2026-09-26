import assert from "node:assert/strict";
import { REFERENCE_TYPES, isReferenceVisibleAtZ } from "../reference-utils.js";
import { activeReferencesForLayer } from "../pdf/pdf-utils.js";

const temporal = {
  id: "R1",
  type: REFERENCE_TYPES.TEMPORAL_NEXT_LAYER,
  source_z: 8,
  start_z: 9,
  end_z: 9,
  x: 0,
  y: 0,
  label: ""
};

assert.equal(isReferenceVisibleAtZ(temporal, 8), false);
assert.equal(isReferenceVisibleAtZ(temporal, 9), true);
assert.equal(isReferenceVisibleAtZ(temporal, 10), false);

const backwardOpen = {
  id: "R2",
  type: REFERENCE_TYPES.BACKWARD,
  source_z: 8,
  start_z: 8,
  end_z: null,
  x: 0,
  y: 0,
  label: ""
};

for (const z of [8, 7, 6, 5, 4, 0]) {
  assert.equal(isReferenceVisibleAtZ(backwardOpen, z), true);
}
assert.equal(isReferenceVisibleAtZ(backwardOpen, 9), false);

const backwardFinished = { ...backwardOpen, end_z: 4 };
for (const z of [8, 7, 6, 5, 4]) {
  assert.equal(isReferenceVisibleAtZ(backwardFinished, z), true);
}
for (const z of [3, 2, 1, 0, 9]) {
  assert.equal(isReferenceVisibleAtZ(backwardFinished, z), false);
}

const normal = {
  id: "R3",
  type: REFERENCE_TYPES.NORMAL,
  source_z: 5,
  start_z: 5,
  end_z: 8,
  x: 0,
  y: 0,
  label: ""
};
const project = { references: [temporal, backwardFinished, normal] };
assert.deepEqual(activeReferencesForLayer(project, 3).map((reference) => reference.id), []);
assert.deepEqual(activeReferencesForLayer(project, 4).map((reference) => reference.id), ["R2"]);
assert.deepEqual(activeReferencesForLayer(project, 6).map((reference) => reference.id), ["R2", "R3"]);
assert.deepEqual(activeReferencesForLayer(project, 9).map((reference) => reference.id), ["R1"]);

console.log("reference utils tests OK");
