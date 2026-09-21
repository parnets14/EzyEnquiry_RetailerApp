/**
 * productFieldSchema.js  (React Native port)
 *
 * Category-driven field schema for the Add / Edit Product form.
 * Mirrors the admin panel's EzyEnquiryCrm-frontend/src/config/productFieldSchema.js
 * so the retailer app shows the same contextual fields.
 *
 * Field shape:
 *   key        — unique key; also the Product model column when storeIn==='column'
 *   label      — UI label
 *   type       — 'text' | 'number' | 'select'
 *   options    — string[] for selects
 *   unit       — suffix, e.g. 'mm', 'ft', 'kg'
 *   required   — boolean
 *   storeIn    — 'column' (existing Product field) | 'attributes' (Product.attributes JSON)
 *   placeholder
 */

// ── Shared option lists ───────────────────────────────────────
const TILE_SIZES = [
  '300x300', '300x450', '300x600', '400x400', '450x900',
  '600x600', '600x1200', '800x800', '800x1600',
  '1000x1000', '1200x1200', '1200x2400',
];
const TILE_FINISHES  = ['Glossy', 'Matt', 'Satin', 'Polished', 'Rustic', 'Textured', 'Sugar', 'Carving', 'Natural'];
const TILE_TYPES     = ['Floor Tile', 'Wall Tile', 'Floor & Wall', 'Outdoor', 'Pool Tile', 'Parking', 'Elevation', 'Mosaic'];
const APPLICATIONS   = ['Living Room', 'Bedroom', 'Bathroom', 'Kitchen', 'Outdoor', 'Commercial', 'Parking', 'Swimming Pool'];
const ANTI_SKID      = ['R9', 'R10', 'R11', 'R12', 'R13', 'Non Slip', 'Normal'];
const WATER_ABS      = ['BIa (≤0.5% Vitrified)', 'BIb (0.5–3%)', 'BIIa (3–6%)', 'BIIb (6–10%)'];
const PEI_RATING     = ['PEI I', 'PEI II', 'PEI III', 'PEI IV', 'PEI V'];
const STONE_FINISHES = ['Polished', 'Honed', 'Leather', 'Flamed', 'Brushed', 'Lapotra', 'River Wash'];
const STONE_GRADE    = ['Grade 1 (Commercial)', 'Grade 2 (Standard)', 'Grade 3 (Premium)', 'Grade 4 (Exotic)'];
const STONE_THICK    = ['16mm', '18mm', '20mm (2cm)', '25mm', '30mm (3cm)', 'Custom'];
const ORIGINS        = ['India', 'Italy', 'Spain', 'China', 'Portugal', 'Brazil', 'Turkey', 'UAE'];
const BLOCK_TYPES    = ['AAC Block', 'Concrete Block', 'Fly Ash Brick', 'Solid Block', 'Hollow Block', 'Paver Block'];
const BLOCK_GRADE    = ['AAC-2', 'AAC-3', 'AAC-4', 'AAC-6', 'Grade A', 'Grade B'];
const SANITARY_TYPE  = ['Wash Basin', 'Water Closet (WC)', 'One Piece Closet', 'Urinal', 'Cistern', 'Pedestal', 'Squatting Pan', 'Bidet'];
const SANITARY_MOUNT = ['Wall Hung', 'Floor Mounted', 'One Piece', 'Counter Top', 'Under Counter', 'Table Top'];
const FLUSH_TYPES    = ['Single Flush', 'Dual Flush', 'Rimless', 'Concealed', 'External Cistern'];

