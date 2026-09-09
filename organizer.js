export function generateConstructionLayout(project, options = {}) {
  const maxPieceLength = clamp(Number(options.maxPieceLength) || 3, 1, 3);
  const priority = normalizePriority(options.priority || "balanced");
  const pieces = [];
  const layerStats = [];
  const warnings = [];
  let nextId = 1;
  let previousMap = new Map();
  let previousJoints = new Set();

  project.layers
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((layer) => {
      const layerPieces = buildLayerPieces(layer, project.palette, maxPieceLength, priority, previousMap, previousJoints, nextId);
      nextId += layerPieces.length;
      pieces.push(...layerPieces);
      const stability = scoreLayerStability(layer, layerPieces, previousMap, previousJoints, warnings);
      layerStats.push(buildLayerStats(layer.z, layer, layerPieces, stability));
      previousMap = mapCellsToPiece(layerPieces);
      previousJoints = collectJoints(layerPieces);
    });

  const inventory = getInventoryByColorAndSize(pieces);
  const totalCells = pieces.reduce((sum, piece) => sum + piece.cells.length, 0);
  const averageStability = layerStats.length
    ? Math.round(layerStats.reduce((sum, stat) => sum + stat.stability, 0) / layerStats.length)
    : 100;

  return {
    version: 1,
    max_piece_length: maxPieceLength,
    priority,
    generated_from_revision: project.revision || 0,
    outdated: false,
    pieces,
    inventory,
    layer_stats: layerStats,
    stability: {
      score: averageStability,
      warnings
    },
    totals: {
      cells: totalCells,
      physical_pieces: pieces.length
    }
  };
}

export function getConstructionPieces(project) {
  return project.construction_layout?.pieces || [];
}

export function getPiecesForLayer(project, z) {
  return getConstructionPieces(project).filter((piece) => piece.z === z);
}

export function getInventoryByColorAndSize(piecesOrProject) {
  const pieces = Array.isArray(piecesOrProject) ? piecesOrProject : getConstructionPieces(piecesOrProject);
  const inventory = {};
  pieces.forEach((piece) => {
    if (!inventory[piece.color]) inventory[piece.color] = { "1x1": 0, "1x2": 0, "1x3": 0 };
    inventory[piece.color][`1x${piece.length}`] += 1;
  });
  return inventory;
}

export function getLayerConstructionStats(project, z) {
  const layout = project.construction_layout;
  if (!layout) return null;
  const pieces = getPiecesForLayer(project, z);
  const stored = layout.layer_stats?.find((stat) => stat.z === z) || {};
  return {
    ...buildLayerStatsFromPieces(z, pieces, Number.isFinite(stored.stability) ? stored.stability : 0),
    colors: Array.isArray(stored.colors) ? stored.colors : buildLayerStatsFromPieces(z, pieces, 0).colors
  };
}

export function getStabilityReport(project) {
  return project.construction_layout?.stability || { score: 0, warnings: ["Organizacion no generada"] };
}

