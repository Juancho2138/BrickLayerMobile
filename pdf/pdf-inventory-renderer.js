import { COLOR_NAMES, getInventoryFromLayout } from "./pdf-utils.js";
import { addFooter, addPageTitle } from "./pdf-layer-renderer.js";

export function renderInventoryPage(doc, ctx, pageIndex, totalPages) {
  addPageTitle(doc, "Inventario general", ctx.project.name);
  const inventory = getInventoryFromLayout(ctx.layout);
  let y = 36;
  let totalPieces = 0;

  Object.entries(inventory).forEach(([color, counts]) => {
    const totalColor = (counts["1x1"] || 0) + (counts["1x2"] || 0) + (counts["1x3"] || 0);
    totalPieces += totalColor;
    doc.setFillColor(ctx.project.palette[color]);
    doc.rect(14, y - 5, 8, 5, "F");
    doc.setTextColor(25, 25, 25);
    doc.setFontSize(11);
    doc.text(`${color} ${COLOR_NAMES[color] || ""}`, 26, y);
    doc.setFontSize(9);
    doc.text(`1x1: ${counts["1x1"] || 0}   1x2: ${counts["1x2"] || 0}   1x3: ${counts["1x3"] || 0}   Total: ${totalColor}`, 26, y + 6);
    y += 15;
    if (y > 270) {
      addFooter(doc, ctx.project.name, pageIndex, totalPages);
      doc.addPage();
      y = 24;
    }
  });

  doc.setFontSize(11);
  doc.text(`Total general de piezas fisicas: ${totalPieces}`, 14, y + 6);
  addFooter(doc, ctx.project.name, pageIndex, totalPages);
}
