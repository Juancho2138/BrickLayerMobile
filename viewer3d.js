import * as THREE from "./vendor/three/three.module.js";
import { OrbitControls } from "./vendor/three/controls/OrbitControls.js";

let activeViewer = null;

export function openBrickViewer(options) {
  if (activeViewer) activeViewer.dispose();
  activeViewer = createViewer(options);
  activeViewer.open();
}

export function setBrickViewerView(view) {
  if (activeViewer) activeViewer.setCameraView(view);
}

export function closeBrickViewer() {
  if (!activeViewer) return;
  const viewer = activeViewer;
  activeViewer = null;
  viewer.close();
  viewer.dispose();
}

export function collectBlocks(project, layers) {
  const blocksByColor = {};
  Object.values(project.palette).forEach((color) => {
    blocksByColor[color] = [];
  });

  layers.forEach((layer) => {
    layer.matrix.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const code = row[x];
        if (code === ".") continue;
        const color = project.palette[code];
        if (!color) continue;
        if (!blocksByColor[color]) blocksByColor[color] = [];
        blocksByColor[color].push({ x, y, z: layer.z });
      }
    });
  });

  return blocksByColor;
}

function createViewer({ dialog, container, info, layerSelect, allLayers, project, currentZ }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  const controls = new OrbitControls(camera, renderer.domElement);
  const modelGroup = new THREE.Group();
  const axes = createAxes();
  const emptyMessage = document.createElement("div");

  let maxZ = currentZ;
  let frameId = 0;
  let disposed = false;
  let resizeObserver = null;
  let blockCount = 0;
  let radius = 8;

  scene.background = new THREE.Color(0x080b10);
  scene.add(modelGroup);
  scene.add(axes);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2030, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(14, 22, 18);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8fb6ff, 0.9);
  fillLight.position.set(-16, 10, -14);
  scene.add(fillLight);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x080b10, 1);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.minDistance = 2;
  controls.maxDistance = 2000;

  renderer.domElement.setAttribute("aria-label", "Vista 3D del modelo");
  emptyMessage.className = "viewer3d-empty";
  emptyMessage.textContent = "No hay bloques para visualizar";
  emptyMessage.hidden = true;

  function open() {
    if (!dialog.open) dialog.showModal();
    removeExistingCanvas();
    container.appendChild(renderer.domElement);
    container.appendChild(emptyMessage);
    fillLayerOptions();
    allLayers.checked = false;
    layerSelect.disabled = false;

    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    requestAnimationFrame(() => {
      if (disposed) return;
      resize();
      rebuild();
      setCameraView("iso");
      animate();
    });
  }

  function removeExistingCanvas() {
    container.querySelectorAll("canvas, .viewer3d-empty").forEach((node) => node.remove());
  }

  function fillLayerOptions() {
    layerSelect.innerHTML = "";
    project.layers.forEach((layer) => {
      const option = document.createElement("option");
      option.value = String(layer.z);
      option.textContent = `Z ${layer.z}`;
      option.selected = layer.z === currentZ;
      layerSelect.appendChild(option);
    });
  }

  function visibleLayers() {
    if (allLayers.checked) return project.layers;
    return project.layers.filter((layer) => layer.z <= maxZ);
  }

  function rebuild() {
    clearModelGroup();
    const blocksByColor = collectBlocks(project, visibleLayers());
    const dummy = new THREE.Object3D();
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZSeen = -Infinity;
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
        maxZSeen = Math.max(maxZSeen, block.z);
      });

      mesh.count = blocks.length;
      mesh.instanceMatrix.needsUpdate = true;
      modelGroup.add(mesh);
      total += blocks.length;
    });

    blockCount = total;
    emptyMessage.hidden = total > 0;

    if (!total) {
      radius = 6;
      modelGroup.position.set(0, 0, 0);
    } else {
      const center = new THREE.Vector3((minX + maxX) / 2, (minZ + maxZSeen) / 2, (minY + maxY) / 2);
      const size = new THREE.Vector3(
        Math.max(1, maxX - minX + 1),
        Math.max(1, maxZSeen - minZ + 1),
        Math.max(1, maxY - minY + 1)
      );
      modelGroup.position.set(-center.x, -center.y, -center.z);
      radius = Math.max(4, size.length() * 0.75);
    }

    axes.position.set(-project.size.x / 2, -0.5, -project.size.y / 2);
    controls.target.set(0, 0, 0);
    controls.update();
    updateInfo();
    render();
  }

  function clearModelGroup() {
    while (modelGroup.children.length) {
      const child = modelGroup.children.pop();
      child.geometry?.dispose();
      child.material?.dispose();
    }
    modelGroup.position.set(0, 0, 0);
  }

  function updateInfo() {
    const layers = visibleLayers();
    const zValues = layers.map((layer) => layer.z);
    const zMin = zValues.length ? Math.min(...zValues) : 0;
    const zMax = zValues.length ? Math.max(...zValues) : 0;
    const visibleZ = allLayers.checked ? "todas" : `${zMin}-${zMax}`;
    const maxProjectZ = project.layers.length ? Math.max(...project.layers.map((layer) => layer.z)) + 1 : 0;

    info.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = project.name;
    const layerLine = document.createElement("span");
    layerLine.textContent = `Capas: ${visibleZ}`;
    const blocksLine = document.createElement("span");
    blocksLine.textContent = `Bloques visibles: ${blockCount.toLocaleString("es-CO")}`;
    const dimensionsLine = document.createElement("span");
    dimensionsLine.textContent = `Dimensiones: ${project.size.x} x ${project.size.y} x ${maxProjectZ}`;
    info.append(title, layerLine, blocksLine, dimensionsLine);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || container.clientWidth || window.innerWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || container.clientHeight || window.innerHeight || 1));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }

  function setCameraView(view) {
    const distance = radius * 2.2;
    const positions = {
      front: [0, distance * 0.45, distance],
      back: [0, distance * 0.45, -distance],
      left: [-distance, distance * 0.45, 0],
      right: [distance, distance * 0.45, 0],
      top: [0, distance, 0.001],
      iso: [distance, distance * 0.9, distance]
    };
    const [x, y, z] = positions[view] || positions.iso;
    camera.position.set(x, y, z);
    camera.near = Math.max(0.1, radius / 100);
    camera.far = Math.max(200, radius * 12);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
    render();
  }

  function onLayerChange() {
    maxZ = Number(layerSelect.value);
    allLayers.checked = false;
    layerSelect.disabled = false;
    rebuild();
    setCameraView("iso");
  }

  function onAllLayersChange() {
    layerSelect.disabled = allLayers.checked;
    rebuild();
    setCameraView("iso");
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function render() {
    if (!disposed) renderer.render(scene, camera);
  }

  function animate() {
    if (disposed || !dialog.open) return;
    frameId = requestAnimationFrame(animate);
    controls.update();
    render();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frameId) cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    layerSelect.removeEventListener("change", onLayerChange);
    allLayers.removeEventListener("change", onAllLayersChange);
    controls.dispose();
    clearModelGroup();
    disposeObject(axes);
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
    emptyMessage.remove();
  }

  layerSelect.addEventListener("change", onLayerChange);
  allLayers.addEventListener("change", onAllLayersChange);

  return {
    open,
    close,
    dispose,
    rebuild,
    setCameraView
  };
}

function createAxes() {
  const group = new THREE.Group();
  const points = [
    [[0, 0, 0], [3, 0, 0], 0xff5252],
    [[0, 0, 0], [0, 0, 3], 0x42d66b],
    [[0, 0, 0], [0, 3, 0], 0x4d8dff]
  ];

  points.forEach(([start, end, color]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const material = new THREE.LineBasicMaterial({ color });
    group.add(new THREE.Line(geometry, material));
  });

  return group;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });
}
