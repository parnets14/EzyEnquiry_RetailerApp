// src/services/expenseService.js
//
// Retailer ERP — Expenses.
// Mirrors wholesalerapp/src/services/expenseService.js (retailer-scoped routes).
import api from './api';

const ERP = '/erp';

export const expenseService = {
  list:   (params) => api.get(`${ERP}/expenses`, { params }),
  create: (data)   => api.post(`${ERP}/expenses`, data),
  update: (id, d)  => api.put(`${ERP}/expenses/${id}`, d),
  delete: (id)     => api.delete(`${ERP}/expenses/${id}`),
  // The retailer mount groups this under /reports, not /expenses/report.
  report: (params) => api.get(`${ERP}/reports/expenses`, { params }),
};

export default expenseService;
