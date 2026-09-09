import assert from "node:assert/strict";
import fs from "node:fs";
import {
  generateConstructionLayout,
  getInventoryByColorAndSize,
  getLayerConstructionStats,
  getPiecesForLayer,
  getStabilityReport,
  validateConstructionLayout
} from "../organizer.js";

const palette = {
  A: "#F4C400",
  R: "#D62828",
  N: "#111111"
};

function project(layers, references = []) {
  return {
    format: "bricklayers-v1",
    name: "Test",
    size: { x: layers[0].matrix[0].length, y: layers[0].matrix.length },
    palette,
    revision: 1,
    references,
    layers
  };
}

function occupiedCount(layers) {
  return layers.reduce((sum, layer) => {
    return sum + layer.matrix.join("").split("").filter((cell) => cell !== ".").length;
  }, 0);
}

function layoutFor(input, options) {
  const before = JSON.stringify(input.layers);
  const layout = generateConstructionLayout(input, options);
  assert.deepEqual(validateConstructionLayout(input, layout), []);
  assert.equal(JSON.stringify(input.layers), before, "reorganizar no debe modificar matrices");
  return layout;
}

{
  const input = project([
    { z: 0, matrix: ["AAAA", "AAAA", "AAAA", "AAAA"] },
    { z: 1, matrix: ["....", ".AA.", ".AA.", "...."] }
  ], [{ id: "R1", x: 1, y: 1, start_z: 0, end_z: null, label: "Referencia" }]);
  const layout = layoutFor(input, { maxPieceLength: 3, priority: "balanced" });
  assert.equal(layout.totals.cells, 20);
  assert.equal(layout.pieces.flatMap((piece) => piece.cells).length, 20);
  assert.equal(getPiecesForLayer({ construction_layout: layout }, 0).reduce((sum, piece) => sum + piece.cells.length, 0), 16);
  assert.equal(getPiecesForLayer({ construction_layout: layout }, 1).reduce((sum, piece) => sum + piece.cells.length, 0), 4);
  assert.ok(!layout.pieces.some((piece) => piece.id === "R1"), "referencias no deben generar piezas");
}

{
  const input = project([{ z: 0, matrix: ["RRRAANNN"] }]);
  const layout = layoutFor(input, { maxPieceLength: 3, priority: "least_pieces" });
  assert.equal(layout.totals.cells, 8);
  assert.ok(layout.pieces.every((piece) => new Set(piece.cells.map(([x]) => input.layers[0].matrix[0][x])).size === 1));
  assert.ok(layout.pieces.every((piece) => piece.length <= 3));
  assert.deepEqual(Object.keys(layout.inventory).sort(), ["A", "N", "R"]);
}

{
  const input = project([
    { z: 0, matrix: ["RRRRRR", "RRRRRR", "RRRRRR"] },
    { z: 1, matrix: ["RRRRRR", "RRRRRR", "RRRRRR"] },
    { z: 2, matrix: ["RRRRRR", "RRRRRR", "RRRRRR"] }
  ]);
  const stable = layoutFor(input, { maxPieceLength: 3, priority: "stability" });
  const least = layoutFor(input, { maxPieceLength: 3, priority: "least_pieces" });
  const stableY = stable.pieces.filter((piece) => piece.z > 0 && piece.orientation === "Y").length;
  const leastY = least.pieces.filter((piece) => piece.z > 0 && piece.orientation === "Y").length;
  assert.ok(stableY >= leastY, "estabilidad debe intentar alternar orientacion/trabado");
}

{
  const input = project([{ z: 0, matrix: ["ARN", "NRA", "RAN"] }]);
  const layout = layoutFor(input, { maxPieceLength: 1, priority: "balanced" });
  assert.equal(layout.pieces.length, occupiedCount(input.layers));
  assert.ok(layout.pieces.every((piece) => piece.length === 1 && piece.orientation === "NONE"));
}

{
  const input = project([{ z: 0, matrix: ["AAA", "A.A", "AAA"] }]);
  const layout = layoutFor(input, { maxPieceLength: 3, priority: "balanced" });
  const inventory = getInventoryByColorAndSize({ construction_layout: layout });
  assert.deepEqual(inventory, layout.inventory);
  assert.equal(getLayerConstructionStats({ construction_layout: layout }, 0).cells, 8);
  assert.ok(Number.isInteger(getStabilityReport({ construction_layout: layout }).score));
}

