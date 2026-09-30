// src/services/sellerOrderService.js
//
// Retailer ERP — SELLER-side orders (fulfilment).
//
// This company acting as the PRODUCT OWNER: orders raised against products it
// sells. Every call is scoped server-side to `company_id: req.user.company_id`,
// so an order this retailer placed as a BUYER is simply not found here.
//
// Distinct from orderService.js, which is the buyer's view of its purchases.
// Wholesaler equivalent: the orderService surface plus its dispatch/pack flow.
import api from './api';

const ERP = '/erp';

export const sellerOrderService = {
  list: (params) => api.get(`${ERP}/orders`, { params }),
  get:  (id)     => api.get(`${ERP}/orders/${id}`),

  /** action: 'accept' | 'reject' | 'packing' | 'deliver' */
  updateStatus: (id, action, remarks) =>
    api.patch(`${ERP}/orders/${id}/status`, { action, remarks }),

  /**
   * PARTIAL fulfilment — the "send 50 of 100" call.
   * Raises an invoice for just this quantity, creates the dispatch with the
   * vehicle details, deducts stock and books the sale, then appends to
   * order.packages[]. Call it again for the remaining quantity.
   * Returns { order, invoice, dispatch }.
   * Body: { pack_qty, vehicle_number, driver_name, driver_mobile,
   *         transport_name, lr_number, dispatch_date, expected_delivery_days }
   */
  pack: (id, body) => api.post(`${ERP}/orders/${id}/pack`, body),
};

export default sellerOrderService;
