// src/services/erpCustomerService.js
//
// Retailer ERP — customers on the ERP/ledger side.
//
// Distinct from customerService.js (the marketplace customer list scoped to the
// product-owner company). These are the parties that appear in sales, purchases
// and the ledgers, scoped to the retailer's own company.
import api from './api';

const ERP = '/erp';

export const erpCustomerService = {
  list:   (params)   => api.get(`${ERP}/erp-customers`, { params }),
  create: (body)     => api.post(`${ERP}/erp-customers`, body),
  update: (id, body) => api.put(`${ERP}/erp-customers/${id}`, body),
  remove: (id)       => api.delete(`${ERP}/erp-customers/${id}`),
};

export default erpCustomerService;
