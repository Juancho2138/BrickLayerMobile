import { BRICKLAYER_COLORS, COLOR_NAMES, DEFAULT_PALETTE } from "./palette.js";

export const HONGMENG_KEY = "hongmengtoken123";
export const HONGMENG_IV = "abcdefg123456789";
export const MAX_LDR_BYTES = 5 * 1024 * 1024;

const LDRAW_UNIT = 20;
const LDRAW_LAYER_HEIGHT = 16;
const INTEGER_TOLERANCE = 1e-4;
export const FALLBACK_COLOR_CODE = "G";

export const LDRAW_COLOR_MAP = {
  0: { bricklayer: "N", physical: "Black" },
  1: { bricklayer: "U", physical: "Blue" },
  4: { bricklayer: "R", physical: "Red" },
  6: { bricklayer: "M", physical: "Brown" },
  7: { bricklayer: "G", physical: "Light Grey" },
  10: { bricklayer: "V", physical: "Bright Green" },
  13: { bricklayer: "S", physical: "Pink" },
  14: { bricklayer: "A", physical: "Yellow" },
  15: { bricklayer: "B", physical: "White" },
  18: { bricklayer: "A", physical: "Light Yellow" },
  25: { bricklayer: "O", physical: "Orange" },
  77: { bricklayer: "S", physical: "Light Pink" },
  78: { bricklayer: "P", physical: "Light Nougat" },
  234: { bricklayer: "A", physical: "Trans Fire Yellow" },
  272: { bricklayer: "U", physical: "Dark Blue" },
  322: { bricklayer: "C", physical: "Medium Azure" },
  484: { bricklayer: "M", physical: "Dark Orange" }
};

export const LDRAW_COLOR_TO_BRICKLAYER = Object.fromEntries(
  Object.entries(LDRAW_COLOR_MAP).map(([id, info]) => [id, info.bricklayer])
);

const BRICKLAYER_COLOR_CODES = new Set(BRICKLAYER_COLORS.map((color) => color.code));
validateColorMap();

const LINEAR_PART_LENGTHS = {
  "lg-cl1a1n.dat": 1,
  "lg-cl1a2n.dat": 2,
  "lg-cl1a3n.dat": 3
};

const PART_ADAPTERS = {
  "lg-cl1a1n.dat": expandLinearPiece,
  "lg-cl1a2n.dat": expandLinearPiece,
  "lg-cl1a3n.dat": expandLinearPiece
};

export class UnsupportedLDrawPiecesError extends Error {
  constructor(unsupportedPieces) {
    const summary = unsupportedPieces.map((piece) => `${piece.part} (${piece.count})`).join(", ");
    super(`El archivo contiene piezas todavia no compatibles: ${summary}`);
    this.name = "UnsupportedLDrawPiecesError";
    this.unsupportedPieces = unsupportedPieces;
  }
}

export function looksLikeLDrawText(text) {
  if (typeof text !== "string") return false;
  const lines = text.split(/\r?\n/);
  let meaningful = 0;
  let ldrawSignals = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    meaningful += 1;
    if (/^0\s+STEP\b/i.test(trimmed)) ldrawSignals += 1;
    else if (parseTypeOneLine(trimmed)) ldrawSignals += 1;
    if (meaningful >= 24 && ldrawSignals > 0) return true;
  }
  return ldrawSignals > 0;
}

export function parseLDraw(text) {
  const pieces = [];
  const steps = [{ index: 0, pieceIndexes: [] }];
  const errors = [];
  const lines = String(text || "").split(/\r?\n/);
  let currentStep = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^0\s+STEP\b/i.test(trimmed)) {
      currentStep += 1;
      steps.push({ index: currentStep, pieceIndexes: [] });
      return;
    }
    if (!trimmed.startsWith("1 ")) return;
    const piece = parseTypeOneLine(trimmed);
    if (!piece) {
      errors.push(`Linea ${index + 1}: pieza tipo 1 invalida.`);
      return;
    }
    piece.lineNumber = index + 1;
    piece.step = currentStep;
    steps[currentStep].pieceIndexes.push(pieces.length);
    pieces.push(piece);
  });

  return { pieces, steps, errors };
}

