// src/utils/categoryFields.js
//
// Category-driven product field schema for the Retailer app.
// Mirrors the wholesaler app's category fields so Add-Product forms
// are consistent across both apps.
//
// Field def:
//   { key, label, type, options?, unit?, required?, placeholder?, half? }
//   type: 'text' | 'number' | 'select'
//   half: true  → render two fields side-by-side

// ── Common option lists ──────────────────────────────────────
const FINISH = ['Polished', 'Honed', 'Matt', 'Glossy', 'Leather', 'Flamed', 'Brushed', 'Lappato', 'Satin'];
const GRADE  = ['Premium', 'A Grade', 'B Grade', 'Commercial', 'Standard'];
export const UNIT_OPTIONS = ['Sq Ft', 'Sq M', 'Piece', 'Box', 'Slab', 'Set', 'Number'];

// ── Per-type field schemas ───────────────────────────────────
export const CATEGORY_FIELDS = {
  granite: [
    { key: 'variety',      label: 'Granite Name / Variety', type: 'text',   required: true, placeholder: 'e.g. Black Galaxy' },
    { key: 'granite_type', label: 'Granite Type',           type: 'text',   placeholder: 'e.g. Natural / Imported' },
    { key: 'colour',       label: 'Colour',                 type: 'text',   placeholder: 'e.g. Black' },
    { key: 'format',       label: 'Format',                 type: 'select', options: ['Slab', 'Tile', 'Cut-to-size'] },
    { key: 'length',       label: 'Length (ft)',            type: 'number', unit: 'ft',  half: true },
    { key: 'width',        label: 'Width (ft)',             type: 'number', unit: 'ft',  half: true },
    { key: 'thickness',    label: 'Thickness',              type: 'select', options: ['16mm', '18mm', '20mm', '2cm', '3cm', '30mm'] },
    { key: 'finish',       label: 'Surface Finish',         type: 'select', options: FINISH },
    { key: 'grade',        label: 'Grade / Quality',        type: 'select', options: GRADE },
    { key: 'origin',       label: 'Origin / Quarry',        type: 'text',   placeholder: 'e.g. Rajasthan' },
  ],

  marble: [
    { key: 'variety',   label: 'Marble Name / Variety', type: 'text',   required: true, placeholder: 'e.g. Makrana White' },
    { key: 'colour',    label: 'Colour / Pattern',      type: 'text',   placeholder: 'e.g. White with grey veins' },
    { key: 'format',    label: 'Format',                type: 'select', options: ['Slab', 'Tile', 'Cut-to-size'] },
    { key: 'length',    label: 'Length (ft)',           type: 'number', unit: 'ft', half: true },
    { key: 'width',     label: 'Width (ft)',            type: 'number', unit: 'ft', half: true },
    { key: 'thickness', label: 'Thickness',             type: 'select', options: ['16mm', '18mm', '20mm', '2cm', '3cm'] },
    { key: 'finish',    label: 'Finish',                type: 'select', options: FINISH },
    { key: 'grade',     label: 'Grade / Quality',       type: 'select', options: GRADE },
    { key: 'origin',    label: 'Origin',                type: 'text',   placeholder: 'e.g. Italian / Indian' },
  ],

  tiles: [
    { key: 'design',           label: 'Tile Name / Design', type: 'text',   required: true, placeholder: 'e.g. Carrara Glossy' },
    { key: 'tile_type',        label: 'Tile Type',          type: 'select', options: ['Ceramic', 'Vitrified', 'Porcelain', 'GVT', 'PGVT', 'Double Charge', 'Wooden'] },
    { key: 'application',      label: 'Application',        type: 'select', options: ['Floor', 'Wall', 'Floor & Wall', 'Outdoor', 'Parking'] },
    { key: 'size',             label: 'Size',               type: 'select', options: ['300x300', '600x600', '600x1200', '800x800', '200x1200', '300x600', '250x375'] },
    { key: 'thickness',        label: 'Thickness',          type: 'text',   placeholder: 'e.g. 8mm',           half: true },
    { key: 'finish',           label: 'Finish',             type: 'select', options: ['Glossy', 'Matt', 'Satin', 'Rustic', 'Sugar', 'Carving'], half: true },
    { key: 'colour',           label: 'Colour / Pattern',   type: 'text',   placeholder: 'e.g. White marble look' },
    { key: 'pcs_per_box',      label: 'Tiles per Box',      type: 'number', half: true },
    { key: 'coverage_per_box', label: 'Coverage / Box',     type: 'number', unit: 'sqft', half: true },
    { key: 'anti_skid',        label: 'Anti-Skid',          type: 'select', options: ['Yes', 'No'] },
  ],

  sanitaryware: [
    { key: 'product_type', label: 'Product Type',      type: 'select', required: true, options: ['Wash Basin', 'Water Closet (WC)', 'One-Piece WC', 'Wall-Hung WC', 'Urinal', 'Cistern', 'Pedestal', 'Sink', 'Faucet / Tap', 'Shower', 'Health Faucet', 'Accessory'] },
    { key: 'model_number', label: 'Model Number',      type: 'text',   placeholder: 'e.g. WHT-2201' },
    { key: 'colour',       label: 'Colour',            type: 'select', options: ['White', 'Ivory', 'Black', 'Grey', 'Beige', 'Chrome', 'Matt Black'] },
    { key: 'material',     label: 'Material',          type: 'select', options: ['Ceramic', 'Vitreous China', 'Stainless Steel', 'Brass', 'Acrylic', 'PVC'] },
    { key: 'finish',       label: 'Finish',            type: 'text',   placeholder: 'e.g. Glossy / Matt',    half: true },
    { key: 'size',         label: 'Size / Dimensions', type: 'text',   placeholder: 'e.g. 550x400 mm',       half: true },
    { key: 'installation', label: 'Installation Type', type: 'select', options: ['Wall-Hung', 'Floor-Mounted', 'Counter-Top', 'Under-Counter', 'Table-Top'] },
  ],

  blocks: [
    { key: 'block_type', label: 'Block Name / Type', type: 'select', required: true, options: ['AAC Block', 'Concrete Block', 'Fly Ash Brick', 'Solid Block', 'Hollow Block', 'Paver Block', 'Cement Brick'] },
    { key: 'length',     label: 'Length',            type: 'number', unit: 'mm', half: true },
    { key: 'width',      label: 'Width',             type: 'number', unit: 'mm', half: true },
    { key: 'height',     label: 'Height',            type: 'number', unit: 'mm', half: true },
    { key: 'thickness',  label: 'Thickness',         type: 'text',   placeholder: 'if applicable', half: true },
    { key: 'material',   label: 'Material',          type: 'text',   placeholder: 'e.g. Cement / AAC' },
    { key: 'grade',      label: 'Grade / Quality',   type: 'select', options: GRADE },
  ],

  other: [
    { key: 'size',      label: 'Size',      type: 'text', half: true },
    { key: 'finish',    label: 'Finish',    type: 'text', half: true },
    { key: 'colour',    label: 'Colour',    type: 'text', half: true },
    { key: 'material',  label: 'Material',  type: 'text', half: true },
    { key: 'thickness', label: 'Thickness', type: 'text' },
  ],
};

// Per-type default unit of measurement.
export const CATEGORY_UNIT = {
  granite:      'Sq Ft',
  marble:       'Sq Ft',
  tiles:        'Box',
  sanitaryware: 'Piece',
  blocks:       'Number',
  other:        'Piece',
};

/**
 * Resolve a free-text category name to a known field-schema type.
 */
export function categoryTypeFromName(name = '') {
  const n = String(name).toLowerCase();
  if (/granite/.test(n))                                                  return 'granite';
  if (/marble/.test(n))                                                   return 'marble';
  if (/tile/.test(n))                                                     return 'tiles';
  if (/sanitary|bath|closet|basin|faucet|wc|toilet|fitting/.test(n))     return 'sanitaryware';
  if (/block|brick|paver/.test(n))                                        return 'blocks';
  return 'other';
}

/** Field definitions for a given category type (falls back to 'other'). */
export function fieldsForType(type) {
  return CATEGORY_FIELDS[type] || CATEGORY_FIELDS.other;
}
