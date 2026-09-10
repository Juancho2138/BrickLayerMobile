import {
  generateConstructionLayout,
  getInventoryByColorAndSize,
  getLayerConstructionStats,
  getPiecesForLayer,
  getStabilityReport,
  validateConstructionLayout
} from "../organizer.js";
export { COLOR_NAMES } from "../palette.js";

export function sanitizePdfFileName(name, profile) {
  const base = String(name || "Modelo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Modelo";
  return `${base}_Manual_${profile === "professional" ? "Profesional" : "Rapido"}.pdf`;
}

export function countCells(layers) {
  return layers.reduce((sum, layer) => {
    return sum + layer.matrix.join("").split("").filter((cell) => cell !== ".").length;
  }, 0);
}

export function selectLayers(project, settings) {
  const sorted = project.layers.slice().sort((a, b) => a.z - b.z);
  if (settings.layerMode !== "range") return sorted;
  const from = Number(settings.fromZ);
  const to = Number(settings.toZ);
  return sorted.filter((layer) => layer.z >= from && layer.z <= to);
}

export function activeReferencesForLayer(project, z) {
  return (project.references || []).filter((reference) => {
    return reference.start_z <= z && (reference.end_z === null || z <= reference.end_z);
  });
}

export function ensurePdfLayout(project, settings) {
  const layout = project.construction_layout;
  if (settings.useOrganization && layout && !layout.outdated && layout.generated_from_revision === (project.revision || 0)) {
    const errors = validateConstructionLayout(project, layout);
    if (!errors.length) return { layout, usedOrganization: true, warning: "" };
  }

  if (settings.useOrganization && layout?.outdated) {
    return {
      layout: fallbackLayout(project),
      usedOrganization: false,
      warning: "Este manual se genero sin organizacion estructural porque estaba desactualizada."
    };
  }

  return {
    layout: fallbackLayout(project),
    usedOrganization: false,
    warning: "Este manual se genero sin organizacion estructural."
  };
}

export function fallbackLayout(project) {
  const pieces = [];
  let nextId = 1;
  project.layers.forEach((layer) => {
    layer.matrix.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const color = row[x];
        if (color === "." || !project.palette[color]) continue;
        pieces.push({
          id: `B${nextId}`,
          z: layer.z,
          x,
          y,
          color,
          length: 1,
          orientation: "NONE",
          cells: [[x, y, layer.z]]
        });
        nextId += 1;
      }
    });
  });

  const layout = {
    version: 1,
    max_piece_length: 1,
    priority: "fallback_1x1",
    generated_from_revision: project.revision || 0,
    outdated: false,
    pieces,
    inventory: getInventoryByColorAndSize(pieces),
    layer_stats: [],
    stability: { score: 0, warnings: ["Organizacion estructural no usada"] },
    totals: { cells: pieces.length, physical_pieces: pieces.length }
  };

  layout.layer_stats = project.layers.map((layer) => {
    const layerPieces = pieces.filter((piece) => piece.z === layer.z);
    const colors = Array.from(new Set(layerPieces.map((piece) => piece.color))).sort();
    return {
      z: layer.z,
      cells: layerPieces.length,
      physical_pieces: layerPieces.length,
      "1x1": layerPieces.length,
      "1x2": 0,
      "1x3": 0,
      colors,
      stability: layer.z === 0 ? 100 : 0
    };
  });

  return layout;
}

export function buildPdfContext(project, settings) {
  const selectedLayers = selectLayers(project, settings);
  const { layout, usedOrganization, warning } = ensurePdfLayout(project, settings);
  const zValues = project.layers.map((layer) => layer.z);
  const usedColors = new Set();
  project.layers.forEach((layer) => {
    layer.matrix.forEach((row) => {
      for (const cell of row) if (cell !== ".") usedColors.add(cell);
    });
  });

  return {
    project,
    settings,
    selectedLayers,
    layout,
    usedOrganization,
    warning,
    totals: {
      layers: project.layers.length,
      selectedLayers: selectedLayers.length,
      cells: countCells(project.layers),
      selectedCells: countCells(selectedLayers),
      pieces: layout.totals.physical_pieces,
      colors: usedColors.size,
      zMin: zValues.length ? Math.min(...zValues) : 0,
      zMax: zValues.length ? Math.max(...zValues) : 0
    }
  };
}

