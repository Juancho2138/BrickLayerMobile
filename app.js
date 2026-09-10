import { BRICKLAYER_COLORS, COLOR_NAMES, DEFAULT_PALETTE } from "./palette.js";

const STORAGE_KEY = "bricklayer-mobile-project-v1";
const defaultPalette = DEFAULT_PALETTE;
const COLOR_SHORTCUTS = new Set(BRICKLAYER_COLORS.map((color) => color.code));
const DESKTOP_QUERY = "(min-width: 900px) and (pointer: fine)";

const state = {
  project: createProject(12, 12),
  currentLayer: 0,
  selectedColor: "A",
  tool: "paint",
  undoStack: [],
  redoStack: [],
  isDrawing: false,
  editorLocked: !window.matchMedia(DESKTOP_QUERY).matches,
  dragPaintEnabled: window.matchMedia(DESKTOP_QUERY).matches,
  dragStart: null,
  lastTouched: null,
  pendingPoint: null,
  editingReferenceId: null,
  referenceVisible: true,
  referenceDataUrl: ""
};

const els = {
  modelName: document.getElementById("modelName"),
  sizeX: document.getElementById("sizeX"),
  sizeY: document.getElementById("sizeY"),
  stats: document.getElementById("stats"),
  palette: document.getElementById("palette"),
  grid: document.getElementById("matrixGrid"),
  editorModeBtn: document.getElementById("editorModeBtn"),
  dragPaintToggle: document.getElementById("dragPaintToggle"),
  activeToolLabel: document.getElementById("activeToolLabel"),
  activeColorLabel: document.getElementById("activeColorLabel"),
  activeZoomLabel: document.getElementById("activeZoomLabel"),
  nextReferenceLabel: document.getElementById("nextReferenceLabel"),
  activeReferences: document.getElementById("activeReferences"),
  layerWorkLabel: document.getElementById("layerWorkLabel"),
  layerWorkMeta: document.getElementById("layerWorkMeta"),
  gridScroller: document.getElementById("gridScroller"),
  gridZoom: document.getElementById("gridZoom"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  fitZoomBtn: document.getElementById("fitZoomBtn"),
  layerLabel: document.getElementById("layerLabel"),
  status: document.getElementById("status"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  prevLayerBtn: document.getElementById("prevLayerBtn"),
  nextLayerBtn: document.getElementById("nextLayerBtn"),
  newLayerBtn: document.getElementById("newLayerBtn"),
  copyPrevLayerBtn: document.getElementById("copyPrevLayerBtn"),
  duplicateLayerBtn: document.getElementById("duplicateLayerBtn"),
  deleteLayerBtn: document.getElementById("deleteLayerBtn"),
  clearLayerBtn: document.getElementById("clearLayerBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  exportBtn: document.getElementById("exportBtn"),
  open3dBtn: document.getElementById("open3dBtn"),
  openOrganizerBtn: document.getElementById("openOrganizerBtn"),
  showOrganizationToggle: document.getElementById("showOrganizationToggle"),
  organizationOutdated: document.getElementById("organizationOutdated"),
  importInput: document.getElementById("importInput"),
  referenceInput: document.getElementById("referenceInput"),
  referenceTools: document.getElementById("referenceTools"),
  referenceView: document.getElementById("referenceView"),
  referenceImage: document.getElementById("referenceImage"),
  referenceZoom: document.getElementById("referenceZoom"),
  referenceOpacity: document.getElementById("referenceOpacity"),
  toggleReferenceBtn: document.getElementById("toggleReferenceBtn"),
  fullscreenReferenceBtn: document.getElementById("fullscreenReferenceBtn"),
  referenceDialog: document.getElementById("referenceDialog"),
  referenceDialogImage: document.getElementById("referenceDialogImage"),
  closeReferenceDialog: document.getElementById("closeReferenceDialog"),
  pointDialog: document.getElementById("pointDialog"),
  pointForm: document.getElementById("pointForm"),
  pointDialogTitle: document.getElementById("pointDialogTitle"),
  pointLabel: document.getElementById("pointLabel"),
  pointPersistent: document.getElementById("pointPersistent"),
  pointPersistentWrap: document.getElementById("pointPersistentWrap"),
  cancelPointBtn: document.getElementById("cancelPointBtn"),
  finishPointBtn: document.getElementById("finishPointBtn"),
  deletePointBtn: document.getElementById("deletePointBtn"),
  viewer3dDialog: document.getElementById("viewer3dDialog"),
  viewer3dCanvasWrap: document.getElementById("viewer3dCanvasWrap"),
  viewer3dInfo: document.getElementById("viewer3dInfo"),
  viewer3dLayerSelect: document.getElementById("viewer3dLayerSelect"),
  viewer3dAllLayers: document.getElementById("viewer3dAllLayers"),
  close3dBtn: document.getElementById("close3dBtn"),
  recenter3dBtn: document.getElementById("recenter3dBtn"),
  organizerDialog: document.getElementById("organizerDialog"),
  closeOrganizerBtn: document.getElementById("closeOrganizerBtn"),
  organizerMaxLength: document.getElementById("organizerMaxLength"),
  organizerPriority: document.getElementById("organizerPriority"),
  runOrganizerBtn: document.getElementById("runOrganizerBtn"),
  organizerSummary: document.getElementById("organizerSummary"),
  organizerInventory: document.getElementById("organizerInventory"),
  organizerLayerStats: document.getElementById("organizerLayerStats"),
  organizerWarnings: document.getElementById("organizerWarnings"),
  openPdfBtn: document.getElementById("openPdfBtn"),
  pdfDialog: document.getElementById("pdfDialog"),
  closePdfBtn: document.getElementById("closePdfBtn"),
  pdfProfile: document.getElementById("pdfProfile"),
  pdfAllLayers: document.getElementById("pdfAllLayers"),
  pdfFromZ: document.getElementById("pdfFromZ"),
  pdfToZ: document.getElementById("pdfToZ"),
  pdfShowLayerNumber: document.getElementById("pdfShowLayerNumber"),
  pdfShowMatrix: document.getElementById("pdfShowMatrix"),
  pdfShowColors: document.getElementById("pdfShowColors"),
  pdfShowPieces: document.getElementById("pdfShowPieces"),
  pdfShowReferences: document.getElementById("pdfShowReferences"),
  pdfShowLayerPieces: document.getElementById("pdfShowLayerPieces"),
  pdfShowInventory: document.getElementById("pdfShowInventory"),
  pdfShow3d: document.getElementById("pdfShow3d"),
  pdfShowStats: document.getElementById("pdfShowStats"),
  pdfShowPieceIds: document.getElementById("pdfShowPieceIds"),
  pdf3dFrequency: document.getElementById("pdf3dFrequency"),
  pdfOrientation: document.getElementById("pdfOrientation"),
  pdfOutdatedWarning: document.getElementById("pdfOutdatedWarning"),
  pdfReorganizeFirstBtn: document.getElementById("pdfReorganizeFirstBtn"),
  pdfWithoutOrganizationBtn: document.getElementById("pdfWithoutOrganizationBtn"),
  pdfSummary: document.getElementById("pdfSummary"),
  pdfProgress: document.getElementById("pdfProgress"),
  pdfProgressText: document.getElementById("pdfProgressText"),
  generatePdfBtn: document.getElementById("generatePdfBtn"),
  downloadPdfBtn: document.getElementById("downloadPdfBtn"),
  sharePdfBtn: document.getElementById("sharePdfBtn")
};

function createProject(x, y) {
  return {
    format: "bricklayers-v1",
    name: "Nuevo modelo",
    size: { x, y },
    palette: { ...defaultPalette },
    revision: 0,
    references: [],
    construction_layout: null,
    layers: [{ z: 0, matrix: createEmptyMatrix(x, y) }]
  };
}

function createEmptyMatrix(x, y) {
  return Array.from({ length: y }, () => ".".repeat(x));
}

function cloneMatrix(matrix) {
  return matrix.slice();
}

function currentLayer() {
  return state.project.layers[state.currentLayer];
}

function matrixToRows(matrix) {
  return matrix.map((row) => Array.isArray(row) ? row.join("") : String(row));
}

function normalizeProject(project) {
  const x = Number(project.size?.x) || 12;
  const y = Number(project.size?.y) || 12;
  const palette = project.palette && typeof project.palette === "object" ? project.palette : defaultPalette;
  const layers = Array.isArray(project.layers) && project.layers.length ? project.layers : [{ z: 0, matrix: [] }];
  const normalizedLayers = layers
    .map((layer, index) => ({
      z: Number.isInteger(layer.z) ? layer.z : index,
      matrix: normalizeMatrix(matrixToRows(layer.matrix || []), x, y)
    }))
    .sort((a, b) => a.z - b.z);

  return {
    format: "bricklayers-v1",
    name: project.name || "Nuevo modelo",
    size: { x, y },
    palette: { ...defaultPalette, ...palette },
    revision: Number.isInteger(project.revision) ? project.revision : 0,
    references: normalizeReferences(project, normalizedLayers, x, y),
    construction_layout: normalizeConstructionLayout(project.construction_layout, Number.isInteger(project.revision) ? project.revision : 0),
    layers: normalizedLayers
  };
}

function normalizeConstructionLayout(layout, revision) {
  if (!layout || typeof layout !== "object" || !Array.isArray(layout.pieces)) return null;
  const generatedFromRevision = Number.isInteger(layout.generated_from_revision) ? layout.generated_from_revision : 0;
  return {
    version: Number(layout.version) || 1,
    max_piece_length: Number(layout.max_piece_length) || 3,
    priority: layout.priority || "balanced",
    generated_from_revision: generatedFromRevision,
    outdated: Boolean(layout.outdated) || generatedFromRevision !== revision,
    pieces: layout.pieces,
    inventory: layout.inventory || {},
    layer_stats: Array.isArray(layout.layer_stats) ? layout.layer_stats : [],
    stability: layout.stability || { score: 0, warnings: [] },
    totals: layout.totals || { cells: 0, physical_pieces: layout.pieces.length }
  };
}

function normalizeReferences(project, layers, x, y) {
  const normalized = [];
  const sourceReferences = Array.isArray(project.references) ? project.references : [];
  sourceReferences.forEach((reference) => addNormalizedReference(normalized, reference, x, y));

  if (Array.isArray(project.layers)) {
    project.layers.forEach((layer, layerIndex) => {
      if (!Array.isArray(layer.references)) return;
      const z = Number.isInteger(layer.z) ? layer.z : layerIndex;
      layer.references.forEach((reference) => {
        addNormalizedReference(normalized, {
          ...reference,
          start_z: Number.isInteger(reference.start_z) ? reference.start_z : z,
          end_z: reference.persistent === false ? z + 1 : reference.end_z
        }, x, y);
      });
    });
  }

  return normalized.sort(compareReferenceIds);
}

function addNormalizedReference(list, reference, x, y) {
  const id = typeof reference.id === "string" && reference.id.trim() ? reference.id.trim() : nextReferenceId(list);
  const startZ = Number.isInteger(reference.start_z) ? reference.start_z : 0;
  const endZ = Number.isInteger(reference.end_z) ? reference.end_z : null;
  const normalized = {
    id,
    x: Number.isInteger(reference.x) ? reference.x : 0,
    y: Number.isInteger(reference.y) ? reference.y : 0,
    start_z: startZ,
    end_z: endZ !== null && endZ >= startZ ? endZ : null,
    label: typeof reference.label === "string" ? reference.label : ""
  };
  list.push(normalized);
}

function normalizeMatrix(rows, x, y) {
  const allowed = new Set([".", ...Object.keys(defaultPalette)]);
  return Array.from({ length: y }, (_, rowIndex) => {
    const source = rows[rowIndex] || "";
    let row = "";
    for (let col = 0; col < x; col += 1) {
      const char = source[col] || ".";
      row += allowed.has(char) ? char : ".";
    }
    return row;
  });
}

function setCell(matrix, x, y, value) {
  const row = matrix[y];
  matrix[y] = row.slice(0, x) + value + row.slice(x + 1);
}

function getCell(matrix, x, y) {
  return matrix[y][x];
}

function pushHistory() {
  state.undoStack.push(JSON.stringify(state.project));
  if (state.undoStack.length > 60) state.undoStack.shift();
  state.redoStack = [];
}

function restoreProject(serialized) {
  state.project = normalizeProject(JSON.parse(serialized));
  state.currentLayer = Math.min(state.currentLayer, state.project.layers.length - 1);
  renderPalette();
  render();
  saveProject();
}

function nextReferenceId(source = state.project.references) {
  const ids = source.map((reference) => reference.id);
  let next = 1;
  while (ids.includes(`R${next}`)) next += 1;
  return `R${next}`;
}

function compareReferenceIds(a, b) {
  const aNum = Number(String(a.id).replace(/^R/i, ""));
  const bNum = Number(String(b.id).replace(/^R/i, ""));
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  return String(a.id).localeCompare(String(b.id));
}

function markChanged(message) {
  saveProject();
  renderLayerLabel();
  renderStats();
  updateButtons();
  if (message) setStatus(message);
}

function markGeometryChanged(message) {
  const shouldRefreshGrid = Boolean(state.project.construction_layout && !state.project.construction_layout.outdated && els.showOrganizationToggle.checked);
  state.project.revision = (state.project.revision || 0) + 1;
  if (state.project.construction_layout) state.project.construction_layout.outdated = true;
  if (shouldRefreshGrid) renderGrid();
  markChanged(message);
}

function saveProject() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
}

function loadProject() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    state.project = normalizeProject(JSON.parse(saved));
    state.currentLayer = 0;
  } catch {
    setStatus("No se pudo recuperar el proyecto guardado.");
  }
}

