// src/services/myProductService.js
//
// Products this retailer OWNS — created by this company and sold to others.
// Wholesaler equivalent: the `wholesalerProductService` half of
// wholesalerapp/src/services/productService.js (listMine / create / update /
// delete / taxonomy).
//
// Distinct from productService.js, which browses the catalogue the retailer
// buys from.
import api from './api';

export const myProductService = {
  list: (params = {}) => api.get('/my-products', { params }),
  get:  (id)          => api.get(`/my-products/${id}`),
  remove: (id)        => api.delete(`/my-products/${id}`),

  /**
   * Create a product owned by the retailer.
   * fields: plain object of product fields (brand/category/sub_category by NAME).
   * images: array of { uri, type, name } picked from the device.
   */
  create(fields = {}, images = []) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'boolean') form.append(key, String(value));
      else if (typeof value === 'object') form.append(key, JSON.stringify(value)); // e.g. attributes {}
      else form.append(key, value);
    });
    images.forEach((img, idx) => {
      form.append('file', {
        uri: img.uri,
        type: img.type || 'image/jpeg',
        name: img.name || `product_${idx}.jpg`,
      });
    });
    return api.upload('/my-products', form);
  },

  /** Update a retailer-owned product, keeping only the supplied existing image URLs. */
  update(id, fields = {}, images = [], existingImageUrls = []) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'boolean') form.append(key, String(value));
      else if (typeof value === 'object') form.append(key, JSON.stringify(value)); // e.g. attributes {}
      else form.append(key, value);
    });
    form.append('image_urls', JSON.stringify(existingImageUrls));
    images.forEach((img, idx) => {
      form.append('file', {
        uri: img.uri,
        type: img.type || 'image/jpeg',
        name: img.name || `product_${idx}.jpg`,
      });
    });
    return api.upload(`/my-products/${id}`, form, 60000, 'PUT');
  },

  /**
   * Lifecycle-only update — status / is_active.
   *
   * Deliberately a JSON PATCH, not the multipart `update()` above: toggling a
   * status must not require re-uploading images or resending every field (the
   * multipart path rewrites `image_urls`, so a partial send would strip them).
   *
   * status: 'active' | 'out_of_stock' | 'discontinued'
   * Mirrors the wholesaler's `patchProduct` in ProductListScreen.
   */
  patchStatus: (id, changes) => api.patch(`/my-products/${id}`, changes),
};

export default myProductService;
