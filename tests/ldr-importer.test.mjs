import assert from "node:assert/strict";
import { createCipheriv } from "node:crypto";
import {
  BRICKLAYER_COLORS
} from "../palette.js";
import {
  FALLBACK_COLOR_CODE,
  HONGMENG_IV,
  HONGMENG_KEY,
  LDRAW_COLOR_MAP,
  LDRAW_COLOR_TO_BRICKLAYER,
  UnsupportedLDrawPiecesError,
  analyzeVerticalGrid,
  decodeLdrContent,
  decryptHongmengLdr,
  importLdrContent,
  looksLikeLDrawText,
  parseLDraw,
  projectNameFromLdrFilename,
  resolveBrickLayerZ
} from "../ldr-importer.js";

const identity = "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat";

function encryptHongmeng(text) {
  const cipher = createCipheriv("aes-128-cbc", Buffer.from(HONGMENG_KEY, "ascii"), Buffer.from(HONGMENG_IV, "ascii"));
  return Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("base64");
}

function occupied(project) {
  const voxels = [];
  project.layers.forEach((layer) => {
    layer.matrix.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] !== ".") voxels.push({ x, y, z: layer.z, color: row[x] });
      }
    });
  });
  return voxels.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x || a.color.localeCompare(b.color));
}

assert.equal(looksLikeLDrawText(`0 STEP\n${identity}`), true);
assert.equal(looksLikeLDrawText("not ldraw"), false);
assert.equal(projectNameFromLdrFilename("8170.ldr"), "8170");
assert.equal(projectNameFromLdrFilename("YC270.LDR"), "YC270");
assert.equal(projectNameFromLdrFilename("C:\\modelos\\ABC123.ldr"), "ABC123");
assert.deepEqual(
  Object.keys(LDRAW_COLOR_TO_BRICKLAYER).map(Number).sort((a, b) => a - b),
  [0, 1, 4, 6, 7, 10, 13, 14, 15, 18, 25, 77, 78, 234, 272, 322, 484]
);
const bricklayerColorCodes = new Set(BRICKLAYER_COLORS.map((color) => color.code));
Object.values(LDRAW_COLOR_MAP).forEach((info) => {
  assert.equal(bricklayerColorCodes.has(info.bricklayer), true);
});
assert.deepEqual(LDRAW_COLOR_TO_BRICKLAYER, {
  0: "N",
  1: "U",
  4: "R",
  6: "M",
  7: "G",
  10: "V",
  13: "S",
  14: "A",
  15: "B",
  18: "A",
  25: "O",
  77: "S",
  78: "P",
  234: "A",
  272: "U",
  322: "C",
  484: "M"
});
assert.equal(bricklayerColorCodes.has(FALLBACK_COLOR_CODE), true);

const encrypted = encryptHongmeng(`0 STEP\n${identity}\n`);
assert.equal(looksLikeLDrawText(encrypted), false);
assert.match(await decryptHongmengLdr(encrypted), /lg-cl1a1n\.dat/);
const decoded = await decodeLdrContent(encrypted);
assert.equal(decoded.sourceType, "hongmeng");
assert.match(decoded.text, /0 STEP/);

const parsed = parseLDraw(`0 Name: sample\n${identity}\n0 STEP\n1 4 20 -16 40 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat`);
assert.equal(parsed.errors.length, 0);
assert.equal(parsed.pieces.length, 2);
assert.equal(parsed.steps.length, 2);
assert.deepEqual(parsed.steps.map((step) => step.pieceIndexes), [[0], [1]]);
assert.deepEqual(parsed.pieces[0].matrix, { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0, g: 0, h: 0, i: 1 });

const oneByOne = await importLdrContent(identity, { name: "1x1" });
assert.equal(oneByOne.sourceType, "ldraw");
assert.equal(oneByOne.project.name, "1x1");
assert.deepEqual(oneByOne.stats.dimensions, { x: 1, y: 1, z: 1 });
assert.deepEqual(occupied(oneByOne.project), [{ x: 0, y: 0, z: 0, color: "A" }]);

const oneByTwo = await importLdrContent("1 14 10 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a2n.dat");
assert.deepEqual(oneByTwo.stats.dimensions, { x: 2, y: 1, z: 1 });
assert.deepEqual(occupied(oneByTwo.project), [
  { x: 0, y: 0, z: 0, color: "A" },
  { x: 1, y: 0, z: 0, color: "A" }
]);

const rotatedOneByTwo = await importLdrContent("1 14 0 0 10 0 0 1 0 1 0 1 0 0 lg-cl1a2n.dat");
assert.deepEqual(rotatedOneByTwo.stats.dimensions, { x: 1, y: 2, z: 1 });
assert.deepEqual(occupied(rotatedOneByTwo.project), [
  { x: 0, y: 0, z: 0, color: "A" },
  { x: 0, y: 1, z: 0, color: "A" }
]);