export async function decodeLdrContent(content) {
  const text = normalizeTextInput(content);
  if (looksLikeLDrawText(text)) {
    return { text, sourceType: "ldraw" };
  }
  const decrypted = await decryptHongmengLdr(text);
  if (!looksLikeLDrawText(decrypted)) {
    throw new Error("El archivo no parece un LDraw valido despues de descifrar Hongmeng.");
  }
  return { text: decrypted, sourceType: "hongmeng" };
}

export async function importLdrContent(content, options = {}) {
  if (typeof content === "string" && byteLength(content) > MAX_LDR_BYTES) {
    throw new Error("El archivo LDR supera el limite permitido.");
  }
  const decoded = await decodeLdrContent(content);
  const parsed = parseLDraw(decoded.text);
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]);
  }
  const converted = convertParsedLDrawToProject(parsed, options);
  return {
    ...converted,
    sourceType: decoded.sourceType,
    steps: parsed.steps
  };
}

export function projectNameFromLdrFilename(filename) {
  const clean = String(filename || "").split(/[\\/]/).pop().trim();
  if (!clean) return "Modelo LDR importado";
  return clean.replace(/\.ldr$/i, "") || "Modelo LDR importado";
}

export function convertParsedLDrawToProject(parsed, options = {}) {
  const name = options.name || "Modelo LDR importado";
  const warnings = [];
  const unknownColors = new Set();
  const detectedColors = new Map();
  const rawVoxels = [];
  const pieceCounts = {};
  const unsupportedPieces = new Map();

  parsed.pieces.forEach((piece) => {
    const partName = normalizePartName(piece.part);
    pieceCounts[partName] = (pieceCounts[partName] || 0) + 1;
    if (!PART_ADAPTERS[partName]) trackUnsupportedPiece(unsupportedPieces, partName, piece);
  });

  if (unsupportedPieces.size) {
    throw new UnsupportedLDrawPiecesError(unsupportedPieceSummary(unsupportedPieces));
  }

  parsed.pieces.forEach((piece) => {
    const partName = normalizePartName(piece.part);
    const adapter = PART_ADAPTERS[partName];
    const colorCode = mapLDrawColor(piece.color, unknownColors);
    trackDetectedColor(detectedColors, piece.color, colorCode);
    adapter(piece).forEach((voxel) => {
      rawVoxels.push({
        ...voxel,
        color: colorCode,
        sourcePart: partName,
        sourcePiece: piece,
        lineNumber: piece.lineNumber
      });
    });
  });

  if (!rawVoxels.length) {
    throw new Error("El archivo LDR no contiene voxels compatibles para importar.");
  }

  const verticalGrid = analyzeVerticalGrid(rawVoxels);
  const integerVoxels = rawVoxels.map((voxel) => {
    const zResolution = resolveBrickLayerZ(voxel, verticalGrid);
    return {
      ...voxel,
      sourceX: toGridInteger(voxel.ldrawX / LDRAW_UNIT, `X en linea ${voxel.lineNumber}`),
      sourceY: toGridInteger(voxel.ldrawZ / LDRAW_UNIT, `Z horizontal en linea ${voxel.lineNumber}`),
      sourceZ: zResolution.z
    };
  });

  const bounds = boundsFor(integerVoxels);
  const normalized = integerVoxels.map((voxel) => ({
    x: voxel.sourceX - bounds.minX,
    y: bounds.maxY - voxel.sourceY,
    z: voxel.sourceZ - bounds.minZ,
    color: voxel.color,
    sourcePart: voxel.sourcePart,
    lineNumber: voxel.lineNumber
  }));

  const dimensions = {
    x: bounds.maxX - bounds.minX + 1,
    y: bounds.maxY - bounds.minY + 1,
    z: bounds.maxZ - bounds.minZ + 1
  };
  validateDimensions(dimensions);

  const cells = new Map();
  normalized.forEach((voxel) => {
    validateVoxel(voxel, dimensions);
    const key = `${voxel.x},${voxel.y},${voxel.z}`;
    if (cells.has(key)) {
      const previous = cells.get(key);
      throw new Error(`Colision de voxels en X ${voxel.x + 1}, Y ${voxel.y + 1}, Z ${voxel.z}: lineas ${previous.lineNumber} y ${voxel.lineNumber}.`);
    }
    cells.set(key, voxel);
  });

  unknownColors.forEach((color) => warnings.push(`Color LDraw ${color} no mapeado; se uso ${FALLBACK_COLOR_CODE}.`));

  const layers = Array.from({ length: dimensions.z }, (_, z) => ({
    z,
    matrix: createMatrix(dimensions.x, dimensions.y)
  }));
  cells.forEach((voxel) => {
    const row = layers[voxel.z].matrix[voxel.y];
    layers[voxel.z].matrix[voxel.y] = row.slice(0, voxel.x) + voxel.color + row.slice(voxel.x + 1);
  });

  return {
    project: {
      format: "bricklayers-v1",
      name,
      size: { x: dimensions.x, y: dimensions.y },
      palette: { ...DEFAULT_PALETTE },
      revision: 0,
      references: [],
      reference_image: {
        data_url: "",
        visible: true,
        x: 16,
        y: 16,
        scale: 1,
        opacity: 100,
        block_opacity: 100
      },
      construction_layout: null,
      layers
    },
    warnings,
    stats: {
      physicalPieces: parsed.pieces.length,
      voxels: normalized.length,
      dimensions,
      pieceCounts,
      colors: colorSummary(detectedColors),
      vertical: {
        normalPositions: verticalGrid.normalPositions,
        specialPositions: verticalGrid.specialPositions
      },
      unknownColors: [...unknownColors].sort((a, b) => Number(a) - Number(b))
    }
  };
}

