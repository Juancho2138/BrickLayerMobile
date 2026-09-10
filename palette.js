export const BRICKLAYER_COLORS = [
  { code: "A", name: "Amarillo", hex: "#F4C400" },
  { code: "N", name: "Negro", hex: "#111111" },
  { code: "R", name: "Rojo", hex: "#D62828" },
  { code: "B", name: "Blanco", hex: "#F2F2F2" },
  { code: "C", name: "Cian", hex: "#27C2D1" },
  { code: "M", name: "Marron", hex: "#9B5A2E" },
  { code: "P", name: "Piel", hex: "#D9A074" },
  { code: "G", name: "Gris", hex: "#808080" },
  { code: "V", name: "Verde", hex: "#009B55" },
  { code: "L", name: "Morado", hex: "#7B3FB2" },
  { code: "U", name: "Azul", hex: "#1E63D6" },
  { code: "S", name: "Rosado", hex: "#F05AA6" },
  { code: "O", name: "Naranja", hex: "#F47C20" },
  { code: "I", name: "Lila", hex: "#B884F4" },
  { code: "Q", name: "Marron claro", hex: "#C9914B" }
];

export const COLOR_NAMES = Object.fromEntries(BRICKLAYER_COLORS.map((color) => [color.code, color.name]));
export const DEFAULT_PALETTE = Object.fromEntries(BRICKLAYER_COLORS.map((color) => [color.code, color.hex]));
export const COLOR_CODES = BRICKLAYER_COLORS.map((color) => color.code);