export function validateConstructionLayout(project, layout) {
  const errors = [];
  const occupied = new Map();
  project.layers.forEach((layer) => {
    layer.matrix.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const color = row[x];
        if (color !== ".") occupied.set(cellKey(x, y, layer.z), color);
      }
    });
  });

  const covered = new Map();
  const inventory = {};
  layout.pieces.forEach((piece) => {
    if (!["X", "Y", "NONE"].includes(piece.orientation)) errors.push(`${piece.id}: orientacion invalida`);
    if (piece.length < 1 || piece.length > layout.max_piece_length) errors.push(`${piece.id}: longitud invalida`);
    if (piece.length === 1 && piece.orientation !== "NONE") errors.push(`${piece.id}: 1x1 debe usar NONE`);
    if (piece.length > 1 && !["X", "Y"].includes(piece.orientation)) errors.push(`${piece.id}: pieza larga sin orientacion`);

    piece.cells.forEach(([x, y, z]) => {
      const key = cellKey(x, y, z);
      const sourceColor = occupied.get(key);
      if (!sourceColor) errors.push(`${piece.id}: ocupa celda vacia ${key}`);
      if (sourceColor && sourceColor !== piece.color) errors.push(`${piece.id}: mezcla color ${sourceColor}/${piece.color}`);
      if (covered.has(key)) errors.push(`${piece.id}: celda duplicada ${key}`);
      covered.set(key, piece.id);
    });

    if (!inventory[piece.color]) inventory[piece.color] = { "1x1": 0, "1x2": 0, "1x3": 0 };
    inventory[piece.color][`1x${piece.length}`] += 1;
  });

  occupied.forEach((_, key) => {
    if (!covered.has(key)) errors.push(`celda ocupada sin pieza ${key}`);
  });

  if (JSON.stringify(inventory) !== JSON.stringify(layout.inventory)) {
    errors.push("inventario no coincide con pieces[]");
  }

  const totalCells = layout.pieces.reduce((sum, piece) => sum + piece.cells.length, 0);
  if (layout.totals?.cells !== totalCells) errors.push("total de celdas no coincide con pieces[]");
  if (layout.totals?.physical_pieces !== layout.pieces.length) errors.push("total de piezas fisicas no coincide con pieces[]");

  const zValues = new Set(project.layers.map((layer) => layer.z));
  zValues.forEach((z) => {
    const expected = buildLayerStatsFromPieces(z, layout.pieces.filter((piece) => piece.z === z), 0);
    const stored = layout.layer_stats?.find((stat) => stat.z === z);
    if (!stored) return;
    if (stored.physical_pieces !== expected.physical_pieces) errors.push(`Z${z}: piezas fisicas no coinciden`);
    if (stored.cells !== expected.cells) errors.push(`Z${z}: celdas no coinciden`);
    if (stored["1x1"] !== expected["1x1"] || stored["1x2"] !== expected["1x2"] || stored["1x3"] !== expected["1x3"]) {
      errors.push(`Z${z}: conteo por tamano no coincide`);
    }
  });

  return errors;
}

function buildLayerPieces(layer, palette, maxPieceLength, priority, lowerMap, lowerJoints, startId) {
  const occupied = matrixOccupied(layer.matrix, palette, layer.z);
  const used = new Set();
  const pieces = [];
  let nextId = startId;

  for (let y = 0; y < layer.matrix.length; y += 1) {
    const row = layer.matrix[y];
    for (let x = 0; x < row.length; x += 1) {
      const color = row[x];
      if (color === "." || !palette[color] || used.has(cellKey(x, y, layer.z))) continue;
      const candidate = chooseBestCandidate({ x, y, z: layer.z, color, occupied, used, maxPieceLength, priority, lowerMap, lowerJoints });
      const piece = createPiece(`B${nextId}`, layer.z, color, candidate);
      nextId += 1;
      piece.cells.forEach(([cx, cy, cz]) => used.add(cellKey(cx, cy, cz)));
      pieces.push(piece);
    }
  }

  return pieces;
}

function chooseBestCandidate(context) {
  const candidates = [];
  ["X", "Y"].forEach((orientation) => {
    for (let length = context.maxPieceLength; length >= 1; length -= 1) {
      const cells = candidateCells(context.x, context.y, context.z, length, orientation);
      if (candidateFits(cells, context)) candidates.push({ length, orientation: length === 1 ? "NONE" : orientation, cells });
    }
  });

  return candidates
    .sort((a, b) => scoreCandidate(b, context) - scoreCandidate(a, context))
    [0] || { length: 1, orientation: "NONE", cells: [[context.x, context.y, context.z]] };
}

function scoreCandidate(candidate, context) {
  const lowerIds = new Set();
  let supported = 0;
  candidate.cells.forEach(([x, y, z]) => {
    const lower = context.lowerMap.get(cellKey(x, y, z - 1));
    if (lower) {
      supported += 1;
      lowerIds.add(lower.id);
    }
  });

  const supportRatio = candidate.cells.length ? supported / candidate.cells.length : 1;
  const bridgeBonus = lowerIds.size > 1 ? lowerIds.size * 8 : 0;
  const repeatedJointPenalty = countRepeatedJoints(candidate, context.lowerJoints) * 10;
  const lengthScore = candidate.length * 4;
  const stabilityScore = supportRatio * 20 + bridgeBonus - repeatedJointPenalty;

  if (context.priority === "least_pieces") return lengthScore * 4 + stabilityScore;
  if (context.priority === "stability") return stabilityScore * 4 + lengthScore;
  return stabilityScore * 2 + lengthScore * 2;
}

function candidateCells(x, y, z, length, orientation) {
  return Array.from({ length }, (_, offset) => {
    return orientation === "X" ? [x + offset, y, z] : [x, y + offset, z];
  });
}