const oneByThree = await importLdrContent("1 14 20 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a3n.dat", { name: projectNameFromLdrFilename("7333.ldr") });
assert.equal(oneByThree.project.name, "7333");
assert.deepEqual(oneByThree.stats.pieceCounts, { "lg-cl1a3n.dat": 1 });
assert.equal(oneByThree.stats.voxels, 3);
assert.deepEqual(oneByThree.stats.dimensions, { x: 3, y: 1, z: 1 });
assert.deepEqual(occupied(oneByThree.project), [
  { x: 0, y: 0, z: 0, color: "A" },
  { x: 1, y: 0, z: 0, color: "A" },
  { x: 2, y: 0, z: 0, color: "A" }
]);

const rotatedOneByThree = await importLdrContent("1 14 0 0 20 0 0 1 0 1 0 1 0 0 lg-cl1a3n.dat");
assert.equal(rotatedOneByThree.stats.voxels, 3);
assert.deepEqual(rotatedOneByThree.stats.dimensions, { x: 1, y: 3, z: 1 });
assert.deepEqual(occupied(rotatedOneByThree.project), [
  { x: 0, y: 0, z: 0, color: "A" },
  { x: 0, y: 1, z: 0, color: "A" },
  { x: 0, y: 2, z: 0, color: "A" }
]);

const mixedLinearPieces = await importLdrContent([
  "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 14 30 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a2n.dat",
  "1 14 80 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a3n.dat"
].join("\n"));
assert.equal(mixedLinearPieces.stats.physicalPieces, 3);
assert.equal(mixedLinearPieces.stats.voxels, 6);
assert.deepEqual(mixedLinearPieces.stats.pieceCounts, {
  "lg-cl1a1n.dat": 1,
  "lg-cl1a2n.dat": 1,
  "lg-cl1a3n.dat": 1
});

const normalized = await importLdrContent([
  "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 4 40 -16 40 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat"
].join("\n"));
assert.deepEqual(normalized.stats.dimensions, { x: 3, y: 3, z: 2 });
assert.deepEqual(occupied(normalized.project), [
  { x: 0, y: 2, z: 0, color: "A" },
  { x: 2, y: 0, z: 1, color: "R" }
]);

const asymmetricX = await importLdrContent([
  "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 4 20 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 1 40 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat"
].join("\n"));
assert.deepEqual(asymmetricX.stats.dimensions, { x: 3, y: 1, z: 1 });
assert.deepEqual(occupied(asymmetricX.project), [
  { x: 0, y: 0, z: 0, color: "A" },
  { x: 1, y: 0, z: 0, color: "R" },
  { x: 2, y: 0, z: 0, color: "U" }
]);

const frontBack = await importLdrContent([
  "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 1 0 0 40 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat"
].join("\n"));
assert.deepEqual(occupied(frontBack.project), [
  { x: 0, y: 0, z: 0, color: "U" },
  { x: 0, y: 2, z: 0, color: "A" }
]);

const colorGeometryA = await importLdrContent([
  "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 78 20 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 484 40 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat"
].join("\n"));
const colorGeometryB = await importLdrContent([
  "1 0 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 1 20 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 4 40 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat"
].join("\n"));
assert.deepEqual(colorGeometryA.stats.dimensions, colorGeometryB.stats.dimensions);
assert.deepEqual(
  occupied(colorGeometryA.project).map(({ color, ...position }) => position),
  occupied(colorGeometryB.project).map(({ color, ...position }) => position)
);
assert.deepEqual(colorGeometryA.stats.colors.map((color) => `${color.id}:${color.colorCode}`), ["14:A", "78:P", "484:M"]);

const newColors = await importLdrContent([
  "1 10 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 18 20 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
  "1 234 40 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat"
].join("\n"));
assert.deepEqual(newColors.stats.colors.map((color) => `${color.id}:${color.physical}:${color.colorCode}:${color.name}`), [
  "10:Bright Green:V:Verde",
  "18:Light Yellow:A:Amarillo",
  "234:Trans Fire Yellow:A:Amarillo"
]);
assert.deepEqual(occupied(newColors.project), [
  { x: 0, y: 0, z: 0, color: "V" },
  { x: 1, y: 0, z: 0, color: "A" },
  { x: 2, y: 0, z: 0, color: "A" }
]);

const halfOffsetPlus = await importLdrContent("1 4 0 -8 0 0 0 -1 0 1 0 1 0 0 lg-cl1a1n.dat");
assert.equal(halfOffsetPlus.stats.vertical.specialPositions.length, 1);
assert.equal(halfOffsetPlus.stats.vertical.specialPositions[0].resolvedZ, 0);
assert.deepEqual(occupied(halfOffsetPlus.project), [{ x: 0, y: 0, z: 0, color: "R" }]);

const halfOffsetMinus = await importLdrContent("1 4 0 8 0 0 0 -1 0 1 0 1 0 0 lg-cl1a1n.dat");
assert.equal(halfOffsetMinus.stats.vertical.specialPositions.length, 1);
assert.equal(halfOffsetMinus.stats.vertical.specialPositions[0].resolvedZ, -1);
assert.deepEqual(occupied(halfOffsetMinus.project), [{ x: 0, y: 0, z: 0, color: "R" }]);