// ── Per-category field definitions ────────────────────────────
export const PRODUCT_FIELD_SCHEMA = {
  tiles: [
    { key: 'size',             label: 'Size (mm)',            type: 'select', options: TILE_SIZES,    required: true,  storeIn: 'column' },
    { key: 'tile_type',        label: 'Tile Type',            type: 'select', options: TILE_TYPES,    required: true,  storeIn: 'column' },
    { key: 'finish',           label: 'Finish',               type: 'select', options: TILE_FINISHES, required: true,  storeIn: 'column' },
    { key: 'thickness',        label: 'Thickness',            type: 'text',   unit: 'mm',             required: true,  storeIn: 'column', placeholder: 'e.g. 8.5' },
    { key: 'water_absorption', label: 'Water Absorption',     type: 'select', options: WATER_ABS,     required: false, storeIn: 'attributes' },
    { key: 'pei_rating',       label: 'PEI Abrasion Rating',  type: 'select', options: PEI_RATING,    required: false, storeIn: 'attributes' },
    { key: 'anti_skid',        label: 'Anti-Skid Rating',     type: 'select', options: ANTI_SKID,     required: false, storeIn: 'column' },
    { key: 'application',      label: 'Application Area',     type: 'select', options: APPLICATIONS,  required: false, storeIn: 'column' },
    { key: 'surface',          label: 'Surface',              type: 'text',                           required: false, storeIn: 'column' },
    { key: 'color',            label: 'Colour',               type: 'text',                           required: false, storeIn: 'column' },
    { key: 'design',           label: 'Design / Series',      type: 'text',                           required: false, storeIn: 'column' },
    { key: 'pcs_per_box',      label: 'Pieces / Box',         type: 'number',                         required: false, storeIn: 'column' },
    { key: 'sqft_per_box',     label: 'Sq.Ft / Box',          type: 'number', unit: 'sqft',           required: false, storeIn: 'column' },
    { key: 'weight_per_box',   label: 'Weight / Box',         type: 'number', unit: 'kg',             required: false, storeIn: 'column' },
  ],

  granite: [
    { key: 'color',          label: 'Colour',        type: 'text',   required: true,  storeIn: 'column',     placeholder: 'e.g. Black Galaxy' },
    { key: 'finish',         label: 'Finish',        type: 'select', options: STONE_FINISHES, required: true, storeIn: 'column' },
    { key: 'thickness',      label: 'Thickness',     type: 'select', options: STONE_THICK, required: true,    storeIn: 'column' },
    { key: 'slab_length_ft', label: 'Slab Length',   type: 'number', unit: 'ft',      required: true,  storeIn: 'attributes' },
    { key: 'slab_width_ft',  label: 'Slab Width',    type: 'number', unit: 'ft',      required: true,  storeIn: 'attributes' },
    { key: 'grade',          label: 'Grade',         type: 'select', options: STONE_GRADE, required: false, storeIn: 'column' },
    { key: 'origin',         label: 'Origin',        type: 'select', options: ORIGINS, required: false, storeIn: 'column' },
    { key: 'vein_pattern',   label: 'Vein / Pattern',type: 'text',   required: false, storeIn: 'attributes' },
    { key: 'weight_per_box', label: 'Weight / Slab', type: 'number', unit: 'kg',      required: false, storeIn: 'column' },
  ],

  marble: [
    { key: 'color',          label: 'Colour',        type: 'text',   required: true,  storeIn: 'column',     placeholder: 'e.g. Makrana White' },
    { key: 'finish',         label: 'Finish',        type: 'select', options: STONE_FINISHES, required: true, storeIn: 'column' },
    { key: 'thickness',      label: 'Thickness',     type: 'select', options: STONE_THICK, required: true,    storeIn: 'column' },
    { key: 'slab_length_ft', label: 'Slab Length',   type: 'number', unit: 'ft',      required: true,  storeIn: 'attributes' },
    { key: 'slab_width_ft',  label: 'Slab Width',    type: 'number', unit: 'ft',      required: true,  storeIn: 'attributes' },
    { key: 'grade',          label: 'Grade',         type: 'select', options: STONE_GRADE, required: false, storeIn: 'column' },
    { key: 'origin',         label: 'Origin',        type: 'select', options: ORIGINS, required: false, storeIn: 'column' },
    { key: 'vein_pattern',   label: 'Vein / Pattern',type: 'text',   required: false, storeIn: 'attributes' },
  ],

  blocks: [
    { key: 'block_type',         label: 'Block Type',     type: 'select', options: BLOCK_TYPES, required: true,  storeIn: 'attributes' },
    { key: 'block_length_mm',    label: 'Length',         type: 'number', unit: 'mm',           required: true,  storeIn: 'attributes' },
    { key: 'block_height_mm',    label: 'Height',         type: 'number', unit: 'mm',           required: true,  storeIn: 'attributes' },
    { key: 'block_thickness_mm', label: 'Thickness/Width',type: 'number', unit: 'mm',           required: true,  storeIn: 'attributes' },
    { key: 'grade',              label: 'Grade/Strength', type: 'select', options: BLOCK_GRADE, required: false, storeIn: 'column' },
    { key: 'compressive_strength',label: 'Compressive Strength', type: 'number', unit: 'N/mm²', required: false, storeIn: 'attributes' },
    { key: 'density',            label: 'Density',        type: 'number', unit: 'kg/m³',        required: false, storeIn: 'attributes' },
    { key: 'pcs_per_cubic_m',    label: 'Pieces / m³',    type: 'number',                       required: false, storeIn: 'attributes' },
  ],

  sanitaryware: [
    { key: 'product_kind', label: 'Product Type',     type: 'select', options: SANITARY_TYPE,  required: true,  storeIn: 'attributes' },
    { key: 'mounting',     label: 'Mounting',         type: 'select', options: SANITARY_MOUNT, required: true,  storeIn: 'attributes' },
    { key: 'color',        label: 'Colour',           type: 'text',   required: true,  storeIn: 'column', placeholder: 'e.g. White / Ivory' },
    { key: 'dimensions',   label: 'Dimensions (W×D×H)', type: 'text', unit: 'mm',      required: true,  storeIn: 'attributes', placeholder: 'e.g. 660x380x710' },
    { key: 'flush_type',   label: 'Flush Type',       type: 'select', options: FLUSH_TYPES, required: false, storeIn: 'attributes' },
    { key: 'design',       label: 'Model / Design',   type: 'text',   required: false, storeIn: 'column' },
  ],

  other: [
    { key: 'size',      label: 'Size',      type: 'text', required: true,  storeIn: 'column' },
    { key: 'finish',    label: 'Finish',    type: 'text', required: false, storeIn: 'column' },
    { key: 'color',     label: 'Colour',    type: 'text', required: false, storeIn: 'column' },
    { key: 'material',  label: 'Material',  type: 'text', required: false, storeIn: 'column' },
    { key: 'thickness', label: 'Thickness', type: 'text', unit: 'mm',      required: false, storeIn: 'column' },
  ],
};

