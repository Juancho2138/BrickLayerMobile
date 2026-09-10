import assert from "node:assert/strict";
import fs from "node:fs";
import { BRICKLAYER_COLORS, COLOR_CODES, COLOR_NAMES, DEFAULT_PALETTE } from "../palette.js";
import { fallbackLayout } from "../pdf/pdf-utils.js";
import { generateConstructionLayout } from "../organizer.js";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.equal(BRICKLAYER_COLORS.length, 15);
assert.deepEqual(COLOR_CODES, ["A", "N", "R", "B", "C", "M", "P", "G", "V", "L", "U", "S", "O", "I", "Q"]);
assert.equal(DEFAULT_PALETTE.A, "#F4C400");
assert.equal(DEFAULT_PALETTE.N, "#111111");
assert.equal(DEFAULT_PALETTE.R, "#D62828");
assert.equal(DEFAULT_PALETTE.B, "#F2F2F2");
assert.equal(DEFAULT_PALETTE.C, "#27C2D1");
assert.equal(DEFAULT_PALETTE.M, "#9B5A2E");
assert.equal(DEFAULT_PALETTE.P, "#D9A074");
assert.equal(DEFAULT_PALETTE.G, "#808080");
assert.equal(DEFAULT_PALETTE.V, "#009B55");
assert.equal(DEFAULT_PALETTE.L, "#7B3FB2");
assert.equal(COLOR_NAMES.U, "Azul");
assert.equal(COLOR_NAMES.S, "Rosado");
assert.equal(COLOR_NAMES.O, "Naranja");
assert.equal(COLOR_NAMES.I, "Lila");
assert.equal(COLOR_NAMES.Q, "Marron claro");

assert.ok(appSource.includes("function selectColor(code)"));
assert.ok(appSource.includes('state.tool = "paint"'));
assert.ok(appSource.includes("function shouldIgnoreShortcut(event)"));
assert.ok(appSource.includes('tag === "INPUT"'));
assert.ok(appSource.includes('tag === "TEXTAREA"'));
assert.ok(appSource.includes('tag === "SELECT"'));
assert.ok(appSource.includes('key === "e"'));
assert.ok(appSource.includes('setTool("erase")'));
assert.ok(appSource.includes('key === "f"'));
assert.ok(appSource.includes('setTool("reference")'));
assert.ok(appSource.includes('key === "t"'));
assert.ok(appSource.includes('setTool("template")'));
assert.ok(appSource.includes('key === "k"'));
assert.ok(appSource.includes("addLayer()"));
assert.ok(appSource.includes('key === "d"'));
assert.ok(appSource.includes("duplicateCurrentLayer()"));
assert.ok(appSource.includes('key === "z"'));
assert.ok(appSource.includes("undo()"));
assert.ok(appSource.includes('key === "y"'));
assert.ok(appSource.includes("redo()"));
assert.ok(appSource.includes('event.key === "ArrowLeft"'));
assert.ok(appSource.includes('event.key === "ArrowRight"'));
assert.ok(appSource.includes("firstLayer()"));
assert.ok(appSource.includes("lastLayer()"));
assert.ok(appSource.includes("if (event.ctrlKey || event.altKey || event.metaKey) return;"));
assert.ok(!appSource.includes("if (event.ctrlKey && !event.altKey && !event.metaKey)"));
assert.ok(appSource.includes("toggleEditorLock()"));
assert.ok(appSource.includes("zoomIn()"));
assert.ok(appSource.includes("zoomOut()"));
assert.ok(appSource.includes("fitZoom()"));
assert.ok(appSource.includes("createReferenceAt(col, row)"));
assert.ok(appSource.includes("nextReferenceId()"));

assert.ok(htmlSource.indexOf('class="reference-panel"') < htmlSource.indexOf('id="matrixGrid"'));
assert.ok(htmlSource.includes('id="editorModeBtn"'));
assert.ok(htmlSource.includes('id="dragPaintToggle"'));
assert.ok(htmlSource.includes('data-tool="template"'));
assert.ok(htmlSource.includes('type="module" src="./app.js"'));
assert.ok(htmlSource.includes("<kbd>K</kbd> Nueva capa"));
assert.ok(htmlSource.includes("<kbd>D</kbd> Duplicar capa"));
assert.ok(htmlSource.includes("<kbd>Z</kbd> Deshacer"));
assert.ok(htmlSource.includes("<kbd>Y</kbd> Rehacer"));
assert.ok(!htmlSource.includes("<kbd>Ctrl</kbd>"));

const project = {
  format: "bricklayers-v1",
  name: "Paleta 15",
  size: { x: 5, y: 1 },
  palette: DEFAULT_PALETTE,
  revision: 1,
  references: [{ id: "R1", x: 0, y: 0, start_z: 0, end_z: null, label: "" }],
  layers: [{ z: 0, matrix: ["USOIQ"] }]
};
const fallback = fallbackLayout(project);
assert.deepEqual(Object.keys(fallback.inventory).sort(), ["I", "O", "Q", "S", "U"]);
const layout = generateConstructionLayout(project, { maxPieceLength: 3, priority: "balanced" });
assert.equal(layout.totals.cells, 5);
assert.ok(!layout.pieces.some((piece) => piece.id === "R1"));

console.log("editor UX tests OK");
