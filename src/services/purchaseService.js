// src/services/purchaseService.js
//
// Retailer ERP — Purchases (buying stock INTO this company's inventory) and
// the supplier master those purchases point at.
// Mirrors wholesalerapp/src/services/purchaseService.js, extended with the
// supplier CRUD the wholesaler keeps elsewhere.
import api from './api';

const ERP = '/erp';

export const purchaseService = {
  // ── Purchases ──
  list:     (params) => api.get(`${ERP}/purchases`, { params }),
  get:      (id)     => api.get(`${ERP}/purchases/${id}`),
  create:   (body)   => api.post(`${ERP}/purchases`, body),
  update:   (id, b)  => api.put(`${ERP}/purchases/${id}`, b),
  delete:   (id)     => api.delete(`${ERP}/purchases/${id}`),
  /** Advance a purchase through its lifecycle (ordered → received → …). */
  status:   (id, b)  => api.patch(`${ERP}/purchases/${id}/status`, b),
  /** Record a payment made to the supplier against this purchase. */
  payment:  (id, b)  => api.patch(`${ERP}/purchases/${id}/payment`, b),

  // ── Suppliers ──
  listSuppliers:   (params) => api.get(`${ERP}/suppliers`, { params }),
  createSupplier:  (body)   => api.post(`${ERP}/suppliers`, body),
  updateSupplier:  (id, b)  => api.put(`${ERP}/suppliers/${id}`, b),
  deleteSupplier:  (id)     => api.delete(`${ERP}/suppliers/${id}`),
};

export default purchaseService;
