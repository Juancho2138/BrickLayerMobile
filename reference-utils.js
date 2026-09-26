export const REFERENCE_TYPES = {
  NORMAL: "NORMAL",
  TEMPORAL_NEXT_LAYER: "TEMPORAL_NEXT_LAYER",
  BACKWARD: "BACKWARD"
};

export function normalizeReferenceType(type) {
  return Object.values(REFERENCE_TYPES).includes(type) ? type : REFERENCE_TYPES.NORMAL;
}

export function isReferenceVisibleAtZ(reference, z) {
  const type = normalizeReferenceType(reference.type);
  const sourceZ = Number.isInteger(reference.source_z) ? reference.source_z : reference.start_z;
  const startZ = Number.isInteger(reference.start_z) ? reference.start_z : sourceZ;
  const endZ = Number.isInteger(reference.end_z) ? reference.end_z : null;

  if (type === REFERENCE_TYPES.TEMPORAL_NEXT_LAYER) {
    return z === sourceZ + 1;
  }

  if (type === REFERENCE_TYPES.BACKWARD) {
    const lowerBound = endZ === null ? -Infinity : endZ;
    return z <= sourceZ && z >= lowerBound;
  }

  return startZ <= z && (endZ === null || z <= endZ);
}

export function referenceTypeLabel(type) {
  const normalized = normalizeReferenceType(type);
  if (normalized === REFERENCE_TYPES.TEMPORAL_NEXT_LAYER) return "Ref. 1 capa";
  if (normalized === REFERENCE_TYPES.BACKWARD) return "Ref. hacia atras";
  return "Ref. normal";
}