export function getLayerPiecesFromLayout(layout, z) {
  return getPiecesForLayer({ construction_layout: layout }, z);
}

export function getLayerStatsFromLayout(layout, z) {
  return getLayerConstructionStats({ construction_layout: layout }, z);
}

export function getInventoryFromLayout(layout) {
  return getInventoryByColorAndSize({ construction_layout: layout });
}

export function getStabilityFromLayout(layout) {
  return getStabilityReport({ construction_layout: layout });
}

export function priorityLabel(priority) {
  const labels = {
    stability: "Estabilidad",
    balanced: "Equilibrado",
    least_pieces: "Menos piezas",
    fewest_pieces: "Menos piezas",
    fallback_1x1: "Sin organizacion"
  };
  return labels[priority] || String(priority || "Sin organizacion");
}

export function validatePdfConsistency(ctx) {
  const errors = [];
  const layout = ctx.layout;
  const layerCellTotals = new Map();
  ctx.project.layers.forEach((layer) => {
    layerCellTotals.set(layer.z, countCells([layer]));
  });

  let totalPieceCells = 0;
  const inventoryTotals = { pieces: 0, cells: 0 };
  Object.values(getInventoryFromLayout(layout)).forEach((counts) => {
    const count1x1 = counts["1x1"] || 0;
    const count1x2 = counts["1x2"] || 0;
    const count1x3 = counts["1x3"] || 0;
    inventoryTotals.pieces += count1x1 + count1x2 + count1x3;
    inventoryTotals.cells += count1x1 + count1x2 * 2 + count1x3 * 3;
  });

  ctx.project.layers.forEach((layer) => {
    const stat = getLayerStatsFromLayout(layout, layer.z);
    if (!stat) {
      errors.push(`Sin estadisticas para capa Z${layer.z}.`);
      return;
    }
    const count1x1 = stat["1x1"] || 0;
    const count1x2 = stat["1x2"] || 0;
    const count1x3 = stat["1x3"] || 0;
    const physicalPieces = count1x1 + count1x2 + count1x3;
    const cells = count1x1 + count1x2 * 2 + count1x3 * 3;
    totalPieceCells += cells;
    if (stat.physical_pieces !== physicalPieces) errors.push(`Conteo de piezas inconsistente en Z${layer.z}.`);
    if (stat.cells !== cells) errors.push(`Conteo de celdas por pieza inconsistente en Z${layer.z}.`);
    if (stat.cells !== layerCellTotals.get(layer.z)) errors.push(`Celdas de matriz no coinciden con piezas en Z${layer.z}.`);
  });

  if (layout.totals.physical_pieces !== inventoryTotals.pieces) errors.push("Inventario general no coincide con total de piezas.");
  if (layout.totals.cells !== inventoryTotals.cells) errors.push("Inventario general no coincide con total de voxeles.");
  if (layout.totals.cells !== countCells(ctx.project.layers)) errors.push("Total de voxeles no coincide con las matrices.");
  if (layout.totals.cells !== totalPieceCells) errors.push("Suma de celdas por capa no coincide con total de voxeles.");
  return errors;
}

export function estimatePageCount(project, settings) {
  const layers = selectLayers(project, settings).length;
  if (settings.profile === "quick") return 1 + layers;
  let pages = 3 + layers;
  if (settings.includeInventory) pages += 1;
  if (settings.include3dViews) pages += 1;
  return pages;
}

export function createOrganizedLayout(project, maxPieceLength = 3, priority = "balanced") {
  return generateConstructionLayout(project, { maxPieceLength, priority });
}