{
  const input = project([{ z: 0, matrix: ["AAAAAAAAAAA"] }]);
  const pieces = [
    { id: "B1", z: 0, x: 0, y: 0, color: "A", length: 1, orientation: "NONE", cells: [[0, 0, 0]] },
    { id: "B2", z: 0, x: 1, y: 0, color: "A", length: 1, orientation: "NONE", cells: [[1, 0, 0]] },
    { id: "B3", z: 0, x: 2, y: 0, color: "A", length: 2, orientation: "X", cells: [[2, 0, 0], [3, 0, 0]] },
    { id: "B4", z: 0, x: 4, y: 0, color: "A", length: 2, orientation: "X", cells: [[4, 0, 0], [5, 0, 0]] },
    { id: "B5", z: 0, x: 6, y: 0, color: "A", length: 2, orientation: "X", cells: [[6, 0, 0], [7, 0, 0]] },
    { id: "B6", z: 0, x: 8, y: 0, color: "A", length: 3, orientation: "X", cells: [[8, 0, 0], [9, 0, 0], [10, 0, 0]] }
  ];
  const layout = {
    version: 1,
    max_piece_length: 3,
    priority: "balanced",
    generated_from_revision: 1,
    outdated: false,
    pieces,
    inventory: { A: { "1x1": 2, "1x2": 3, "1x3": 1 } },
    layer_stats: [{ z: 0, cells: 11, physical_pieces: 6, "1x1": 2, "1x2": 3, "1x3": 1, colors: ["A"], stability: 100 }],
    stability: { score: 100, warnings: [] },
    totals: { cells: 11, physical_pieces: 6 }
  };
  assert.deepEqual(validateConstructionLayout(input, layout), []);
  const stats = getLayerConstructionStats({ construction_layout: layout }, 0);
  assert.equal(stats.physical_pieces, 6);
  assert.equal(stats.cells, 11);
  assert.equal(stats["1x1"], 2);
  assert.equal(stats["1x2"], 3);
  assert.equal(stats["1x3"], 1);
  assert.deepEqual(getInventoryByColorAndSize({ construction_layout: layout }), layout.inventory);

  const staleStatsLayout = {
    ...layout,
    layer_stats: [{ z: 0, cells: 12, physical_pieces: 6, "1x1": 6, "1x2": 6, "1x3": 0, colors: ["A"], stability: 100 }]
  };
  const recomputed = getLayerConstructionStats({ construction_layout: staleStatsLayout }, 0);
  assert.equal(recomputed.physical_pieces, 6);
  assert.equal(recomputed.cells, 11);
  assert.equal(recomputed["1x1"], 2);
  assert.equal(recomputed["1x2"], 3);
  assert.equal(recomputed["1x3"], 1);
  assert.ok(validateConstructionLayout(input, staleStatsLayout).some((error) => error.includes("conteo por tamano")));

  const oldProjectLayout = { ...layout, layer_stats: [] };
  assert.deepEqual(validateConstructionLayout(input, oldProjectLayout), []);
  assert.equal(getLayerConstructionStats({ construction_layout: oldProjectLayout }, 0).physical_pieces, 6);
}

function perfProject(blocks) {
  const x = 30;
  const y = 20;
  const layers = [];
  let remaining = blocks;
  let z = 0;
  while (remaining > 0) {
    const rows = [];
    for (let row = 0; row < y; row += 1) {
      let line = "";
      for (let col = 0; col < x; col += 1) {
        line += remaining > 0 ? (col % 3 === 0 ? "A" : col % 3 === 1 ? "R" : "N") : ".";
        remaining -= 1;
      }
      rows.push(line);
    }
    layers.push({ z, matrix: rows });
    z += 1;
  }
  return {
    format: "bricklayers-v1",
    name: "Perf",
    size: { x, y },
    palette,
    revision: 1,
    references: [{ id: "R1", x: 0, y: 0, start_z: 0, end_z: null, label: "No pieza" }],
    layers
  };
}

for (const size of [600, 1500, 3000]) {
  const input = perfProject(size);
  const start = performance.now();
  const layout = layoutFor(input, { maxPieceLength: 3, priority: "balanced" });
  const elapsed = Math.round(performance.now() - start);
  assert.equal(layout.totals.cells, size);
  console.log(`${size} celdas organizadas en ${elapsed}ms con ${layout.totals.physical_pieces} piezas`);
}

{
  const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(appSource.includes("if (state.project.construction_layout) state.project.construction_layout.outdated = true"));
  assert.ok(appSource.includes("markGeometryChanged(\"Capa anterior copiada.\")"));
  assert.ok(appSource.includes("markGeometryChanged(\"Capa duplicada.\")"));
  assert.ok(appSource.includes("markGeometryChanged(\"Capa eliminada.\")"));
  assert.ok(appSource.includes("markGeometryChanged(\"Relleno aplicado.\")"));
}

console.log("organizer tests OK");