function render() {
  els.modelName.value = state.project.name;
  els.sizeX.value = state.project.size.x;
  els.sizeY.value = state.project.size.y;
  renderLayerLabel();
  renderEditorState();
  renderGrid();
  renderActiveReferences();
  renderStats();
  updateButtons();
}

function renderLayerLabel() {
  els.layerLabel.textContent = `Capa ${state.currentLayer + 1}/${state.project.layers.length}`;
  els.layerWorkLabel.textContent = `Capa Z: ${currentLayer().z}`;
  els.layerWorkMeta.textContent = `${state.currentLayer + 1} de ${state.project.layers.length}  Bloques: ${countLayerBlocks(currentLayer())}`;
}

function renderEditorState() {
  const colorName = COLOR_NAMES[state.selectedColor] || "";
  const toolName = toolLabel(state.tool);
  const modeText = state.editorLocked ? "NAVEGAR" : "EDITAR";
  els.editorModeBtn.textContent = state.editorLocked ? "NAVEGAR" : "EDITAR";
  els.editorModeBtn.classList.toggle("locked", state.editorLocked);
  els.editorModeBtn.setAttribute("aria-pressed", String(!state.editorLocked));
  els.gridScroller.classList.toggle("editor-locked", state.editorLocked);
  els.gridScroller.classList.toggle("drag-disabled", !state.dragPaintEnabled);
  els.activeToolLabel.textContent = `${modeText} | ${toolName}`;
  els.activeColorLabel.textContent = `${state.selectedColor} ${colorName}`;
  els.activeZoomLabel.textContent = `${els.gridZoom.value}px`;
  els.nextReferenceLabel.textContent = state.tool === "reference" ? `Siguiente: ${nextReferenceId()}` : "";
  els.dragPaintToggle.checked = state.dragPaintEnabled;
}

