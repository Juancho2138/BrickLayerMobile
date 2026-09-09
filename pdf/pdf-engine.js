import { jsPDF } from "../vendor/jspdf/jspdf-wrapper.js";
import {
  COLOR_NAMES,
  buildPdfContext,
  estimatePageCount,
  getInventoryFromLayout,
  getStabilityFromLayout,
  priorityLabel,
  sanitizePdfFileName,
  validatePdfConsistency
} from "./pdf-utils.js";
import { render3DToImage } from "./pdf-3d-capture.js";
import { addFooter, addPageTitle, pageMetrics, renderColorLegend, renderLayerPage } from "./pdf-layer-renderer.js";
import { renderInventoryPage } from "./pdf-inventory-renderer.js";

export async function generateManualPdf(project, settings, callbacks = {}) {
  validatePdfProject(project);
  const ctx = buildPdfContext(project, settings);
  const consistencyErrors = validatePdfConsistency(ctx);
  if (consistencyErrors.length) throw new Error(consistencyErrors[0]);
  const orientation = resolveOrientation(project, settings);
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const estimatedPages = estimatePageCount(project, settings);
  let pageIndex = 1;

  progress(callbacks, 5, "Portada");
  if (settings.profile === "professional") await renderProfessionalCover(doc, ctx, pageIndex, estimatedPages);
  else renderQuickCover(doc, ctx, pageIndex, estimatedPages);

  if (settings.profile === "professional") {
    doc.addPage();
    pageIndex += 1;
    progress(callbacks, 16, "Ficha tecnica");
    renderTechnicalSheet(doc, ctx, pageIndex, estimatedPages);

    if (settings.includeInventory) {
      doc.addPage();
      pageIndex += 1;
      progress(callbacks, 24, "Inventario");
      renderInventoryPage(doc, ctx, pageIndex, estimatedPages);
    }

    doc.addPage();
    pageIndex += 1;
    renderLegendPage(doc, ctx, pageIndex, estimatedPages);

    if (settings.include3dViews) {
      doc.addPage();
      pageIndex += 1;
      progress(callbacks, 34, "Vistas 3D");
      await renderViewsPage(doc, ctx, pageIndex, estimatedPages);
    }
  }

  for (let i = 0; i < ctx.selectedLayers.length; i += 1) {
    doc.addPage();
    pageIndex += 1;
    const layer = ctx.selectedLayers[i];
    progress(callbacks, 35 + Math.round((i / Math.max(1, ctx.selectedLayers.length)) * 60), `Procesando capa ${i + 1}/${ctx.selectedLayers.length}`);
    renderLayerPage(doc, ctx, layer, pageIndex, estimatedPages);
    await yieldToBrowser();
  }

  progress(callbacks, 98, "Generando PDF...");
  const blob = doc.output("blob");
  progress(callbacks, 100, "PDF listo");
  return {
    blob,
    fileName: sanitizePdfFileName(project.name, settings.profile),
    pages: pageIndex,
    context: ctx
  };
}

export function validatePdfProject(project) {
  if (!project || !Array.isArray(project.layers) || !project.layers.length) throw new Error("El proyecto no tiene capas.");
  if (!project.palette || typeof project.palette !== "object") throw new Error("La paleta no es valida.");
  const allowed = new Set([".", ...Object.keys(project.palette)]);
  project.layers.forEach((layer) => {
    if (!Array.isArray(layer.matrix) || layer.matrix.length !== project.size.y) throw new Error(`La capa ${layer.z} no tiene ${project.size.y} filas.`);
    layer.matrix.forEach((row) => {
      if (typeof row !== "string" || row.length !== project.size.x) throw new Error(`Una fila de Z${layer.z} no mide ${project.size.x}.`);
      for (const code of row) if (!allowed.has(code)) throw new Error(`Codigo de color invalido: ${code}`);
    });
  });
  const referenceIds = new Set();
  (project.references || []).forEach((reference) => {
    if (referenceIds.has(reference.id)) throw new Error(`Referencia duplicada: ${reference.id}`);
    referenceIds.add(reference.id);
    if (reference.x < 0 || reference.x >= project.size.x || reference.y < 0 || reference.y >= project.size.y) {
      throw new Error(`Referencia fuera de rango: ${reference.id}`);
    }
  });
}

function renderQuickCover(doc, ctx, pageIndex, totalPages) {
  addPageTitle(doc, "Manual rapido", ctx.project.name);
  renderCoverFacts(doc, ctx, 42);
  if (ctx.warning) {
    doc.setTextColor(160, 95, 0);
    doc.text(ctx.warning, 14, 98);
  }
  addFooter(doc, ctx.project.name, pageIndex, totalPages);
}

