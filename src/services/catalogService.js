// src/services/catalogService.js
//
// Categories / sub-categories / brands for the Add-Product dropdowns.
//
// Wholesaler equivalent: the taxonomy block of `wholesalerProductService`
// (getTaxonomy / createCategory / createSubCategory / createBrand + the three
// deletes) in wholesalerapp/src/services/productService.js. The retailer
// backend serves the same concept from a dedicated /catalog mount, so it gets
// its own file rather than bloating productService.
import api from './api';

export const catalogService = {
  categories:    ()            => api.get('/catalog/categories'),
  subCategories: (categoryId = '') =>
    api.get('/catalog/sub-categories', { params: categoryId ? { category_id: categoryId } : {} }),
  brands:        ()            => api.get('/catalog/brands'),

  createCategory:    (body) => api.post('/catalog/categories', body),
  deleteCategory:    (id)   => api.delete(`/catalog/categories/${id}`),

  createSubCategory: (body) => api.post('/catalog/sub-categories', body),
  deleteSubCategory: (id)   => api.delete(`/catalog/sub-categories/${id}`),

  createBrand:       (body) => api.post('/catalog/brands', body),
  deleteBrand:       (id)   => api.delete(`/catalog/brands/${id}`),
};

export default catalogService;