export async function decryptHongmengLdr(base64Text) {
  const bytes = base64ToBytes(String(base64Text || "").replace(/\s+/g, ""));
  if (!bytes.length || bytes.length % 16 !== 0) {
    throw new Error("El contenido Hongmeng no tiene un tamano AES-CBC valido.");
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Este navegador no soporta Web Crypto AES-CBC.");
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const key = await subtle.importKey("raw", encoder.encode(HONGMENG_KEY), { name: "AES-CBC" }, false, ["decrypt"]);
  const decrypted = await subtle.decrypt({ name: "AES-CBC", iv: encoder.encode(HONGMENG_IV) }, key, bytes);
  return decoder.decode(decrypted);
}

function parseTypeOneLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 15 || parts[0] !== "1") return null;
  const numbers = parts.slice(1, 14).map(Number);
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  return {
    color: String(parts[1]),
    x: numbers[1],
    y: numbers[2],
    z: numbers[3],
    matrix: {
      a: numbers[4],
      b: numbers[5],
      c: numbers[6],
      d: numbers[7],
      e: numbers[8],
      f: numbers[9],
      g: numbers[10],
      h: numbers[11],
      i: numbers[12]
    },
    part: parts.slice(14).join(" ")
  };
}

function expandLinearPiece(piece) {
  const length = LINEAR_PART_LENGTHS[normalizePartName(piece.part)];
  const start = -((length - 1) * LDRAW_UNIT) / 2;
  const { a, d, g } = piece.matrix;
  return Array.from({ length }, (_, index) => {
    const offset = start + index * LDRAW_UNIT;
    return {
      ldrawX: piece.x + a * offset,
      ldrawY: piece.y + d * offset,
      ldrawZ: piece.z + g * offset
    };
  });
}

function mapLDrawColor(color, unknownColors) {
  if (Object.prototype.hasOwnProperty.call(LDRAW_COLOR_TO_BRICKLAYER, color)) {
    return LDRAW_COLOR_TO_BRICKLAYER[color];
  }
  unknownColors.add(String(color));
  return FALLBACK_COLOR_CODE;
}

