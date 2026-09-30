// src/services/staffService.js
//
// The retailer's own staff accounts.
// Wholesaler equivalent: employeeService.js — same concept, different mount.
import api from './api';

export const staffService = {
  /** Labelled module list for the access checkboxes on Add/Edit Staff. */
  getModules: () => api.get('/staff/modules'),

  list: (params = {}) => api.get('/staff', { params }),
  get:  (id)          => api.get(`/staff/${id}`),

  /**
   * Current-month sales + earned incentive for one staff member.
   * Sales are matched on the staff name recorded against orders (see the
   * controller) — `basis` in the response says how it was derived.
   */
  incentive: (id) => api.get(`/staff/${id}/incentive`),

  create: (body)     => api.post('/staff', body),
  update: (id, body) => api.put(`/staff/${id}`, body),
  /** Enable / disable a staff account. */
  toggle: (id)       => api.patch(`/staff/${id}/toggle`, {}),
  remove: (id)       => api.delete(`/staff/${id}`),
};

export default staffService;
