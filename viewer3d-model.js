export const BRICK_PHYSICAL_SIZE = Object.freeze({
  width: 7,
  depth: 7,
  height: 5
});

export const BRICK_RENDER_SCALE = Object.freeze({
  stepX: 1,
  stepY: 1,
  stepZ: BRICK_PHYSICAL_SIZE.height / BRICK_PHYSICAL_SIZE.width,
  bodyWidth: 0.972,
  bodyDepth: 0.972,
  bodyHeight: 0.7,
  studRadius: 0.3,
  studHeight: 0.155,
  bottomSocketRadius: 0.33,
  bottomSocketHeight: 0.05
});

export const VIEWER3D_BACKGROUND_PRESETS = Object.freeze({
  dark: "#080b10",
  black: "#000000",
  gray: "#3a3f48",
  light: "#f4f1ea"
});

export function normalizeViewer3dBackground(mode, customColor) {
  if (mode === "custom") return normalizeHexColor(customColor, VIEWER3D_BACKGROUND_PRESETS.dark);
  return VIEWER3D_BACKGROUND_PRESETS[mode] || VIEWER3D_BACKGROUND_PRESETS.dark;
}

function normalizeHexColor(value, fallback) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value || ""));
  return match ? `#${match[1].toLowerCase()}` : fallback;
}