const realHalfOffsetLines = await importLdrContent([
  "1 4 320 -1032 -100 0 0 -1 0 1 0 1 0 0 lg-cl1a1n.dat",
  "1 4 160 -1032 -100 0 0 -1 0 1 0 1 0 0 lg-cl1a1n.dat"
].join("\n"));
assert.equal(realHalfOffsetLines.stats.vertical.specialPositions.length, 2);
assert.deepEqual(realHalfOffsetLines.stats.vertical.specialPositions.map((position) => position.resolvedZ), [64, 64]);
assert.deepEqual(realHalfOffsetLines.stats.dimensions, { x: 9, y: 1, z: 1 });
assert.deepEqual(occupied(realHalfOffsetLines.project), [
  { x: 0, y: 0, z: 0, color: "R" },
  { x: 8, y: 0, z: 0, color: "R" }
]);

const parsedHalfOffset = parseLDraw("1 4 0 -1032 0 0 0 -1 0 1 0 1 0 0 lg-cl1a1n.dat");
const halfVoxel = {
  ldrawY: parsedHalfOffset.pieces[0].y,
  lineNumber: parsedHalfOffset.pieces[0].lineNumber,
  sourcePart: "lg-cl1a1n.dat",
  sourcePiece: parsedHalfOffset.pieces[0]
};
const verticalGrid = analyzeVerticalGrid([halfVoxel]);
assert.equal(verticalGrid.specialPositions.length, 1);
assert.deepEqual(resolveBrickLayerZ(halfVoxel, verticalGrid), { z: 64, phase: "half", known: true });

await assert.rejects(
  () => importLdrContent("1 4 0 -1030 0 0 0 -1 0 1 0 1 0 0 lg-cl1a1n.dat"),
  /Posicion vertical LDraw incompatible/
);

await assert.rejects(
  () => importLdrContent("1 4 0 -8 0 1 0 0 0 0 1 0 1 0 lg-cl1a1n.dat"),
  /Posicion vertical LDraw incompatible/
);

await assert.rejects(
  () => importLdrContent([
    "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat",
    "1 14 10 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a2n.dat"
  ].join("\n")),
  /Colision de voxels/
);

await assert.rejects(
  () => importLdrContent("1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-unknown.dat"),
  /piezas todavia no compatibles: lg-unknown\.dat \(1\)/
);

const unknownPiecesSource = [
  "1 14 0 0 0 1 0 0 0 1 0 0 0 1 lg-alpha.dat",
  "1 4 20 0 0 0 0 1 0 1 0 1 0 0 lg-alpha.dat",
  "1 78 40 -16 20 1 0 0 0 1 0 0 0 1 subdir/lg-beta.dat"
].join("\n");
await assert.rejects(
  () => importLdrContent(unknownPiecesSource),
  (error) => {
    assert.equal(error instanceof UnsupportedLDrawPiecesError, true);
    assert.deepEqual(error.unsupportedPieces.map((piece) => `${piece.part}:${piece.count}`), ["lg-alpha.dat:2", "lg-beta.dat:1"]);
    assert.deepEqual(error.unsupportedPieces[0].colors, ["4", "14"]);
    assert.equal(error.unsupportedPieces[0].matrices.length, 2);
    assert.deepEqual(error.unsupportedPieces[0].bounds, { x: [0, 20], y: [0, 0], z: [0, 0] });
    assert.deepEqual(error.unsupportedPieces[1].colors, ["78"]);
    assert.deepEqual(error.unsupportedPieces[1].bounds, { x: [40, 40], y: [-16, -16], z: [20, 20] });
    return true;
  }
);

const existingProject = {
  name: "Proyecto anterior",
  size: { x: 2, y: 2 },
  layers: [{ z: 0, matrix: ["A.", ".R"] }]
};
const beforeExistingProject = JSON.stringify(existingProject);
let activeProject = existingProject;
try {
  const imported = await importLdrContent(unknownPiecesSource, { name: projectNameFromLdrFilename("YC243.ldr") });
  activeProject = imported.project;
} catch {
  // Importacion rechazada: no se reemplaza el proyecto activo.
}
assert.equal(activeProject, existingProject);
assert.equal(JSON.stringify(existingProject), beforeExistingProject);

const unknownColor = await importLdrContent("1 999 0 0 0 1 0 0 0 1 0 0 0 1 lg-cl1a1n.dat");
assert.deepEqual(unknownColor.stats.unknownColors, ["999"]);
assert.deepEqual(unknownColor.warnings, ["Color LDraw 999 no mapeado; se uso G."]);
assert.deepEqual(occupied(unknownColor.project), [{ x: 0, y: 0, z: 0, color: "G" }]);
assert.deepEqual(unknownColor.stats.colors, [{ id: "999", colorCode: "G", count: 1, name: "Gris", physical: "No mapeado" }]);

console.log("ldr importer tests OK");
