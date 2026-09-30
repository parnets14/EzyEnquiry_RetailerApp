// src/services/orderService.js
//
// The retailer's BUYER-side orders — purchases this company placed.
// Mirrors wholesalerapp/src/services/orderService.js.
//
// DELTA FROM THE WHOLESALER: the wholesaler raises orders from a confirmed
// enquiry and generates invoices from them. Here the order is the buyer's, so
// the extra surface is the buyer's own cancel.
//
// The buyer-side tracking / delivery-OTP surface (tracking(), dispatches(),
// requestDeliveryOtp(), confirmDeliveryOtp()) was REMOVED along with
// OrderTrackingScreen + DeliveryOTPScreen. The wholesaler has no order-tracking
// feature, so parity means no tracking here either.
//
// Distinct from sellerOrderService.js, which is the same company acting as the
// PRODUCT OWNER fulfilling orders raised against its catalogue.
import api from './api';

export const orderService = {
  list:   (params = {}) => api.get('/orders', { params }),
  create: (body)        => api.post('/orders', body),
  get:    (id)          => api.get(`/orders/${id}`),
  cancel: (id, reason = '') =>
    api.patch(`/orders/${id}/cancel`, { reason }),
};

export default orderService;