export function analyzeVerticalGrid(voxels) {
  const normalPositions = [];
  const specialPositions = [];
  voxels.forEach((voxel) => {
    const rawZ = -voxel.ldrawY / LDRAW_LAYER_HEIGHT;
    if (isNearInteger(rawZ)) {
      normalPositions.push({
        lineNumber: voxel.lineNumber,
        y: voxel.ldrawY,
        z: Math.round(rawZ)
      });
      return;
    }
    if (isNearHalfInteger(rawZ) && isHalfLayerVerticalOffsetAllowed(voxel)) {
      specialPositions.push({
        lineNumber: voxel.lineNumber,
        part: voxel.sourcePart,
        y: voxel.ldrawY,
        rawZ,
        resolvedZ: halfOffsetLayer(rawZ),
        matrix: matrixSignature(voxel.sourcePiece.matrix)
      });
    }
  });
  return { normalPositions, specialPositions };
}

export function resolveBrickLayerZ(voxel, verticalGrid = null) {
  const rawZ = -voxel.ldrawY / LDRAW_LAYER_HEIGHT;
  if (isNearInteger(rawZ)) return { z: Math.round(rawZ), phase: "normal" };
  if (isNearHalfInteger(rawZ) && isHalfLayerVerticalOffsetAllowed(voxel)) {
    const z = halfOffsetLayer(rawZ);
    const known = verticalGrid?.specialPositions?.some((position) => position.lineNumber === voxel.lineNumber && Math.abs(position.rawZ - rawZ) <= INTEGER_TOLERANCE);
    return { z, phase: "half", known };
  }
  throw new Error(`Posicion vertical LDraw incompatible en linea ${voxel.lineNumber}: Y=${voxel.ldrawY}.`);
}

function isHalfLayerVerticalOffsetAllowed(voxel) {
  if (!Object.prototype.hasOwnProperty.call(LINEAR_PART_LENGTHS, voxel.sourcePart)) return false;
  const matrix = voxel.sourcePiece?.matrix;
  if (!matrix) return false;
  return isNearInteger(matrix.d) && Math.round(matrix.d) === 0
    && isNearInteger(matrix.e) && Math.abs(Math.round(matrix.e)) === 1
    && isNearInteger(matrix.f) && Math.round(matrix.f) === 0;
}

function isNearInteger(value) {
  return Number.isFinite(value) && Math.abs(value - Math.round(value)) <= INTEGER_TOLERANCE;
}

function isNearHalfInteger(value) {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value - (Math.floor(value) + 0.5)) <= INTEGER_TOLERANCE;
}

function halfOffsetLayer(value) {
  return Math.floor(value + INTEGER_TOLERANCE);
}

function trackUnsupportedPiece(unsupportedPieces, partName, piece) {
  const current = unsupportedPieces.get(partName) || {
    part: partName,
    count: 0,
    colors: new Set(),
    matrices: new Map(),
    bounds: {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity
    },
    lines: []
  };
  current.count += 1;
  current.colors.add(String(piece.color));
  const matrixKey = matrixSignature(piece.matrix);
  current.matrices.set(matrixKey, (current.matrices.get(matrixKey) || 0) + 1);
  current.bounds.minX = Math.min(current.bounds.minX, piece.x);
  current.bounds.maxX = Math.max(current.bounds.maxX, piece.x);
  current.bounds.minY = Math.min(current.bounds.minY, piece.y);
  current.bounds.maxY = Math.max(current.bounds.maxY, piece.y);
  current.bounds.minZ = Math.min(current.bounds.minZ, piece.z);
  current.bounds.maxZ = Math.max(current.bounds.maxZ, piece.z);
  if (current.lines.length < 12) current.lines.push(piece.lineNumber);
  unsupportedPieces.set(partName, current);
}

function unsupportedPieceSummary(unsupportedPieces) {
  return [...unsupportedPieces.values()]
    .sort((a, b) => a.part.localeCompare(b.part))
    .map((piece) => ({
      part: piece.part,
      count: piece.count,
      colors: [...piece.colors].sort((a, b) => Number(a) - Number(b)),
      matrices: [...piece.matrices.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([matrix, count]) => ({ matrix, count })),
      bounds: finiteBounds(piece.bounds),
      sampleLines: piece.lines
    }));
}

function matrixSignature(matrix) {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f, matrix.g, matrix.h, matrix.i]
    .map((value) => Number.isInteger(value) ? String(value) : Number(value).toFixed(6).replace(/\.?0+$/, ""))
    .join(" ");
}

