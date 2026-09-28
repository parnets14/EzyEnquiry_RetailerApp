// src/services/fieldOptionsService.js
//
// Persists custom dropdown options the retailer adds for product detail
// fields (granite_type, thickness, finish, grade, colour, tile_type, …).
// Stored locally so a custom value added once is reusable next time.
//
// Mirrors the wholesaler app's fieldOptionsService so both Add-Product
// forms behave identically. Uses its own storage key so the two apps
// never share (or clobber) each other's option lists.
//
// Shape in storage: { "<fieldKey>": ["Custom A", "Custom B"], ... }
//                   { "__hidden__": { "<fieldKey>": ["BuiltIn"] } }
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@retailer_field_options';

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

export const fieldOptionsService = {
  /** All custom options: { fieldKey: [values] }. */
  all: () => readAll(),

  /** Custom options for one field key. */
  async get(fieldKey) {
    const map = await readAll();
    return Array.isArray(map[fieldKey]) ? map[fieldKey] : [];
  },

  /** Add a custom option to a field (deduped, case-insensitive). Returns the list. */
  async add(fieldKey, value) {
    const v = String(value || '').trim();
    if (!v) return this.get(fieldKey);
    const map = await readAll();
    const list = Array.isArray(map[fieldKey]) ? map[fieldKey] : [];
    if (!list.some(x => x.toLowerCase() === v.toLowerCase())) list.push(v);
    map[fieldKey] = list;
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
    return list;
  },

  /** Remove a custom option from a field (case-insensitive). Returns the list. */
  async remove(fieldKey, value) {
    const v = String(value || '').trim().toLowerCase();
    const map = await readAll();
    const list = (Array.isArray(map[fieldKey]) ? map[fieldKey] : []).filter(x => x.toLowerCase() !== v);
    map[fieldKey] = list;
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
    return list;
  },

  // ── Hidden built-in options ────────────────────────────────
  // Built-in (default) options live in code, so "deleting" one means hiding it.
  // Stored under a reserved key so it never collides with a real field key.
  async hidden(fieldKey) {
    const map = await readAll();
    const h = map.__hidden__ || {};
    return Array.isArray(h[fieldKey]) ? h[fieldKey] : [];
  },

  /** Hide a built-in option for a field. Returns the hidden list. */
  async hide(fieldKey, value) {
    const v = String(value || '').trim();
    if (!v) return this.hidden(fieldKey);
    const map = await readAll();
    const h = map.__hidden__ || {};
    const list = Array.isArray(h[fieldKey]) ? h[fieldKey] : [];
    if (!list.some(x => x.toLowerCase() === v.toLowerCase())) list.push(v);
    h[fieldKey] = list;
    map.__hidden__ = h;
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
    return list;
  },
};

export default fieldOptionsService;