function candidateFits(cells, { color, occupied, used }) {
  return cells.every(([x, y, z]) => occupied.get(cellKey(x, y, z)) === color && !used.has(cellKey(x, y, z)));
}

function createPiece(id, z, color, candidate) {
  const [x, y] = candidate.cells[0];
  return {
    id,
    z,
    x,
    y,
    color,
    length: candidate.length,
    orientation: candidate.orientation,
    cells: candidate.cells
  };
}

function countRepeatedJoints(candidate, lowerJoints) {
  if (candidate.length < 2) return 0;
  const joints = pieceJoints(candidate);
  let repeated = 0;
  joints.forEach((joint) => {
    if (lowerJoints.has(joint)) repeated += 1;
  });
  return repeated;
}

function pieceJoints(piece) {
  const joints = new Set();
  if (piece.length < 2 || piece.orientation === "NONE") return joints;
  const sorted = piece.cells.slice().sort((a, b) => piece.orientation === "X" ? a[0] - b[0] : a[1] - b[1]);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const [x1, y1, z] = sorted[i];
    const [x2, y2] = sorted[i + 1];
    if (piece.orientation === "X") joints.add(`X:${x1 + 0.5}:${y1}`);
    else joints.add(`Y:${x1}:${y1 + 0.5}`);
    if (x2 < x1 || y2 < y1) joints.add("invalid");
  }
  return joints;
}

function scoreLayerStability(layer, pieces, lowerMap, lowerJoints, warnings) {
  if (layer.z === 0) return 100;
  const cells = pieces.flatMap((piece) => piece.cells);
  if (!cells.length) return 100;

  let supported = 0;
  const bridgedPieces = pieces.filter((piece) => {
    const lowerIds = new Set();
    piece.cells.forEach(([x, y, z]) => {
      const lower = lowerMap.get(cellKey(x, y, z - 1));
      if (lower) {
        supported += 1;
        lowerIds.add(lower.id);
      }
    });
    return lowerIds.size > 1;
  }).length;

  const repeatedJoints = pieces.reduce((sum, piece) => sum + countRepeatedJoints(piece, lowerJoints), 0);
  const unsupported = cells.length - supported;
  if (unsupported) warnings.push(`Voladizo detectado en Z${layer.z}: ${unsupported} celdas sin apoyo`);
  if (repeatedJoints) warnings.push(`Junta repetida cerca de Z${layer.z}: ${repeatedJoints}`);
  if (!unsupported && repeatedJoints === 0) warnings.push(`Capa Z${layer.z} bien trabada`);

  return clamp(Math.round(70 + (supported / cells.length) * 25 + bridgedPieces * 3 - repeatedJoints * 4 - unsupported * 5), 0, 100);
}

function buildLayerStats(z, layer, pieces, stability) {
  return buildLayerStatsFromPieces(z, pieces, stability);
}

function buildLayerStatsFromPieces(z, pieces, stability) {
  const byLength = { "1x1": 0, "1x2": 0, "1x3": 0 };
  const colors = new Set();
  pieces.forEach((piece) => {
    byLength[`1x${piece.length}`] += 1;
    colors.add(piece.color);
  });

  return {
    z,
    cells: pieces.reduce((sum, piece) => sum + piece.cells.length, 0),
    physical_pieces: pieces.length,
    "1x1": byLength["1x1"],
    "1x2": byLength["1x2"],
    "1x3": byLength["1x3"],
    colors: Array.from(colors).sort(),
    stability
  };
}

function matrixOccupied(matrix, palette, z) {
  const occupied = new Map();
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = row[x];
      if (color !== "." && palette[color]) occupied.set(cellKey(x, y, z), color);
    }
  });
  return occupied;
}

function mapCellsToPiece(pieces) {
  const map = new Map();
  pieces.forEach((piece) => {
    piece.cells.forEach(([x, y, z]) => map.set(cellKey(x, y, z), piece));
  });
  return map;
}

function collectJoints(pieces) {
  const joints = new Set();
  pieces.forEach((piece) => {
    pieceJoints(piece).forEach((joint) => joints.add(joint));
  });
  return joints;
}

function cellKey(x, y, z) {
  return `${x},${y},${z}`;
}

function normalizePriority(priority) {
  if (priority === "stability" || priority === "least_pieces") return priority;
  return "balanced";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
