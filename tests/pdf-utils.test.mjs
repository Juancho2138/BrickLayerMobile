import assert from "node:assert/strict";
import {
  buildPdfContext,
  estimatePageCount,
  fallbackLayout,
  priorityLabel,
  sanitizePdfFileName,
  selectLayers,
  validatePdfConsistency
} from "../pdf/pdf-utils.js";
import { quickPdfSettings, professionalPdfSettings } from "../pdf/pdf-profiles.js";

const project = {
  format: "bricklayers-v1",
  name: "Modelo Rapido",
  size: { x: 4, y: 2 },
  palette: { A: "#F4C400", R: "#D62828" },
  revision: 2,
  references: [{ id: "R1", x: 0, y: 0, start_z: 0, end_z: null, label: "Centro" }],
  construction_layout: null,
  layers: [
    { z: 0, matrix: ["AARR", "...."] },
    { z: 1, matrix: ["AA..", "..RR"] },
    { z: 2, matrix: ["....", "RRRR"] }
  ]
};

const rangeSettings = {
  profile: "quick",
  layerMode: "range",
  fromZ: 1,
  toZ: 2,
  useOrganization: true,
  includeInventory: false,
  include3dViews: false
};

assert.deepEqual(selectLayers(project, rangeSettings).map((layer) => layer.z), [1, 2]);
assert.equal(sanitizePdfFileName("Modelo rapido", "quick"), "Modelo_rapido_Manual_Rapido.pdf");

const layout = fallbackLayout(project);
assert.equal(layout.max_piece_length, 1);
assert.equal(layout.inventory.A["1x1"], 4);
assert.equal(layout.inventory.R["1x1"], 8);

const ctx = buildPdfContext(project, rangeSettings);
assert.equal(ctx.selectedLayers.length, 2);
assert.equal(ctx.usedOrganization, false);
assert.equal(ctx.totals.selectedCells, 8);
assert.deepEqual(validatePdfConsistency(ctx), []);

{
  const pieces = [
    { id: "B1", z: 0, x: 0, y: 0, color: "A", length: 1, orientation: "NONE", cells: [[0, 0, 0]] },
    { id: "B2", z: 0, x: 1, y: 0, color: "A", length: 1, orientation: "NONE", cells: [[1, 0, 0]] },
    { id: "B3", z: 0, x: 0, y: 1, color: "R", length: 2, orientation: "X", cells: [[0, 1, 0], [1, 1, 0]] },
    { id: "B4", z: 1, x: 0, y: 0, color: "A", length: 2, orientation: "X", cells: [[0, 0, 1], [1, 0, 1]] },
    { id: "B5", z: 1, x: 2, y: 0, color: "A", length: 2, orientation: "Y", cells: [[2, 0, 1], [2, 1, 1]] },
    { id: "B6", z: 2, x: 0, y: 1, color: "R", length: 3, orientation: "X", cells: [[0, 1, 2], [1, 1, 2], [2, 1, 2]] }
  ];
  const organizedProject = {
    ...project,
    size: { x: 4, y: 2 },
    construction_layout: {
      version: 1,
      max_piece_length: 3,
      priority: "stability",
      generated_from_revision: project.revision,
      outdated: false,
      pieces,
      inventory: { A: { "1x1": 2, "1x2": 2, "1x3": 0 }, R: { "1x1": 0, "1x2": 1, "1x3": 1 } },
      layer_stats: [
        { z: 0, cells: 4, physical_pieces: 3, "1x1": 2, "1x2": 1, "1x3": 0, colors: ["A", "R"], stability: 100 },
        { z: 1, cells: 4, physical_pieces: 2, "1x1": 0, "1x2": 2, "1x3": 0, colors: ["A"], stability: 90 },
        { z: 2, cells: 3, physical_pieces: 1, "1x1": 0, "1x2": 0, "1x3": 1, colors: ["R"], stability: 80 }
      ],
      stability: { score: 90, warnings: [] },
      totals: { cells: 11, physical_pieces: 6 }
    },
    layers: [
      { z: 0, matrix: ["AA..", "RR.."] },
      { z: 1, matrix: ["AAA.", "..A."] },
      { z: 2, matrix: ["....", "RRR."] }
    ]
  };
  const organizedCtx = buildPdfContext(organizedProject, { ...rangeSettings, layerMode: "all" });
  assert.equal(organizedCtx.usedOrganization, true);
  assert.equal(organizedCtx.totals.pieces, 6);
  assert.equal(organizedCtx.totals.cells, 11);
  assert.deepEqual(validatePdfConsistency(organizedCtx), []);

  const totalPiecesByLayer = organizedCtx.project.layers.reduce((sum, layer) => {
    const stat = organizedCtx.layout.layer_stats.find((item) => item.z === layer.z);
    return sum + stat.physical_pieces;
  }, 0);
  const totalCellsByLayer = organizedCtx.project.layers.reduce((sum, layer) => {
    const stat = organizedCtx.layout.layer_stats.find((item) => item.z === layer.z);
    return sum + stat.cells;
  }, 0);
  const totalPiecesByInventory = Object.values(organizedCtx.layout.inventory).reduce((sum, counts) => {
    return sum + counts["1x1"] + counts["1x2"] + counts["1x3"];
  }, 0);
  assert.equal(totalPiecesByLayer, organizedCtx.layout.totals.physical_pieces);
  assert.equal(totalCellsByLayer, organizedCtx.layout.totals.cells);
  assert.equal(totalPiecesByInventory, organizedCtx.layout.totals.physical_pieces);

  const outdatedCtx = buildPdfContext({
    ...organizedProject,
    revision: organizedProject.revision + 1,
    construction_layout: { ...organizedProject.construction_layout, outdated: true }
  }, { ...rangeSettings, layerMode: "all" });
  assert.equal(outdatedCtx.usedOrganization, false);
  assert.equal(outdatedCtx.layout.max_piece_length, 1);
  assert.equal(outdatedCtx.totals.pieces, 11);
  assert.deepEqual(validatePdfConsistency(outdatedCtx), []);
}

assert.equal(priorityLabel("stability"), "Estabilidad");
assert.equal(priorityLabel("balanced"), "Equilibrado");
assert.equal(priorityLabel("fewest_pieces"), "Menos piezas");
assert.equal(priorityLabel("least_pieces"), "Menos piezas");
assert.equal(quickPdfSettings(project).profile, "quick");
assert.equal(professionalPdfSettings(project).profile, "professional");

assert.equal(estimatePageCount(project, { ...rangeSettings, profile: "quick" }), 3);
assert.equal(estimatePageCount(project, { ...rangeSettings, profile: "professional" }), 5);
assert.equal(estimatePageCount(project, { ...rangeSettings, profile: "professional", includeInventory: true, include3dViews: true }), 7);

console.log("pdf utils tests OK");
