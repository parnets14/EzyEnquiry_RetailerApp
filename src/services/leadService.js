// src/services/leadService.js
//
// Retailer ERP — Leads and their follow-ups.
// Mirrors wholesalerapp/src/services/leadService.js, which likewise exports
// both `leadService` and `followupService` from one file.
import api from './api';

const ERP = '/erp';

export const leadService = {
  list:    (params)   => api.get(`${ERP}/leads`, { params }),
  create:  (data)     => api.post(`${ERP}/leads`, data),
  update:  (id, data) => api.put(`${ERP}/leads/${id}`, data),
  convert: (id, data) => api.patch(`${ERP}/leads/${id}/convert`, data || {}),
  remove:  (id)       => api.delete(`${ERP}/leads/${id}`),
};

export const followupService = {
  list:   (params)   => api.get(`${ERP}/followups`, { params }),
  create: (data)     => api.post(`${ERP}/followups`, data),
  update: (id, data) => api.put(`${ERP}/followups/${id}`, data),
  remove: (id)       => api.delete(`${ERP}/followups/${id}`),
};

export default leadService;
