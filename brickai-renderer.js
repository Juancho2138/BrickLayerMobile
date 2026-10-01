import * as THREE from "./vendor/three/three.module.js";
import { DEFAULT_PALETTE } from "./palette.js";
import { projectToVoxels } from "./selection3d.js";
import { BRICK_RENDER_SCALE } from "./viewer3d-model.js";
import { BRICKAI_BACKGROUND, BRICKAI_RENDER_SIZE } from "./brickai-package.js";
import { createBrickGeometries } from "./viewer3d.js";

const BRICKAI_FOV = 42;
const BRICKAI_PADDING = 0.18;

export async function renderBrickAiView(project, viewKey, options = {}) {
  const width = options.width || BRICKAI_RENDER_SIZE;
  const height = options.height || BRICKAI_RENDER_SIZE;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(BRICKAI_BACKGROUND, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BRICKAI_BACKGROUND);
  const camera = new THREE.PerspectiveCamera(BRICKAI_FOV, width / height, 0.1, 5000);
  const group = new THREE.Group();
  const geometries = createBrickGeometries();
  scene.add(group);
  addBrickAiLights(scene);

  const bounds = addProjectGeometry(project, group, geometries);
  fitCamera(camera, bounds, viewKey, width / height, BRICKAI_PADDING);
  renderer.render(scene, camera);
  const blob = await canvasToPngBlob(renderer.domElement);

  disposeObject(group);
  Object.values(geometries).forEach((geometry) => geometry.dispose());
  renderer.dispose();
  renderer.forceContextLoss?.();
  renderer.domElement.remove();
  return blob;
}

export function cameraDirectionForBrickAiView(viewKey) {
  const directions = {
    front: new THREE.Vector3(0, 0.42, 1),
    back: new THREE.Vector3(0, 0.42, -1),
    left: new THREE.Vector3(-1, 0.42, 0),
    right: new THREE.Vector3(1, 0.42, 0),
    top: new THREE.Vector3(0, 1, 0.001),
    bottom: new THREE.Vector3(0, -1, 0.001),
    isoFrontLeft: new THREE.Vector3(-1, 0.9, 1),
    isoFrontRight: new THREE.Vector3(1, 0.9, 1),
    isoBack: new THREE.Vector3(1, 0.9, -1)
  };
  return (directions[viewKey] || directions.isoFrontRight).clone();
}

export function calculateBrickAiCameraFrame(bounds, viewKey, aspect = 1, fov = BRICKAI_FOV, padding = BRICKAI_PADDING) {
  const fillRatio = clamp(1 - padding, 0.7, 0.88);
  const direction = cameraDirectionForBrickAiView(viewKey).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction);
  if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const extents = projectedBoxExtents(bounds.halfSize, direction, right, up);
  const verticalFov = THREE.MathUtils.degToRad(fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const distanceForHeight = extents.vertical / (Math.tan(verticalFov / 2) * fillRatio);
  const distanceForWidth = extents.horizontal / (Math.tan(horizontalFov / 2) * fillRatio);
  const distance = Math.max(2.5, extents.depth + distanceForHeight, extents.depth + distanceForWidth);

  return {
    direction,
    position: direction.clone().multiplyScalar(distance),
    distance,
    projected: extents,
    fillRatio
  };
}

