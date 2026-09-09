import "./jspdf.umd.min.js";

if (!globalThis.jspdf?.jsPDF) {
  throw new Error("jsPDF no esta disponible.");
}

export const jsPDF = globalThis.jspdf.jsPDF;
