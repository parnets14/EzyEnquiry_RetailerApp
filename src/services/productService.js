// src/services/productService.js
//
// Marketplace product browsing — the catalogue the retailer BUYS from.
// Mirrors wholesalerapp/src/services/productService.js (wholesalerProductService
// half): list / get against the platform catalogue.
//
// Distinct from myProductService.js, which owns the products this retailer
// creates and sells.
import api from './api';

export const productService = {
  /**
   * Search retailer-visible products (marketplace DTO, no internal prices).
   * params: { search, code, design, size, finish, color, material, tile_type,
   *   application, manufacturer, collection, category, sub_category, brand,
   *   location, featured, new_arrival, page, limit }
   */
  search: (params = {}) => api.get('/products', { params }),

  /** Alias — some screens read more naturally as `.list()`. */
  list: (params = {}) => api.get('/products', { params }),

  /** GET /api/retailer/products/:id */
  get: (id) => api.get(`/products/${id}`),

  /**
   * Distinct spec values across the whole visible catalogue, for the filter
   * sheet. Preferred over sampling the first catalogue page — that silently
   * truncates the option lists on a large catalogue.
   * → { sizes, finishes, materials, colors }
   */
  filters: () => api.get('/products/filters'),
};

export default productService;
