import * as THREE from "../vendor/three/three.module.js";
import { collectBlocks } from "../viewer3d.js";

export function render3DToImage(project, options = {}) {
  const width = options.width || 900;
  const height = options.height || 650;
  const view = options.view || "isometric";
  const padding = Number.isFinite(options.padding) ? options.padding : 0.24;
  const maxZ = Number.isInteger(options.maxZ) ? options.maxZ : Math.max(...project.layers.map((layer) => layer.z));
  const layers = project.layers.filter((layer) => layer.z <= maxZ);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0xf4f4f4, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f4f4);
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 5000);
  const group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.6);
  light.position.set(16, 28, 20);
  scene.add(light);

  const bounds = addBlocks(project, layers, group);
  fitCamera(camera, bounds, view, width / height, padding);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png", 0.82);
  disposeGroup(group);
  renderer.dispose();
  renderer.forceContextLoss?.();
  renderer.domElement.remove();
  return dataUrl;
}

function addBlocks(project, layers, group) {
  const blocksByColor = collectBlocks(project, layers);
  const dummy = new THREE.Object3D();
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let total = 0;

  Object.entries(blocksByColor).forEach(([color, blocks]) => {
    if (!blocks.length) return;
    const geometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02 });
    const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
    blocks.forEach((block, index) => {
      dummy.position.set(block.x, block.z, block.y);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      minX = Math.min(minX, block.x);
      minY = Math.min(minY, block.y);
      minZ = Math.min(minZ, block.z);
      maxX = Math.max(maxX, block.x);
      maxY = Math.max(maxY, block.y);
      maxZ = Math.max(maxZ, block.z);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    total += blocks.length;
  });

  if (!total) {
    return {
      empty: true,
      center: new THREE.Vector3(0, 0, 0),
      size: new THREE.Vector3(1, 1, 1),
      halfSize: new THREE.Vector3(0.5, 0.5, 0.5),
      radius: 1
    };
  }
  const center = new THREE.Vector3((minX + maxX) / 2, (minZ + maxZ) / 2, (minY + maxY) / 2);
  const size = new THREE.Vector3(Math.max(1, maxX - minX + 1), Math.max(1, maxZ - minZ + 1), Math.max(1, maxY - minY + 1));
  group.position.set(-center.x, -center.y, -center.z);
  return {
    empty: false,
    center,
    size,
    halfSize: size.clone().multiplyScalar(0.5),
    radius: Math.max(1, size.length() * 0.5)
  };
}

function fitCamera(camera, bounds, view, aspect, padding) {
  const frame = calculateCameraFrame(bounds, view, aspect, camera.fov, { padding });
  camera.position.copy(frame.position);
  camera.lookAt(0, 0, 0);
  camera.near = Math.max(0.05, frame.distance - bounds.radius * 3);
  camera.far = Math.max(200, frame.distance + bounds.radius * 3);
  camera.updateProjectionMatrix();
}

export function calculateCameraFrame(bounds, view = "isometric", aspect = 1, fov = 42, options = {}) {
  const padding = clamp(Number.isFinite(options.padding) ? options.padding : 0.24, 0.18, 0.32);
  const fillRatio = clamp(1 - padding, 0.68, 0.82);
  const direction = cameraDirectionForView(view).normalize();
  const target = new THREE.Vector3(0, 0, 0);
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
    target,
    position: direction.multiplyScalar(distance),
    distance,
    fillRatio,
    projected: extents
  };
}

function cameraDirectionForView(view) {
  const directions = {
    front: new THREE.Vector3(0, 0.28, 1),
    back: new THREE.Vector3(0, 0.28, -1),
    left: new THREE.Vector3(-1, 0.28, 0),
    right: new THREE.Vector3(1, 0.28, 0),
    top: new THREE.Vector3(0, 1, 0.001),
    isometric: new THREE.Vector3(1, 0.72, 1)
  };
  return (directions[view] || directions.isometric).clone();
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function disposeGroup(group) {
  group.traverse((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });
}