async function renderProfessionalCover(doc, ctx, pageIndex, totalPages) {
  const page = pageMetrics(doc);
  addPageTitle(doc, "BrickLayer Mobile", "Manual profesional");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(ctx.project.name, 14, 32);
  try {
    const image = render3DToImage(ctx.project, { view: "isometric", width: 1100, height: 760 });
    addImageContained(doc, image, "PNG", page.margin, 38, page.width - page.margin * 2, 142);
  } catch {
    doc.setFontSize(11);
    doc.text("Vista 3D no disponible en este dispositivo.", 18, 70);
  }
  renderCoverFacts(doc, ctx, 192);
  addFooter(doc, ctx.project.name, pageIndex, totalPages);
  await yieldToBrowser();
}

function renderCoverFacts(doc, ctx, startY) {
  const date = new Date().toLocaleDateString("es-CO");
  const lines = [
    `Fecha de generacion: ${date}`,
    `Dimensiones: ${ctx.project.size.x} x ${ctx.project.size.y} x ${ctx.totals.zMax + 1}`,
    `Total de capas: ${ctx.totals.layers}`,
    `Celdas / voxeles: ${ctx.totals.cells.toLocaleString("es-CO")}`,
    `Piezas fisicas: ${ctx.totals.pieces.toLocaleString("es-CO")}`,
    `Colores: ${ctx.totals.colors}`
  ];
  doc.setFontSize(11);
  doc.setTextColor(35, 35, 35);
  lines.forEach((line, index) => doc.text(line, 14, startY + index * 8));
}

function renderTechnicalSheet(doc, ctx, pageIndex, totalPages) {
  addPageTitle(doc, "Ficha tecnica", ctx.project.name);
  const stability = getStabilityFromLayout(ctx.layout);
  const lines = [
    `X: ${ctx.project.size.x}`,
    `Y: ${ctx.project.size.y}`,
    `Z: ${ctx.totals.zMax + 1}`,
    `Numero de capas: ${ctx.totals.layers}`,
    `Colores utilizados: ${ctx.totals.colors}`,
    `Total celdas / voxeles: ${ctx.totals.cells}`,
    `Total piezas fisicas: ${ctx.totals.pieces}`,
    `Tamano maximo permitido: ${ctx.layout.max_piece_length}`,
    `Prioridad de organizacion: ${priorityLabel(ctx.layout.priority)}`,
    `Estimacion de estabilidad: ${stability.score}/100`
  ];
  doc.setFontSize(11);
  doc.setTextColor(35, 35, 35);
  lines.forEach((line, index) => doc.text(line, 14, 38 + index * 8));
  if (ctx.warning) {
    doc.setTextColor(160, 95, 0);
    doc.text(ctx.warning, 14, 126);
  }
  addFooter(doc, ctx.project.name, pageIndex, totalPages);
}

function renderLegendPage(doc, ctx, pageIndex, totalPages) {
  addPageTitle(doc, "Leyenda de colores", ctx.project.name);
  renderColorLegend(doc, ctx.project, ctx.layout, 38);
  const references = (ctx.project.references || []).filter((reference) => reference.label);
  if (references.length) {
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("Referencias", 14, 150);
    doc.setFontSize(10);
    references.forEach((reference, index) => {
      doc.text(`${reference.id} = ${reference.label}`, 14, 160 + index * 7);
    });
  }
  addFooter(doc, ctx.project.name, pageIndex, totalPages);
}

async function renderViewsPage(doc, ctx, pageIndex, totalPages) {
  const page = pageMetrics(doc);
  addPageTitle(doc, "Vistas del modelo", ctx.project.name);
  const landscape = page.width > page.height;
  const views = landscape
    ? [
        ["Frontal", "front", page.margin, 36, (page.width - page.margin * 3) / 2, page.height - 70],
        ["Isometrica", "isometric", page.margin * 2 + (page.width - page.margin * 3) / 2, 36, (page.width - page.margin * 3) / 2, page.height - 70]
      ]
    : [
        ["Frontal", "front", page.margin, 34, page.width - page.margin * 2, 96],
        ["Isometrica", "isometric", page.margin, 154, page.width - page.margin * 2, 96]
      ];
  for (const [label, view, x, y, width, height] of views) {
    try {
      const image = render3DToImage(ctx.project, { view, width: 900, height: 620 });
      addImageContained(doc, image, "PNG", x, y, width, height);
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(label, x, y - 4);
    } catch {
      doc.text(`${label}: no disponible`, x, y + 20);
    }
    await yieldToBrowser();
  }
  addFooter(doc, ctx.project.name, pageIndex, totalPages);
}

function resolveOrientation(project, settings) {
  if (settings.pageOrientation === "portrait" || settings.pageOrientation === "landscape") return settings.pageOrientation;
  return project.size.x > project.size.y * 1.25 ? "landscape" : "portrait";
}

function addImageContained(doc, image, format, x, y, boxWidth, boxHeight) {
  const props = doc.getImageProperties(image);
  const ratio = props.width / props.height;
  let width = boxWidth;
  let height = width / ratio;
  if (height > boxHeight) {
    height = boxHeight;
    width = height * ratio;
  }
  doc.addImage(image, format, x + (boxWidth - width) / 2, y + (boxHeight - height) / 2, width, height);
}

function progress(callbacks, percent, message) {
  callbacks.onProgress?.({ percent, message });
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
