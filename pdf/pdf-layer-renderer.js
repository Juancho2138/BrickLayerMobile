import {
  COLOR_NAMES,
  activeReferencesForLayer,
  getLayerPiecesFromLayout,
  getLayerStatsFromLayout
} from "./pdf-utils.js";

export function renderLayerPage(doc, ctx, layer, pageIndex, totalPages) {
  const { project, settings, layout } = ctx;
  const page = pageMetrics(doc);
  addPageTitle(doc, `Capa Z: ${layer.z}`, project.name);

  const pieces = settings.includePieceDivisions ? getLayerPiecesFromLayout(layout, layer.z) : [];
  const references = settings.includeReferences ? activeReferencesForLayer(project, layer.z) : [];
  const matrixBox = {
    x: page.margin,
    y: 34,
    width: page.width - page.margin * 2,
    height: page.height - 72
  };

  renderMatrix(doc, project, layer, pieces, references, matrixBox, settings);
  renderLayerFooterStats(doc, ctx, layer, page.height - 30);
  addFooter(doc, project.name, pageIndex, totalPages);
}

export function renderMatrix(doc, project, layer, pieces, references, box, settings = {}) {
  const rows = layer.matrix.length;
  const cols = layer.matrix[0]?.length || 0;
  if (!rows || !cols) return;

  const labelSpace = 9;
  const cell = Math.min((box.width - labelSpace) / cols, (box.height - labelSpace) / rows);
  const gridWidth = cell * cols;
  const gridHeight = cell * rows;
  const startX = box.x + labelSpace + Math.max(0, (box.width - labelSpace - gridWidth) / 2);
  const startY = box.y + labelSpace;

  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  for (let x = 0; x < cols; x += 1) {
    doc.text(String(x + 1), startX + x * cell + cell / 2, box.y + 4, { align: "center" });
  }
  for (let y = 0; y < rows; y += 1) {
    doc.text(String(y + 1), box.x + 3, startY + y * cell + cell * 0.68, { align: "center" });
  }

  doc.setLineWidth(0.08);
  doc.setDrawColor(190, 190, 190);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const code = layer.matrix[y][x];
      const fill = code === "." ? "#ffffff" : project.palette[code];
      doc.setFillColor(fill);
      doc.rect(startX + x * cell, startY + y * cell, cell, cell, "FD");
    }
  }

  if (settings.includePieceDivisions !== false && pieces.length) {
    drawPieceBorders(doc, pieces, startX, startY, cell);
    if (settings.includePieceIds) drawPieceIds(doc, pieces, startX, startY, cell);
  }

  if (references.length) drawReferences(doc, references, startX, startY, cell);

  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("X izquierda/derecha - Y frente/fondo - Z altura", box.x, startY + gridHeight + 8);
}

function drawPieceBorders(doc, pieces, startX, startY, cell) {
  const pieceMap = new Map();
  pieces.forEach((piece) => {
    piece.cells.forEach(([x, y]) => pieceMap.set(`${x},${y}`, piece.id));
  });

  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(Math.max(0.22, cell * 0.035));
  pieceMap.forEach((id, key) => {
    const [x, y] = key.split(",").map(Number);
    const px = startX + x * cell;
    const py = startY + y * cell;
    if (pieceMap.get(`${x},${y - 1}`) !== id) doc.line(px, py, px + cell, py);
    if (pieceMap.get(`${x + 1},${y}`) !== id) doc.line(px + cell, py, px + cell, py + cell);
    if (pieceMap.get(`${x},${y + 1}`) !== id) doc.line(px, py + cell, px + cell, py + cell);
    if (pieceMap.get(`${x - 1},${y}`) !== id) doc.line(px, py, px, py + cell);
  });
}

function drawPieceIds(doc, pieces, startX, startY, cell) {
  doc.setFontSize(Math.max(4, Math.min(7, cell * 0.45)));
  doc.setTextColor(20, 20, 20);
  pieces.forEach((piece) => {
    const [x, y] = piece.cells[0];
    doc.text(piece.id, startX + x * cell + cell * 0.12, startY + y * cell + cell * 0.62);
  });
}

function drawReferences(doc, references, startX, startY, cell) {
  doc.setDrawColor(210, 20, 150);
  doc.setTextColor(210, 20, 150);
  doc.setLineWidth(Math.max(0.2, cell * 0.03));
  doc.setFontSize(Math.max(5, Math.min(8, cell * 0.5)));
  references.forEach((reference) => {
    const cx = startX + reference.x * cell + cell / 2;
    const cy = startY + reference.y * cell + cell / 2;
    const r = cell * 0.32;
    doc.circle(cx, cy, r, "S");
    doc.line(cx - r, cy, cx + r, cy);
    doc.line(cx, cy - r, cx, cy + r);
    doc.text(reference.id, cx, cy + r + 3, { align: "center" });
  });
}

function renderLayerFooterStats(doc, ctx, layer, y) {
  const stat = getLayerStatsFromLayout(ctx.layout, layer.z);
  const cells = layer.matrix.join("").split("").filter((cell) => cell !== ".").length;
  const pieces = stat?.physical_pieces ?? cells;
  const count1x1 = stat?.["1x1"] ?? pieces;
  const count1x2 = stat?.["1x2"] ?? 0;
  const count1x3 = stat?.["1x3"] ?? 0;
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(`Capa ${layer.z} - Celdas: ${cells} - Piezas: ${pieces} - 1x1: ${count1x1} - 1x2: ${count1x2} - 1x3: ${count1x3}`, 14, y);
}

export function addFooter(doc, modelName, pageIndex, totalPages) {
  const page = pageMetrics(doc);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`BrickLayer Mobile - Modelo: ${modelName} - Pagina ${pageIndex} de ${totalPages}`, page.width / 2, page.height - 9, { align: "center" });
}

export function addPageTitle(doc, title, subtitle = "") {
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(95, 95, 95);
    doc.text(subtitle, 14, 23);
  }
}

export function pageMetrics(doc) {
  return {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
    margin: 14
  };
}

export function renderColorLegend(doc, project, layout, startY = 34) {
  const totals = {};
  layout.pieces.forEach((piece) => {
    totals[piece.color] = (totals[piece.color] || 0) + piece.cells.length;
  });

  let y = startY;
  Object.entries(project.palette).forEach(([code, hex]) => {
    if (!totals[code]) return;
    doc.setFillColor(hex);
    doc.rect(14, y - 5, 8, 5, "F");
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(`${code} ${COLOR_NAMES[code] || ""} - ${totals[code]} celdas`, 26, y);
    y += 8;
  });
}