/** Default unit per category type. */
export const CATEGORY_DEFAULT_UNIT = {
  tiles:        'Box',
  granite:      'Sq Ft',
  marble:       'Sq Ft',
  blocks:       'Nos',
  sanitaryware: 'Piece',
  other:        'Nos',
};

/**
 * Infer category type from category / sub-category name text.
 * Falls back to 'other'.
 */
export function matchCategoryType(...names) {
  const text = names.filter(Boolean).join(' ').toLowerCase();
  if (!text) return 'other';
  if (/\b(granite)\b/.test(text))                                                     return 'granite';
  if (/\b(marble|onyx|travertine|quartz|stone)\b/.test(text))                         return 'marble';
  if (/\b(aac|block|brick|paver)\b/.test(text))                                       return 'blocks';
  if (/\b(sanitary|basin|closet|wc|urinal|cistern|toilet|bidet|pedestal)\b/.test(text)) return 'sanitaryware';
  if (/\b(tile|tiles|vitrified|ceramic|porcelain|mosaic|gvt|pgvt)\b/.test(text))      return 'tiles';
  return 'other';
}

/** Field list for a type (never undefined). */
export function fieldsForType(type) {
  return PRODUCT_FIELD_SCHEMA[type] || PRODUCT_FIELD_SCHEMA.other;
}

/** Human label for a type. */
export function labelForType(type) {
  const map = {
    tiles: 'Tiles', granite: 'Granite', marble: 'Marble / Stone',
    blocks: 'Blocks / Bricks', sanitaryware: 'Sanitaryware', other: 'General',
  };
  return map[type] || 'General';
}

/** Auto-calculate sqft/box from tile size string + pcs per box. */
export function calcSqftPerBox(size, pcsPerBox) {
  if (!size) return '';
  const m = String(size).toLowerCase().match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/);
  const pcs = parseFloat(pcsPerBox);
  if (!m || !pcs || pcs <= 0) return '';
  const w = parseFloat(m[1]), h = parseFloat(m[2]);
  if (!w || !h) return '';
  return ((w / 304.8) * (h / 304.8) * pcs).toFixed(2);
}
