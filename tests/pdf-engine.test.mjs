import assert from "node:assert/strict";

class FakePdf {
  constructor(options) {
    this.options = options;
    this.pages = 1;
    this.internal = {
      pageSize: {
        getWidth: () => options.orientation === "landscape" ? 297 : 210,
        getHeight: () => options.orientation === "landscape" ? 210 : 297
      }
    };
  }

  addPage() { this.pages += 1; }
  setFontSize() {}
  setTextColor() {}
  setFillColor() {}
  setDrawColor() {}
  setLineWidth() {}
  text() {}
  rect() {}
  circle() {}
  line() {}
  addImage() {}
  getImageProperties() { return { width: 900, height: 620 }; }
  output(type) {
    assert.equal(type, "blob");
    return new Blob(["pdf"], { type: "application/pdf" });
  }
}

globalThis.jspdf = { jsPDF: FakePdf };

const { generateManualPdf } = await import("../pdf/pdf-engine.js");

const project = {
  format: "bricklayers-v1",
  name: "PDF Test",
  size: { x: 3, y: 2 },
  palette: { A: "#F4C400", R: "#D62828" },
  revision: 1,
  references: [],
  construction_layout: null,
  layers: [
    { z: 0, matrix: ["AAA", "R.."] },
    { z: 1, matrix: ["..A", "RR."] }
  ]
};

const baseSettings = {
  layerMode: "all",
  fromZ: 0,
  toZ: 1,
  pageOrientation: "portrait",
  useOrganization: true,
  includeLayerNumber: true,
  includeMatrix: true,
  includeColors: true,
  includePieceDivisions: true,
  includeReferences: true,
  includeLayerPieceCount: true,
  includeInventory: false,
  include3dViews: false,
  includeStats: true,
  includePieceIds: false,
  cumulative3d: "cover"
};

const quick = await generateManualPdf(project, { ...baseSettings, profile: "quick" });
assert.equal(quick.fileName, "PDF_Test_Manual_Rapido.pdf");
assert.equal(quick.pages, 3);
assert.equal(quick.blob.type, "application/pdf");

const professional = await generateManualPdf(project, { ...baseSettings, profile: "professional", includeInventory: true });
assert.equal(professional.fileName, "PDF_Test_Manual_Profesional.pdf");
assert.equal(professional.pages, 6);
assert.equal(professional.blob.type, "application/pdf");

console.log("pdf engine tests OK");