function toolLabel(tool) {
  const labels = {
    paint: "Pintar",
    erase: "Borrar",
    fill: "Rellenar",
    select: "Seleccionar",
    template: "Plantilla",
    reference: "Referencia"
  };
  return labels[tool] || tool;
}

function renderStats() {
  const occupied = state.project.layers.reduce((sum, layer) => {
    return sum + layer.matrix.join("").split("").filter((cell) => cell !== ".").length;
  }, 0);
  const zSize = state.project.layers.length;
  els.stats.innerHTML = `
    <span>Total de capas: ${zSize}</span>
    <span>Total de celdas ocupadas: ${occupied}</span>
    <span>Dimensiones: ${state.project.size.x} x ${state.project.size.y} x ${zSize}</span>
  `;
  els.organizationOutdated.hidden = !state.project.construction_layout?.outdated;
}

function countLayerBlocks(layer) {
  return layer.matrix.join("").split("").filter((cell) => cell !== ".").length;
}

function renderPalette() {
  els.palette.innerHTML = "";
  BRICKLAYER_COLORS.forEach(({ code }) => {
    const color = state.project.palette[code] || defaultPalette[code];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-button${code === state.selectedColor ? " active" : ""}`;
    button.dataset.color = code;
    button.title = `${code} ${COLOR_NAMES[code] || ""}`;
    button.innerHTML = `<span class="swatch" style="background:${color}"></span><span>${code} ${COLOR_NAMES[code] || ""}</span><kbd>${code}</kbd>`;
    button.addEventListener("click", () => selectColor(code));
    els.palette.appendChild(button);
  });
}

function renderGrid() {
  const { x, y } = state.project.size;
  const activeReferences = activeReferencesForCurrentLayer();
  const organizationMap = organizationPieceMapForCurrentLayer();
  els.grid.style.setProperty("--x", x);
  els.grid.style.setProperty("--y", y);
  els.grid.style.setProperty("--cell", `${els.gridZoom.value}px`);
  els.grid.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "axis corner";
  els.grid.appendChild(corner);

  for (let col = 0; col < x; col += 1) {
    const axis = document.createElement("div");
    axis.className = "axis";
    axis.textContent = col + 1;
    els.grid.appendChild(axis);
  }

  const matrix = currentLayer().matrix;
  for (let row = 0; row < y; row += 1) {
    const axis = document.createElement("div");
    axis.className = "axis";
    axis.textContent = row + 1;
    els.grid.appendChild(axis);

    for (let col = 0; col < x; col += 1) {
      const code = getCell(matrix, col, row);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `cell${code !== "." ? " occupied" : ""}${organizationEdgeClasses(organizationMap, col, row)}`;
      cell.dataset.x = col;
      cell.dataset.y = row;
      cell.ariaLabel = `X ${col + 1}, Y ${row + 1}`;
      cell.style.background = code === "." ? "" : state.project.palette[code];
      const referencesHere = activeReferences.filter((reference) => reference.x === col && reference.y === row);
      if (referencesHere.length) {
        cell.ariaLabel += `, Referencias ${referencesHere.map((reference) => reference.id).join(", ")}, Capa ${currentLayer().z}`;
      }
      referencesHere.forEach((reference) => {
        const marker = document.createElement("span");
        marker.className = "reference-marker";
        const label = document.createElement("span");
        label.textContent = reference.id;
        marker.appendChild(label);
        cell.appendChild(marker);
      });
      els.grid.appendChild(cell);
    }
  }
}

function organizationPieceMapForCurrentLayer() {
  if (!els.showOrganizationToggle.checked || state.project.construction_layout?.outdated) return null;
  const layout = state.project.construction_layout;
  if (!layout?.pieces?.length) return null;
  const z = currentLayer().z;
  const map = new Map();
  layout.pieces
    .filter((piece) => piece.z === z)
    .forEach((piece) => {
      piece.cells.forEach(([x, y]) => map.set(`${x},${y}`, piece.id));
    });
  return map;
}

function organizationEdgeClasses(map, col, row) {
  if (!map) return "";
  const id = map.get(`${col},${row}`);
  if (!id) return "";
  const classes = [];
  if (map.get(`${col},${row - 1}`) !== id) classes.push("organization-edge-top");
  if (map.get(`${col + 1},${row}`) !== id) classes.push("organization-edge-right");
  if (map.get(`${col},${row + 1}`) !== id) classes.push("organization-edge-bottom");
  if (map.get(`${col - 1},${row}`) !== id) classes.push("organization-edge-left");
  return ` ${classes.join(" ")}`;
}

function activeReferencesForCurrentLayer() {
  const z = currentLayer().z;
  return state.project.references
    .filter((reference) => reference.start_z <= z && (reference.end_z === null || z <= reference.end_z))
    .sort(compareReferenceIds);
}

function renderActiveReferences() {
  const references = state.project.references.slice().sort(compareReferenceIds);
  els.activeReferences.innerHTML = "";
  if (!references.length) {
    const empty = document.createElement("div");
    empty.className = "reference-list-empty";
    empty.textContent = "Sin referencias activas";
    els.activeReferences.appendChild(empty);
    return;
  }

  references.forEach((reference) => {
    const item = document.createElement("div");
    item.className = "reference-item";

    const name = document.createElement("div");
    name.className = "reference-name";
    const title = document.createElement("span");
    title.textContent = `${reference.id} ${reference.label || ""}`.trim();
    const position = document.createElement("small");
    position.textContent = `X ${reference.x + 1}, Y ${reference.y + 1}, Capa ${reference.start_z}`;
    name.append(title, position);

    const locate = document.createElement("button");
    locate.type = "button";
    locate.textContent = "Localizar";
    locate.addEventListener("click", () => locateReference(reference));

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => openEditReferenceDialog(reference.id));

    const finish = document.createElement("button");
    finish.type = "button";
    finish.textContent = "Finalizar";
    finish.addEventListener("click", () => finishReference(reference.id));

    item.append(name, locate, edit, finish);
    els.activeReferences.appendChild(item);
  });
}

function updateButtons() {
  document.querySelectorAll(".tool").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === state.tool);
  });
  els.prevLayerBtn.disabled = state.currentLayer === 0;
  els.nextLayerBtn.disabled = state.currentLayer >= state.project.layers.length - 1;
  els.copyPrevLayerBtn.disabled = !state.project.layers.some((layer) => layer.z === currentLayer().z - 1);
  els.deleteLayerBtn.disabled = state.project.layers.length === 1;
  els.undoBtn.disabled = state.undoStack.length === 0;
  els.redoBtn.disabled = state.redoStack.length === 0;
  renderEditorState();
}

function paintAt(col, row) {
  if (state.editorLocked) return;
  if (state.tool === "reference") {
    const existing = findActiveReferenceAt(col, row);
    if (existing) {
      openEditReferenceDialog(existing.id);
      return;
    }
    createReferenceAt(col, row);
    return;
  }
  if (state.tool === "select") {
    const reference = findActiveReferenceAt(col, row);
    if (reference) openEditReferenceDialog(reference.id);
    return;
  }
  if (state.tool === "template") {
    setStatus("Plantilla activa.");
    return;
  }
  const matrix = currentLayer().matrix;
  const value = state.tool === "erase" ? "." : state.selectedColor;
  if (state.tool === "fill") {
    fillFrom(col, row);
    return;
  }
  if (getCell(matrix, col, row) === value) return;
  setCell(matrix, col, row, value);
  updateCellElement(col, row, value);
  markGeometryChanged();
}

function updateCellElement(col, row, value) {
  const cell = els.grid.querySelector(`.cell[data-x="${col}"][data-y="${row}"]`);
  if (!cell) return;
  cell.classList.toggle("occupied", value !== ".");
  cell.style.background = value === "." ? "" : state.project.palette[value];
}

function fillFrom(col, row) {
  const matrix = currentLayer().matrix;
  const target = getCell(matrix, col, row);
  const replacement = state.selectedColor;
  if (target === replacement) return;

  pushHistory();
  const { x, y } = state.project.size;
  const queue = [[col, row]];
  const seen = new Set();
  while (queue.length) {
    const [cx, cy] = queue.shift();
    const key = `${cx},${cy}`;
    if (seen.has(key) || cx < 0 || cy < 0 || cx >= x || cy >= y) continue;
    seen.add(key);
    if (getCell(matrix, cx, cy) !== target) continue;
    setCell(matrix, cx, cy, replacement);
    queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  renderGrid();
  markGeometryChanged("Relleno aplicado.");
}

function beginDraw(event) {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  if (state.editorLocked || event.pointerType === "touch" && event.isPrimary === false) return;
  event.preventDefault();
  state.isDrawing = true;
  state.lastTouched = null;
  state.dragStart = { x: event.clientX, y: event.clientY, moved: false };
  if (state.tool !== "fill" && state.tool !== "reference" && state.tool !== "select" && state.tool !== "template") pushHistory();
  touchCell(cell);
}

function moveDraw(event) {
  if (!state.isDrawing || state.tool === "fill" || state.tool === "reference" || state.tool === "select") return;
  if (!state.dragPaintEnabled) return;
  const point = event.touches ? event.touches[0] : event;
  if (state.dragStart && !state.dragStart.moved) {
    const dx = Math.abs(point.clientX - state.dragStart.x);
    const dy = Math.abs(point.clientY - state.dragStart.y);
    if (dx < 10 && dy < 10) return;
    state.dragStart.moved = true;
  }
  event.preventDefault();
  const target = document.elementFromPoint(point.clientX, point.clientY);
  const cell = target?.closest(".cell");
  if (cell && els.grid.contains(cell)) touchCell(cell);
}

function endDraw() {
  state.isDrawing = false;
  state.lastTouched = null;
  state.dragStart = null;
}

function touchCell(cell) {
  const col = Number(cell.dataset.x);
  const row = Number(cell.dataset.y);
  const key = `${col},${row}`;
  if (state.lastTouched === key) return;
  state.lastTouched = key;
  paintAt(col, row);
}

function findActiveReferenceAt(col, row) {
  return activeReferencesForCurrentLayer().find((reference) => reference.x === col && reference.y === row);
}

function openCreateReferenceDialog(col, row) {
  state.pendingPoint = { x: col, y: row };
  state.editingReferenceId = null;
  els.pointDialogTitle.textContent = `Nuevo punto en X ${col + 1}, Y ${row + 1}`;
  els.pointLabel.value = "";
  els.pointPersistent.checked = true;
  els.pointPersistentWrap.hidden = false;
  els.finishPointBtn.hidden = true;
  els.deletePointBtn.hidden = true;
  els.pointDialog.showModal();
}

function createReferenceAt(col, row) {
  const z = currentLayer().z;
  const id = nextReferenceId();
  pushHistory();
  state.project.references.push({
    id,
    x: col,
    y: row,
    start_z: z,
    end_z: null,
    label: ""
  });
  state.project.references.sort(compareReferenceIds);
  render();
  markChanged(`${id} creada en X ${col + 1}, Y ${row + 1}, Capa ${z}.`);
}

function openEditReferenceDialog(id) {
  const reference = state.project.references.find((item) => item.id === id);
  if (!reference) return;
  state.pendingPoint = null;
  state.editingReferenceId = id;
  els.pointDialogTitle.textContent = `${reference.id} | X ${reference.x + 1} | Y ${reference.y + 1} | Capa ${reference.start_z}`;
  els.pointLabel.value = reference.label || "";
  els.pointPersistentWrap.hidden = true;
  els.finishPointBtn.hidden = false;
  els.deletePointBtn.hidden = false;
  els.pointDialog.showModal();
}

function savePointDialog() {
  const label = els.pointLabel.value.trim();
  if (state.editingReferenceId) {
    const reference = state.project.references.find((item) => item.id === state.editingReferenceId);
    if (!reference) return;
    pushHistory();
    reference.label = label;
    closePointDialog();
    render();
    markChanged("Referencia editada.");
    return;
  }

  if (!state.pendingPoint) return;
  pushHistory();
  const z = currentLayer().z;
  state.project.references.push({
    id: nextReferenceId(),
    x: state.pendingPoint.x,
    y: state.pendingPoint.y,
    start_z: z,
    end_z: els.pointPersistent.checked ? null : z + 1,
    label
  });
  state.project.references.sort(compareReferenceIds);
  closePointDialog();
  render();
  markChanged("Punto de referencia creado.");
}

function closePointDialog() {
  state.pendingPoint = null;
  state.editingReferenceId = null;
  els.pointDialog.close();
}

function finishReference(id) {
  const reference = state.project.references.find((item) => item.id === id);
  if (!reference) return;
  const z = currentLayer().z;
  pushHistory();
  reference.end_z = Math.max(reference.start_z, z);
  render();
  markChanged(`${reference.id} finalizada en Z ${reference.end_z}.`);
}

function deleteReference(id) {
  const index = state.project.references.findIndex((item) => item.id === id);
  if (index === -1) return;
  if (!confirm("Eliminar esta referencia completamente?")) return;
  pushHistory();
  const [removed] = state.project.references.splice(index, 1);
  closePointDialog();
  render();
  markChanged(`${removed.id} eliminada.`);
}

function locateReference(reference) {
  const targetLayer = state.project.layers.findIndex((layer) => layer.z === reference.start_z);
  if (targetLayer !== -1 && targetLayer !== state.currentLayer) {
    state.currentLayer = targetLayer;
    render();
  }
  const cell = els.grid.querySelector(`.cell[data-x="${reference.x}"][data-y="${reference.y}"]`);
  if (!cell) return;
  cell.scrollIntoView({ block: "center", inline: "center" });
  cell.classList.add("active");
  window.setTimeout(() => cell.classList.remove("active"), 700);
}

let viewer3dApiPromise = null;
let viewer3dInstance = null;
let organizerApiPromise = null;
let pdfEnginePromise = null;
let currentPdfDownload = null;

function open3dViewer() {
  console.log("[BrickLayer] Vista 3D solicitada");
  if (location.protocol === "file:") {
    setStatus("Para utilizar Vista 3D abre BrickLayer desde el servidor local.");
    return;
  }
  if (!els.open3dBtn || !els.viewer3dDialog || !els.viewer3dCanvasWrap) {
    console.error("[BrickLayer] Elementos del visor 3D no encontrados.");
    setStatus("No se pudo abrir la Vista 3D.");
    return;
  }
  if (!els.viewer3dDialog.open) {
    els.viewer3dInfo.textContent = "Cargando visor 3D...";
    try {
      els.viewer3dDialog.showModal();
    } catch (error) {
      console.error("[BrickLayer] No se pudo abrir el modal 3D:", error);
      setStatus("No se pudo abrir la Vista 3D.");
      return;
    }
  }
  setStatus("Preparando Vista 3D...");
  const options = {
    dialog: els.viewer3dDialog,
    container: els.viewer3dCanvasWrap,
    info: els.viewer3dInfo,
    layerSelect: els.viewer3dLayerSelect,
    allLayers: els.viewer3dAllLayers,
    project: JSON.parse(JSON.stringify(normalizeProject(state.project))),
    currentZ: currentLayer().z
  };
  if (!viewer3dApiPromise) {
    viewer3dApiPromise = import("./viewer3d.js");
  }
  viewer3dApiPromise
    .then((module) => {
      module.openBrickViewer(options);
      viewer3dInstance = module;
      setStatus("Vista 3D abierta.");
    })
    .catch((error) => {
      console.error("[BrickLayer] Error al abrir Vista 3D:", error);
      viewer3dApiPromise = null;
      els.viewer3dInfo.textContent = "No se pudo cargar el visor 3D.";
      setStatus("No se pudo abrir la Vista 3D.");
    });
}

function openOrganizer() {
  els.organizerDialog.showModal();
  renderOrganizerPanel();
}

function runOrganizer() {
  const maxPieceLength = Number(els.organizerMaxLength.value);
  const priority = els.organizerPriority.value;
  if (!organizerApiPromise) organizerApiPromise = import("./organizer.js");
  els.organizerSummary.textContent = "Organizando bloques...";
  return organizerApiPromise
    .then((module) => {
      const source = JSON.parse(JSON.stringify(normalizeProject(state.project)));
      const layout = module.generateConstructionLayout(source, { maxPieceLength, priority });
      const errors = module.validateConstructionLayout(source, layout);
      if (errors.length) {
        els.organizerSummary.textContent = `Error de organización: ${errors[0]}`;
        return false;
      }
      state.project.construction_layout = layout;
      saveProject();
      renderGrid();
      renderStats();
      renderOrganizerPanel();
      updatePdfSummary();
      setStatus("Organización actualizada.");
    })
    .catch((error) => {
      console.error("[BrickLayer] Error al organizar bloques:", error);
      els.organizerSummary.textContent = "No se pudo organizar el modelo.";
    });
}

function renderOrganizerPanel() {
  const layout = state.project.construction_layout;
  if (!layout) {
    els.organizerSummary.innerHTML = "<strong>Sin organización generada</strong><span>Configura el tamaño y pulsa Reorganizar.</span>";
    els.organizerInventory.innerHTML = "";
    els.organizerLayerStats.innerHTML = "";
    els.organizerWarnings.innerHTML = "";
    return;
  }

  els.organizerMaxLength.value = String(layout.max_piece_length || 3);
  els.organizerPriority.value = layout.priority || "balanced";
  els.organizerSummary.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = layout.outdated ? "Organización pendiente de actualizar" : "Organización vigente";
  const cells = document.createElement("span");
  cells.textContent = `Celdas totales: ${layout.totals.cells.toLocaleString("es-CO")}`;
  const pieces = document.createElement("span");
  pieces.textContent = `Piezas físicas: ${layout.totals.physical_pieces.toLocaleString("es-CO")}`;
  const stability = document.createElement("span");
  stability.textContent = `Estabilidad estimada: ${layout.stability.score}/100`;
  els.organizerSummary.append(title, cells, pieces, stability);
  renderInventory(layout);
  renderLayerStats(layout);
  renderWarnings(layout);
}

function renderInventory(layout) {
  els.organizerInventory.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "Inventario";
  els.organizerInventory.appendChild(title);
  Object.entries(layout.inventory).forEach(([color, counts]) => {
    const row = document.createElement("div");
    row.className = "organizer-row";
    row.innerHTML = `<span>${color}</span><span>1x1 ${counts["1x1"] || 0}  1x2 ${counts["1x2"] || 0}  1x3 ${counts["1x3"] || 0}</span>`;
    els.organizerInventory.appendChild(row);
  });
}

function renderLayerStats(layout) {
  els.organizerLayerStats.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "Capas";
  els.organizerLayerStats.appendChild(title);
  layout.layer_stats.forEach((stat) => {
    const row = document.createElement("div");
    row.className = "organizer-row";
    row.innerHTML = `<span>Z ${stat.z} · ${stat.cells} celdas</span><span>${stat.physical_pieces} piezas · E ${stat.stability}</span>`;
    els.organizerLayerStats.appendChild(row);
  });
}

function renderWarnings(layout) {
  els.organizerWarnings.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "Estabilidad";
  els.organizerWarnings.appendChild(title);
  const warnings = layout.stability.warnings.length ? layout.stability.warnings : ["Sin advertencias"];
  warnings.slice(0, 20).forEach((warning) => {
    const row = document.createElement("div");
    row.className = "organizer-row";
    row.textContent = warning;
    els.organizerWarnings.appendChild(row);
  });
}

function openPdfDialog() {
  resetPdfDownload();
  applyPdfProfileDefaults();
  updatePdfSummary();
  els.pdfDialog.showModal();
}

function resetPdfDownload() {
  if (currentPdfDownload?.url) URL.revokeObjectURL(currentPdfDownload.url);
  currentPdfDownload = null;
  els.downloadPdfBtn.disabled = true;
  els.sharePdfBtn.disabled = true;
}

function minProjectZ() {
  return state.project.layers.length ? Math.min(...state.project.layers.map((layer) => layer.z)) : 0;
}

function maxProjectZ() {
  return state.project.layers.length ? Math.max(...state.project.layers.map((layer) => layer.z)) : 0;
}

function applyPdfProfileDefaults() {
  const professional = els.pdfProfile.value === "professional";
  const minZ = minProjectZ();
  const maxZ = maxProjectZ();
  els.pdfFromZ.value = String(minZ);
  els.pdfToZ.value = String(maxZ);
  els.pdfAllLayers.checked = true;
  els.pdfShowLayerNumber.checked = true;
  els.pdfShowMatrix.checked = true;
  els.pdfShowColors.checked = true;
  els.pdfShowPieces.checked = true;
  els.pdfShowReferences.checked = true;
  els.pdfShowLayerPieces.checked = true;
  els.pdfShowInventory.checked = professional;
  els.pdfShow3d.checked = professional;
  els.pdfShowStats.checked = true;
  els.pdfShowPieceIds.checked = false;
  els.pdf3dFrequency.value = professional ? "every5" : "cover";
  els.pdfOrientation.value = "auto";
  updatePdfRangeState();
}

function updatePdfRangeState() {
  const disabled = els.pdfAllLayers.checked;
  els.pdfFromZ.disabled = disabled;
  els.pdfToZ.disabled = disabled;
  updatePdfSummary();
}

function collectPdfSettings() {
  const minZ = minProjectZ();
  const maxZ = maxProjectZ();
  const fromZ = els.pdfAllLayers.checked ? minZ : clamp(Number(els.pdfFromZ.value), minZ, maxZ);
  const toZ = els.pdfAllLayers.checked ? maxZ : clamp(Number(els.pdfToZ.value), minZ, maxZ);
  return {
    profile: els.pdfProfile.value === "professional" ? "professional" : "quick",
    layerMode: els.pdfAllLayers.checked ? "all" : "range",
    fromZ: Math.min(fromZ, toZ),
    toZ: Math.max(fromZ, toZ),
    pageOrientation: els.pdfOrientation.value,
    useOrganization: true,
    includeLayerNumber: els.pdfShowLayerNumber.checked,
    includeMatrix: els.pdfShowMatrix.checked,
    includeColors: els.pdfShowColors.checked,
    includePieceDivisions: els.pdfShowPieces.checked,
    includeReferences: els.pdfShowReferences.checked,
    includeLayerPieceCount: els.pdfShowLayerPieces.checked,
    includeInventory: els.pdfShowInventory.checked,
    include3dViews: els.pdfShow3d.checked,
    includeStats: els.pdfShowStats.checked,
    includePieceIds: els.pdfShowPieceIds.checked,
    cumulative3d: els.pdf3dFrequency.value
  };
}

function updatePdfSummary() {
  if (!els.pdfSummary) return;
  const settings = collectPdfSettings();
  const selectedLayers = state.project.layers.filter((layer) => {
    return settings.layerMode === "all" || (layer.z >= settings.fromZ && layer.z <= settings.toZ);
  });
  const cells = selectedLayers.reduce((sum, layer) => sum + countLayerBlocks(layer), 0);
  const layout = state.project.construction_layout;
  const hasValidLayout = Boolean(layout && !layout.outdated && layout.generated_from_revision === (state.project.revision || 0));
  els.pdfOutdatedWarning.hidden = hasValidLayout;
  els.pdfSummary.textContent = `${selectedLayers.length} capas, ${cells.toLocaleString("es-CO")} celdas, ${settings.profile === "professional" ? "manual profesional" : "manual rapido"}.`;
}

async function generatePdfFromDialog() {
  resetPdfDownload();
  const settings = collectPdfSettings();
  const project = JSON.parse(JSON.stringify(normalizeProject(state.project)));
  els.generatePdfBtn.disabled = true;
  els.pdfProgress.value = 1;
  els.pdfProgressText.textContent = "Preparando PDF...";
  try {
    if (!pdfEnginePromise) pdfEnginePromise = import("./pdf/pdf-engine.js");
    const { generateManualPdf } = await pdfEnginePromise;
    const result = await generateManualPdf(project, settings, {
      onProgress({ percent, message }) {
        els.pdfProgress.value = percent;
        els.pdfProgressText.textContent = message;
      }
    });
    currentPdfDownload = {
      blob: result.blob,
      fileName: result.fileName,
      url: URL.createObjectURL(result.blob)
    };
    els.downloadPdfBtn.disabled = false;
    els.sharePdfBtn.disabled = !canShareCurrentPdf();
    els.pdfSummary.textContent = `${result.fileName} listo. ${result.pages} paginas.`;
    setStatus("PDF generado.");
  } catch (error) {
    console.error("[BrickLayer] Error al generar PDF:", error);
    els.pdfProgressText.textContent = "Error al generar PDF";
    els.pdfSummary.textContent = error?.message || "No se pudo generar el PDF.";
    setStatus("No se pudo generar el PDF.");
  } finally {
    els.generatePdfBtn.disabled = false;
  }
}

function downloadCurrentPdf() {
  if (!currentPdfDownload) return;
  const link = document.createElement("a");
  link.href = currentPdfDownload.url;
  link.download = currentPdfDownload.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus("Descarga PDF iniciada.");
}

function canShareCurrentPdf() {
  if (!currentPdfDownload || !navigator.share || !navigator.canShare || typeof File === "undefined") return false;
  const file = new File([currentPdfDownload.blob], currentPdfDownload.fileName, { type: "application/pdf" });
  return navigator.canShare({ files: [file] });
}

async function shareCurrentPdf() {
  if (!canShareCurrentPdf()) return;
  const file = new File([currentPdfDownload.blob], currentPdfDownload.fileName, { type: "application/pdf" });
  try {
    await navigator.share({ files: [file], title: currentPdfDownload.fileName });
  } catch (error) {
    if (error?.name !== "AbortError") setStatus("No se pudo compartir el PDF.");
  }
}

function resizeProject() {
  const x = clamp(Number(els.sizeX.value) || 12, 1, 64);
  const y = clamp(Number(els.sizeY.value) || 12, 1, 64);
  if (x === state.project.size.x && y === state.project.size.y) return;
  pushHistory();
  state.project.size = { x, y };
  state.project.layers = state.project.layers.map((layer) => ({
    ...layer,
    matrix: normalizeMatrix(layer.matrix, x, y)
  }));
  render();
  markGeometryChanged("Tamaño actualizado.");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function selectColor(code) {
  if (!COLOR_SHORTCUTS.has(code)) return;
  state.selectedColor = code;
  state.tool = "paint";
  renderPalette();
  updateButtons();
  setStatus(`PINTAR | ${code} ${COLOR_NAMES[code] || ""}`);
}

function setTool(tool) {
  state.tool = tool;
  updateButtons();
  if (tool === "reference") setStatus(`REFERENCIA | Siguiente: ${nextReferenceId()}`);
  else setStatus(toolLabel(tool).toUpperCase());
}

function previousLayer() {
  if (state.currentLayer <= 0) return;
  state.currentLayer -= 1;
  render();
}

function nextLayer() {
  if (state.currentLayer >= state.project.layers.length - 1) return;
  state.currentLayer += 1;
  render();
}

function firstLayer() {
  if (state.currentLayer === 0) return;
  state.currentLayer = 0;
  render();
}

function lastLayer() {
  const last = state.project.layers.length - 1;
  if (state.currentLayer === last) return;
  state.currentLayer = last;
  render();
}

function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(JSON.stringify(state.project));
  restoreProject(state.undoStack.pop());
  setStatus("Deshacer aplicado.");
}

function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(JSON.stringify(state.project));
  restoreProject(state.redoStack.pop());
  setStatus("Rehacer aplicado.");
}

function toggleEditorLock() {
  state.editorLocked = !state.editorLocked;
  renderEditorState();
  setStatus(state.editorLocked ? "NAVEGAR" : "EDITAR");
}

function setZoom(value) {
  els.gridZoom.value = String(clamp(Number(value), Number(els.gridZoom.min), Number(els.gridZoom.max)));
  renderGrid();
  renderEditorState();
}

function zoomIn() {
  setZoom(Number(els.gridZoom.value) + 4);
}

function zoomOut() {
  setZoom(Number(els.gridZoom.value) - 4);
}

function fitZoom() {
  const available = Math.max(160, els.gridScroller.clientWidth - 34);
  const cell = Math.floor(available / Math.max(1, state.project.size.x));
  setZoom(cell);
}

function shouldIgnoreShortcut(event) {
  const target = event.target;
  if (!target) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const dialog = target.closest?.("dialog");
  return Boolean(dialog?.open && dialog.querySelector("input:focus, textarea:focus, select:focus, [contenteditable='true']:focus"));
}

function handleKeyboard(event) {
  if (shouldIgnoreShortcut(event)) return;
  const key = event.key.toLowerCase();
  const upper = key.toUpperCase();

  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (COLOR_SHORTCUTS.has(upper)) {
    event.preventDefault();
    selectColor(upper);
    return;
  }
  if (key === "k") {
    event.preventDefault();
    addLayer();
  } else if (key === "d") {
    event.preventDefault();
    duplicateCurrentLayer();
  } else if (key === "z") {
    event.preventDefault();
    undo();
  } else if (key === "y") {
    event.preventDefault();
    redo();
  } else if (key === "e") {
    event.preventDefault();
    setTool("erase");
  } else if (key === "f") {
    event.preventDefault();
    setTool("reference");
  } else if (key === "t") {
    event.preventDefault();
    setTool("template");
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (event.shiftKey) firstLayer();
    else previousLayer();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    if (event.shiftKey) lastLayer();
    else nextLayer();
  } else if (event.key === " ") {
    event.preventDefault();
    toggleEditorLock();
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomIn();
  } else if (event.key === "-") {
    event.preventDefault();
    zoomOut();
  } else if (event.key === "0") {
    event.preventDefault();
    fitZoom();
  }
}

function addLayer() {
  const targetZ = currentLayer().z + 1;
  const existingIndex = state.project.layers.findIndex((layer) => layer.z === targetZ);
  if (existingIndex !== -1) {
    state.currentLayer = existingIndex;
    render();
    setStatus(`Ya existe Z ${targetZ}; se abrió esa capa.`);
    return;
  }
  pushHistory();
  state.project.layers.push({ z: targetZ, matrix: createEmptyMatrix(state.project.size.x, state.project.size.y) });
  state.project.layers.sort((a, b) => a.z - b.z);
  state.currentLayer = state.project.layers.findIndex((layer) => layer.z === targetZ);
  render();
  markGeometryChanged("Nueva capa creada.");
}

function copyPreviousLayer() {
  const previousLayer = state.project.layers.find((layer) => layer.z === currentLayer().z - 1);
  if (!previousLayer) return;
  if (countLayerBlocks(currentLayer()) && !confirm("La capa actual contiene bloques. Sobrescribir con la capa anterior?")) return;
  pushHistory();
  currentLayer().matrix = cloneMatrix(previousLayer.matrix);
  renderGrid();
  markGeometryChanged("Capa anterior copiada.");
}

function duplicateCurrentLayer() {
  const targetZ = currentLayer().z + 1;
  const existingIndex = state.project.layers.findIndex((layer) => layer.z === targetZ);
  if (existingIndex !== -1) {
    state.currentLayer = existingIndex;
    render();
    setStatus(`No se duplicó: ya existe Z ${targetZ}.`);
    return;
  }
  pushHistory();
  state.project.layers.push({ z: targetZ, matrix: cloneMatrix(currentLayer().matrix) });
  state.project.layers.sort((a, b) => a.z - b.z);
  state.currentLayer = state.project.layers.findIndex((layer) => layer.z === targetZ);
  render();
  markGeometryChanged("Capa duplicada.");
}

function deleteLayer() {
  if (state.project.layers.length === 1) return;
  if (!confirm("Eliminar la capa actual?")) return;
  pushHistory();
  const deletedZ = currentLayer().z;
  state.project.layers.splice(state.currentLayer, 1);
  state.project.references = state.project.references.filter((reference) => reference.start_z !== deletedZ);
  state.currentLayer = Math.max(0, state.currentLayer - 1);
  render();
  markGeometryChanged("Capa eliminada.");
}

function clearLayer() {
  if (!confirm("Limpiar la capa actual?")) return;
  pushHistory();
  currentLayer().matrix = createEmptyMatrix(state.project.size.x, state.project.size.y);
  renderGrid();
  markGeometryChanged("Capa limpia.");
}

function validateProject(project) {
  const errors = [];
  const allowed = new Set([".", ...Object.keys(project.palette)]);
  const seenZ = new Set();
  const validZ = new Set(project.layers.map((layer) => layer.z));
  project.layers.forEach((layer, index) => {
    if (seenZ.has(layer.z)) errors.push(`Z duplicado: ${layer.z}`);
    seenZ.add(layer.z);
    if (index > 0 && project.layers[index - 1].z > layer.z) errors.push("Las capas no estan ordenadas por Z.");
    if (layer.matrix.length !== project.size.y) errors.push(`La capa ${layer.z} no tiene ${project.size.y} filas.`);
    layer.matrix.forEach((row, rowIndex) => {
      if (row.length !== project.size.x) errors.push(`Fila ${rowIndex + 1} de capa ${layer.z} no mide ${project.size.x}.`);
      for (const char of row) {
        if (!allowed.has(char)) errors.push(`Codigo invalido "${char}" en capa ${layer.z}.`);
      }
    });
  });
  const seenReferenceIds = new Set();
  project.references.forEach((reference) => {
    if (seenReferenceIds.has(reference.id)) errors.push(`Referencia duplicada: ${reference.id}`);
    seenReferenceIds.add(reference.id);
    if (reference.x < 0 || reference.x >= project.size.x) errors.push(`${reference.id} tiene X fuera de rango.`);
    if (reference.y < 0 || reference.y >= project.size.y) errors.push(`${reference.id} tiene Y fuera de rango.`);
    if (!validZ.has(reference.start_z)) errors.push(`${reference.id} tiene start_z invalido.`);
    if (reference.end_z !== null && reference.end_z < reference.start_z) {
      errors.push(`${reference.id} tiene end_z menor que start_z.`);
    }
  });
  return errors;
}

function exportProject() {
  const exportable = normalizeProject(state.project);
  const errors = validateProject(exportable);
  if (errors.length) {
    setStatus(`No se puede exportar: ${errors[0]}`);
    return;
  }
  const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const safeName = exportable.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "modelo";
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}_${Date.now().toString().slice(-4)}.bricklayers`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setStatus("Archivo .bricklayers generado.");
}

function importProject(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (imported.format !== "bricklayers-v1") {
        setStatus("Error: el archivo no usa format bricklayers-v1.");
        return;
      }
      const normalized = normalizeProject(imported);
      const errors = validateProject(normalized);
      if (errors.length) {
        setStatus(`Error: ${errors[0]}`);
        return;
      }
      pushHistory();
      state.project = normalized;
      state.currentLayer = 0;
      renderPalette();
      render();
      markChanged("Proyecto importado.");
    } catch {
      setStatus("Error: no se pudo abrir el archivo.");
    }
  };
  reader.readAsText(file);
}

