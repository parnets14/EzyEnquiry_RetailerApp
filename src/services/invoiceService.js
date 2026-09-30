// src/services/invoiceService.js
//
// Invoices raised against the retailer's orders — one per dispatch.
// Mirrors wholesalerapp/src/services/invoiceService.js.
import api from './api';

export const invoiceService = {
  /** GET /api/retailer/invoices?page=&limit=&search=&status= */
  list: (params = {}) => api.get('/invoices', { params }),

  /** GET /api/retailer/invoices/:id */
  get: (id) => api.get(`/invoices/${id}`),

  /** Every invoice raised for one order. */
  byOrder: (orderId) => api.get(`/orders/${orderId}/invoices`),
};

export default invoiceService;
