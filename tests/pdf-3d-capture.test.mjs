import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { calculateCameraFrame } from "../pdf/pdf-3d-capture.js";

function bounds(x, y, z) {
  const size = new THREE.Vector3(x, y, z);
  return {
    empty: false,
    center: new THREE.Vector3(),
    size,
    halfSize: size.clone().multiplyScalar(0.5),
    radius: Math.max(1, size.length() * 0.5)
  };
}

function visibleFill(frame, aspect, fov) {
  const verticalFov = THREE.MathUtils.degToRad(fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const availableHeight = Math.tan(verticalFov / 2) * (frame.distance - frame.projected.depth);
  const availableWidth = Math.tan(horizontalFov / 2) * (frame.distance - frame.projected.depth);
  return Math.max(frame.projected.vertical / availableHeight, frame.projected.horizontal / availableWidth);
}

const cases = [
  ["pequeno", bounds(2, 2, 2)],
  ["alto", bounds(4, 18, 4)],
  ["ancho", bounds(24, 4, 5)],
  ["profundo", bounds(5, 4, 24)]
];

for (const [name, modelBounds] of cases) {
  for (const view of ["front", "isometric"]) {
    const frame = calculateCameraFrame(modelBounds, view, 1100 / 760, 42, { padding: 0.24 });
    const fill = visibleFill(frame, 1100 / 760, 42);
    assert.ok(Number.isFinite(frame.distance), `${name} ${view}: distancia invalida`);
    assert.ok(frame.distance > frame.projected.depth, `${name} ${view}: camara dentro del modelo`);
    assert.ok(fill >= 0.68 && fill <= 0.82, `${name} ${view}: fill ${fill}`);
  }
}

console.log("pdf 3d capture tests OK");
