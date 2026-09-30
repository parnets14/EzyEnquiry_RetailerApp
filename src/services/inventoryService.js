// src/services/inventoryService.js
//
// Retailer ERP — Inventory, warehouses and stock transfers.
// Mirrors wholesalerapp/src/services/inventoryService.js (retailer-scoped
// routes, so the wholesaler's /wholesaler/* view endpoints have no twin here).
import api from './api';

const ERP = '/erp';

export const inventoryService = {
  // ── Stock ──
  list:              (params) => api.get(`${ERP}/inventory`, { params }),
  get:               (id)     => api.get(`${ERP}/inventory/${id}`),
  summary:           ()       => api.get(`${ERP}/inventory/summary`),
  movements:         (params) => api.get(`${ERP}/inventory/movements`, { params }),
  /** Positive adjustment = Stock In, negative = Stock Out. */
  adjust:            (body)   => api.patch(`${ERP}/inventory/adjust`, body),
  /** Reserve stock without moving it (e.g. against a pending order). */
  block:             (body)   => api.patch(`${ERP}/inventory/block`, body),

  // ── Warehouses ──
  listWarehouses:    (params) => api.get(`${ERP}/warehouses`, { params }),
  createWarehouse:   (body)   => api.post(`${ERP}/warehouses`, body),
  updateWarehouse:   (id, b)  => api.put(`${ERP}/warehouses/${id}`, b),
  deleteWarehouse:   (id)     => api.delete(`${ERP}/warehouses/${id}`),
  warehouseStock:    (id)     => api.get(`${ERP}/warehouses/${id}/stock`),

  // ── Stock transfers (warehouse → warehouse) ──
  listTransfers:     (params) => api.get(`${ERP}/stock-transfers`, { params }),
  createTransfer:    (body)   => api.post(`${ERP}/stock-transfers`, body),
  transferStatus:    (id, b)  => api.patch(`${ERP}/stock-transfers/${id}/status`, b),
};

export default inventoryService;