function finiteBounds(bounds) {
  return {
    x: [bounds.minX, bounds.maxX],
    y: [bounds.minY, bounds.maxY],
    z: [bounds.minZ, bounds.maxZ]
  };
}

function trackDetectedColor(detectedColors, ldrawColor, colorCode) {
  const id = String(ldrawColor);
  const current = detectedColors.get(id) || { id, colorCode, count: 0 };
  current.count += 1;
  detectedColors.set(id, current);
}

function colorSummary(detectedColors) {
  return [...detectedColors.values()]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((entry) => ({
      ...entry,
      name: COLOR_NAMES[entry.colorCode] || entry.colorCode,
      physical: LDRAW_COLOR_MAP[entry.id]?.physical || "No mapeado"
    }));
}

function validateColorMap() {
  Object.entries(LDRAW_COLOR_MAP).forEach(([id, info]) => {
    if (!BRICKLAYER_COLOR_CODES.has(info.bricklayer)) {
      throw new Error(`Color LDraw ${id} apunta a un color BrickLayer inexistente: ${info.bricklayer}.`);
    }
  });
  if (!BRICKLAYER_COLOR_CODES.has(FALLBACK_COLOR_CODE)) {
    throw new Error(`Fallback de color BrickLayer inexistente: ${FALLBACK_COLOR_CODE}.`);
  }
}

function normalizePartName(part) {
  return String(part || "").trim().replace(/\\/g, "/").split("/").pop().toLowerCase();
}

function toGridInteger(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} no es una coordenada valida.`);
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) > INTEGER_TOLERANCE) {
    throw new Error(`${label} no cae en la reticula BrickLayer: ${value}.`);
  }
  return rounded;
}

function boundsFor(voxels) {
  return voxels.reduce((bounds, voxel) => ({
    minX: Math.min(bounds.minX, voxel.sourceX),
    maxX: Math.max(bounds.maxX, voxel.sourceX),
    minY: Math.min(bounds.minY, voxel.sourceY),
    maxY: Math.max(bounds.maxY, voxel.sourceY),
    minZ: Math.min(bounds.minZ, voxel.sourceZ),
    maxZ: Math.max(bounds.maxZ, voxel.sourceZ)
  }), {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity
  });
}

function validateDimensions(dimensions) {
  if (!Number.isInteger(dimensions.x) || !Number.isInteger(dimensions.y) || !Number.isInteger(dimensions.z)) {
    throw new Error("Las dimensiones importadas no son enteras.");
  }
  if (dimensions.x < 1 || dimensions.y < 1 || dimensions.z < 1) {
    throw new Error("Las dimensiones importadas no son validas.");
  }
  if (dimensions.x > 256 || dimensions.y > 256 || dimensions.z > 512) {
    throw new Error(`El modelo importado es demasiado grande: ${dimensions.x} x ${dimensions.y} x ${dimensions.z}.`);
  }
}

function validateVoxel(voxel, dimensions) {
  for (const axis of ["x", "y", "z"]) {
    if (!Number.isInteger(voxel[axis]) || !Number.isFinite(voxel[axis])) {
      throw new Error(`Coordenada ${axis.toUpperCase()} invalida en linea ${voxel.lineNumber}.`);
    }
  }
  if (voxel.x < 0 || voxel.x >= dimensions.x || voxel.y < 0 || voxel.y >= dimensions.y || voxel.z < 0 || voxel.z >= dimensions.z) {
    throw new Error(`Voxel fuera de rango en linea ${voxel.lineNumber}.`);
  }
}

function createMatrix(x, y) {
  return Array.from({ length: y }, () => ".".repeat(x));
}

function normalizeTextInput(content) {
  const text = content instanceof ArrayBuffer || ArrayBuffer.isView(content)
    ? new TextDecoder("utf-8", { fatal: false }).decode(content)
    : String(content || "");
  return text.replace(/^\uFEFF/, "");
}

function base64ToBytes(base64) {
  if (typeof atob === "function") {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }
  throw new Error("No hay decodificador Base64 disponible.");
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}
