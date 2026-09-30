// src/services/customerService.js
//
// Marketplace customers. Mirrors wholesalerapp/src/services/customerService.js.
//
// DELTA FROM THE WHOLESALER: customers belong to the product-owner (Admin)
// company, not to the retailer, so every call carries that company's id. The
// wholesaler's twin can rely on the server resolving its own company; here the
// id must be threaded through explicitly. `companyId` therefore stays the first
// positional argument on list/create/update/remove.
import api from './api';

export const customerService = {
  list: (companyId, params = {}) =>
    api.get('/customers', { params: { company_id: companyId, ...params } }),

  create: (companyId, body = {}) =>
    api.post('/customers', { company_id: companyId, ...body }),

  update: (id, companyId, body = {}) =>
    api.put(`/customers/${id}`, { company_id: companyId, ...body }),

  remove: (id, companyId) =>
    api.delete(`/customers/${id}`, { params: { company_id: companyId } }),
};

export default customerService;
