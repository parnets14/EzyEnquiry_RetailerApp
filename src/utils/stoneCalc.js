// src/utils/stoneCalc.js  (Retailer app)
//
// Stone measurement — unit conversion + area calculation.
// Mirrors the wholesaler app's utils/stoneCalc.js and the CRM frontend
// (config/stoneUnits.js) so all three agree on the maths.
//
// Real-world formula (matches the reference app):
//   1. Convert Length to the OUTPUT unit.
//   2. Convert Width  to the OUTPUT unit.
//   3. Area = Length(out) × Width(out).
//
// Example (Inch input → Feet output):
//   L = 122 in = 122 / 12 = 10.16667 ft
//   W =  38 in =  38 / 12 =  3.16667 ft
//   Area = 10.16667 × 3.16667 = 32.1944 ft²   ✅

// ── Length units → metres (base) ─────────────────────────────
export const UNIT_TO_METRE = {
  inch:       0.0254,
  feet:       0.3048,
  meter:      1,
  centimeter: 0.01,
  millimeter: 0.001,
};

// UI-facing list (order matches the reference app dropdown)
export const UNITS = [
  { key: 'inch',       label: 'Inch' },
  { key: 'feet',       label: 'Feet' },
  { key: 'meter',      label: 'Meter' },
  { key: 'centimeter', label: 'Centimeter' },
  { key: 'millimeter', label: 'Millimeter' },
];

// Short symbol for the area unit, e.g. "ft²"
export const AREA_SYMBOL = {
  inch:       'in²',
  feet:       'ft²',
  meter:      'm²',
  centimeter: 'cm²',
  millimeter: 'mm²',
};

export const unitLabel = (key) => UNITS.find(u => u.key === key)?.label || key;

/** Convert a single length value from `fromUnit` to `toUnit`. */
export function convertLength(value, fromUnit, toUnit) {
  const v = parseFloat(value);
  if (!isFinite(v)) return 0;
  const metres = v * (UNIT_TO_METRE[fromUnit] ?? 1);
  return metres / (UNIT_TO_METRE[toUnit] ?? 1);
}

/**
 * Area of one row: convert L & W to output unit, then multiply.
 * Returns 0 when the row is incomplete.
 */
export function rowArea(length, width, inputUnit, outputUnit) {
  const l = parseFloat(length);
  const w = parseFloat(width);
  if (!isFinite(l) || !isFinite(w) || l <= 0 || w <= 0) return 0;
  const lOut = convertLength(l, inputUnit, outputUnit);
  const wOut = convertLength(w, inputUnit, outputUnit);
  return lOut * wOut;
}

/** Sum of areas across all rows. */
export function sumArea(rows, inputUnit, outputUnit) {
  return rows.reduce(
    (acc, r) => acc + rowArea(r.length, r.width, inputUnit, outputUnit),
    0,
  );
}

/** Round to a fixed number of decimals, returning a Number. */
export const round = (v, d = 4) => {
  const f = 10 ** d;
  return Math.round((Number(v) + Number.EPSILON) * f) / f;
};

/** Format an area value for display (4 decimals, like the reference app). */
export const fmtArea = (v, d = 4) => round(v, d).toFixed(d);

// ── Products (Ionicons + the retailer palette) ───────────────
// The wholesaler uses MaterialCommunityIcons; every name below was validated
// against node_modules/react-native-vector-icons/dist/glyphmaps/Ionicons.json
// (`view-grid-outline` does NOT exist in Ionicons — `apps-outline` replaces it).
export const STONE_PRODUCTS = [
  { key: 'granite', label: 'Granite', icon: 'diamond-outline', color: '#F4500A', bg: '#FFF3EE' },
  { key: 'marble',  label: 'Marble',  icon: 'layers-outline',  color: '#1A2340', bg: '#EEF0F5' },
  { key: 'block',   label: 'Block',   icon: 'cube-outline',    color: '#F4500A', bg: '#FFF3EE' },
  { key: 'italian', label: 'Italian', icon: 'apps-outline',    color: '#1A2340', bg: '#EEF0F5' },
];

export const productMeta = (key) =>
  STONE_PRODUCTS.find(p => p.key === key) || STONE_PRODUCTS[0];