function setStatus(message) {
  els.status.textContent = message;
}

function bindEvents() {
  els.modelName.addEventListener("input", () => {
    state.project.name = els.modelName.value.trim() || "Nuevo modelo";
    markChanged();
  });
  els.sizeX.addEventListener("change", resizeProject);
  els.sizeY.addEventListener("change", resizeProject);
  els.gridZoom.addEventListener("input", () => {
    renderGrid();
    renderEditorState();
  });
  els.zoomInBtn.addEventListener("click", zoomIn);
  els.zoomOutBtn.addEventListener("click", zoomOut);
  els.fitZoomBtn.addEventListener("click", fitZoom);
  els.editorModeBtn.addEventListener("click", toggleEditorLock);
  els.dragPaintToggle.addEventListener("change", () => {
    state.dragPaintEnabled = els.dragPaintToggle.checked;
    renderEditorState();
  });

  els.grid.addEventListener("pointerdown", beginDraw);
  els.grid.addEventListener("pointermove", moveDraw);
  window.addEventListener("pointerup", endDraw);
  els.grid.addEventListener("touchmove", moveDraw, { passive: false });

  document.querySelectorAll(".tool").forEach((button) => {
    button.addEventListener("click", () => {
      setTool(button.dataset.tool);
    });
  });

  els.prevLayerBtn.addEventListener("click", previousLayer);
  els.nextLayerBtn.addEventListener("click", nextLayer);
  els.newLayerBtn.addEventListener("click", addLayer);
  els.copyPrevLayerBtn.addEventListener("click", copyPreviousLayer);
  els.duplicateLayerBtn.addEventListener("click", duplicateCurrentLayer);
  els.deleteLayerBtn.addEventListener("click", deleteLayer);
  els.clearLayerBtn.addEventListener("click", clearLayer);

  els.undoBtn.addEventListener("click", undo);
  els.redoBtn.addEventListener("click", redo);

  els.newProjectBtn.addEventListener("click", () => {
    if (!confirm("Crear un nuevo proyecto y borrar el actual?")) return;
    state.project = createProject(12, 12);
    state.currentLayer = 0;
    state.undoStack = [];
    state.redoStack = [];
    renderPalette();
    render();
    markChanged("Nuevo proyecto creado.");
  });
  els.open3dBtn.addEventListener("click", open3dViewer);
  els.openOrganizerBtn.addEventListener("click", openOrganizer);
  els.closeOrganizerBtn.addEventListener("click", () => els.organizerDialog.close());
  els.runOrganizerBtn.addEventListener("click", runOrganizer);
  els.openPdfBtn.addEventListener("click", openPdfDialog);
  els.closePdfBtn.addEventListener("click", () => els.pdfDialog.close());
  els.pdfProfile.addEventListener("change", () => {
    resetPdfDownload();
    applyPdfProfileDefaults();
    updatePdfSummary();
  });
  els.pdfAllLayers.addEventListener("change", updatePdfRangeState);
  [
    els.pdfFromZ,
    els.pdfToZ,
    els.pdfShowLayerNumber,
    els.pdfShowMatrix,
    els.pdfShowColors,
    els.pdfShowPieces,
    els.pdfShowReferences,
    els.pdfShowLayerPieces,
    els.pdfShowInventory,
    els.pdfShow3d,
    els.pdfShowStats,
    els.pdfShowPieceIds,
    els.pdf3dFrequency,
    els.pdfOrientation
  ].forEach((control) => control.addEventListener("change", () => {
    resetPdfDownload();
    updatePdfSummary();
  }));
  els.pdfReorganizeFirstBtn.addEventListener("click", async () => {
    await runOrganizer();
    updatePdfSummary();
  });
  els.pdfWithoutOrganizationBtn.addEventListener("click", generatePdfFromDialog);
  els.generatePdfBtn.addEventListener("click", generatePdfFromDialog);
  els.downloadPdfBtn.addEventListener("click", downloadCurrentPdf);
  els.sharePdfBtn.addEventListener("click", shareCurrentPdf);
  els.showOrganizationToggle.addEventListener("change", renderGrid);
  els.close3dBtn.addEventListener("click", () => {
    if (viewer3dInstance?.closeBrickViewer) viewer3dInstance.closeBrickViewer();
    else els.viewer3dDialog.close();
  });
  els.viewer3dDialog.addEventListener("close", () => {
    if (viewer3dInstance?.closeBrickViewer) viewer3dInstance.closeBrickViewer();
  });
  els.recenter3dBtn.addEventListener("click", () => {
    if (viewer3dInstance?.setBrickViewerView) viewer3dInstance.setBrickViewerView("iso");
  });
  document.querySelectorAll("[data-view3d]").forEach((button) => {
    button.addEventListener("click", () => {
      if (viewer3dInstance?.setBrickViewerView) viewer3dInstance.setBrickViewerView(button.dataset.view3d);
    });
  });
  els.exportBtn.addEventListener("click", exportProject);
  els.importInput.addEventListener("change", () => {
    const file = els.importInput.files?.[0];
    if (file) importProject(file);
    els.importInput.value = "";
  });

  els.referenceInput.addEventListener("change", () => {
    const file = els.referenceInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.referenceDataUrl = String(reader.result);
      state.referenceVisible = true;
      renderReference();
    };
    reader.readAsDataURL(file);
    els.referenceInput.value = "";
  });
  els.toggleReferenceBtn.addEventListener("click", () => {
    state.referenceVisible = !state.referenceVisible;
    renderReference();
  });
  els.referenceZoom.addEventListener("input", renderReference);
  els.referenceOpacity.addEventListener("input", renderReference);
  els.fullscreenReferenceBtn.addEventListener("click", () => {
    if (!state.referenceDataUrl) return;
    els.referenceDialogImage.src = state.referenceDataUrl;
    els.referenceDialog.showModal();
  });
  els.closeReferenceDialog.addEventListener("click", () => els.referenceDialog.close());

  els.pointForm.addEventListener("submit", (event) => {
    event.preventDefault();
    savePointDialog();
  });
  els.cancelPointBtn.addEventListener("click", closePointDialog);
  els.finishPointBtn.addEventListener("click", () => {
    if (state.editingReferenceId) finishReference(state.editingReferenceId);
    closePointDialog();
  });
  els.deletePointBtn.addEventListener("click", () => {
    if (state.editingReferenceId) deleteReference(state.editingReferenceId);
  });
  window.addEventListener("keydown", handleKeyboard);
}

function renderReference() {
  const hasImage = Boolean(state.referenceDataUrl);
  els.referenceTools.hidden = !hasImage;
  els.referenceView.hidden = !hasImage || !state.referenceVisible;
  els.toggleReferenceBtn.textContent = state.referenceVisible ? "Ocultar" : "Mostrar";
  if (hasImage) {
    els.referenceImage.src = state.referenceDataUrl;
    els.referenceImage.style.opacity = String(Number(els.referenceOpacity.value) / 100);
    els.referenceView.style.setProperty("--reference-width", `${els.referenceZoom.value}%`);
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {
      setStatus("No se pudo registrar el modo offline.");
    });
  }
}

loadProject();
bindEvents();
renderPalette();
render();
renderReference();
registerServiceWorker();