function addProjectGeometry(project, group, geometries) {
  const voxels = projectToVoxels(project);
  const byColor = groupVoxelsByColor(voxels);
  const dummy = new THREE.Object3D();
  const bounds = createEmptyBounds();

  byColor.forEach((colorVoxels, colorCode) => {
    const color = DEFAULT_PALETTE[colorCode];
    if (!color || !colorVoxels.length) return;
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.015 });
    const socketMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(0.45),
      roughness: 0.7,
      metalness: 0
    });
    const meshes = [
      new THREE.InstancedMesh(geometries.body, material, colorVoxels.length),
      new THREE.InstancedMesh(geometries.stud, material, colorVoxels.length),
      new THREE.InstancedMesh(geometries.socket, socketMaterial, colorVoxels.length)
    ];
    colorVoxels.forEach((voxel, index) => {
      dummy.position.set(voxel.x, voxel.z * BRICK_RENDER_SCALE.stepZ, voxel.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshes.forEach((mesh) => mesh.setMatrixAt(index, dummy.matrix));
      expandBounds(bounds, voxel);
    });
    meshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    });
  });

  if (!voxels.length) {
    return {
      empty: true,
      halfSize: new THREE.Vector3(0.5, 0.5, 0.5),
      radius: 1
    };
  }

  const center = new THREE.Vector3(
    (bounds.minX + bounds.maxX) / 2,
    ((bounds.minZ + bounds.maxZ) / 2) * BRICK_RENDER_SCALE.stepZ,
    (bounds.minY + bounds.maxY) / 2
  );
  const size = new THREE.Vector3(
    Math.max(1, bounds.maxX - bounds.minX + 1),
    Math.max(1, (bounds.maxZ - bounds.minZ + 1) * BRICK_RENDER_SCALE.stepZ),
    Math.max(1, bounds.maxY - bounds.minY + 1)
  );
  group.position.set(-center.x, -center.y, -center.z);
  return {
    empty: false,
    halfSize: size.clone().multiplyScalar(0.5),
    radius: Math.max(1, size.length() * 0.5)
  };
}

function fitCamera(camera, bounds, viewKey, aspect, padding) {
  const frame = calculateBrickAiCameraFrame(bounds, viewKey, aspect, camera.fov, padding);
  camera.position.copy(frame.position);
  camera.lookAt(0, 0, 0);
  camera.near = Math.max(0.05, frame.distance - bounds.radius * 4);
  camera.far = Math.max(200, frame.distance + bounds.radius * 4);
  camera.updateProjectionMatrix();
}

function addBrickAiLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x283044, 1.7));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(15, 28, 20);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xa9c7ff, 1.05);
  fillLight.position.set(-20, 14, -18);
  scene.add(fillLight);
  const lowerLight = new THREE.DirectionalLight(0xffffff, 0.55);
  lowerLight.position.set(0, -18, 8);
  scene.add(lowerLight);
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size < 128) reject(new Error("La captura PNG esta vacia."));
      else resolve(blob);
    }, "image/png");
  });
}

function groupVoxelsByColor(voxels) {
  const byColor = new Map();
  voxels.forEach((voxel) => {
    if (!byColor.has(voxel.colorCode)) byColor.set(voxel.colorCode, []);
    byColor.get(voxel.colorCode).push(voxel);
  });
  return byColor;
}

function createEmptyBounds() {
  return {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity
  };
}

function expandBounds(bounds, voxel) {
  bounds.minX = Math.min(bounds.minX, voxel.x);
  bounds.minY = Math.min(bounds.minY, voxel.y);
  bounds.minZ = Math.min(bounds.minZ, voxel.z);
  bounds.maxX = Math.max(bounds.maxX, voxel.x);
  bounds.maxY = Math.max(bounds.maxY, voxel.y);
  bounds.maxZ = Math.max(bounds.maxZ, voxel.z);
}

function projectedBoxExtents(halfSize, direction, right, up) {
  const corners = [];
  for (const x of [-halfSize.x, halfSize.x]) {
    for (const y of [-halfSize.y, halfSize.y]) {
      for (const z of [-halfSize.z, halfSize.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  let horizontal = 0;
  let vertical = 0;
  let depth = 0;
  corners.forEach((corner) => {
    horizontal = Math.max(horizontal, Math.abs(corner.dot(right)));
    vertical = Math.max(vertical, Math.abs(corner.dot(up)));
    depth = Math.max(depth, Math.abs(corner.dot(direction)));
  });
  return { horizontal, vertical, depth };
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
