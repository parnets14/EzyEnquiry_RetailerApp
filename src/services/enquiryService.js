// src/services/enquiryService.js
//
// Mirrors wholesalerapp/src/services/enquiryService.js.
//
// DELTA FROM THE WHOLESALER: this app is the BUYER, so the retailer's enquiry
// endpoints are the buyer-side ones — create, cancel, and the
// message/offer threads the retailer reads. The wholesaler's twin is the
// seller-side surface (stats, reply, sendOffer). Only the endpoints this app's
// backend actually exposes are declared here — no speculative extras.
import api from './api';

export const enquiryService = {
  // ── Core ──
  list:   (params = {}) => api.get('/enquiries', { params }),
  create: (body)        => api.post('/enquiries', body),
  get:    (id)          => api.get(`/enquiries/${id}`),

  /**
   * Partial update — the retailer's twin of the wholesaler's `enquiryService.update`.
   * The detail screen uses it to move the status along (`{ status: 'Viewed' }`
   * on open) and to carry the retailer's quote back (`{ status: 'Replied',
   * offered_price, available_quantity, delivery_timeline, remarks }`).
   *
   * NOTE: the retailer's buyer routes are narrower than the wholesaler's seller
   * surface — the marketplace thread is driven by seller offers, so the backend
   * may reject a raw status write on a marketplace enquiry. Callers must treat
   * a failure as non-fatal (the detail screen does).
   */
  update: (id, data)    => api.patch(`/enquiries/${id}`, data),

  /** Alias of `update`, mirroring the wholesaler's named `reply` endpoint. */
  reply:  (id, data)    => api.patch(`/enquiries/${id}`, data),

  /** Retailer withdraws its own enquiry. */
  cancel: (id, reason = '') =>
    api.patch(`/enquiries/${id}/cancel`, { reason }),

  // ── Message thread ──
  listMessages: (enquiryId) =>
    api.get(`/enquiries/${enquiryId}/messages`),
  sendMessage: (enquiryId, message, clientMessageId = '') =>
    api.post(`/enquiries/${enquiryId}/messages`, {
      message,
      client_message_id: clientMessageId,
    }),

  // ── Replies to a broadcast we sent ──
  // One call returns the whole roster: who answered (with their company details,
  // price and availability) and who has not. A broadcast is N sibling enquiries
  // sharing one enq_code, so listing them one by one is useless here.
  listReplies: (enquiryId) => api.get(`/enquiries/${enquiryId}/replies`),

  // ── Reply history — every reply ever sent, in order ──
  listReplyHistory: (enquiryId) => api.get(`/enquiries/${enquiryId}/reply-history`),
  createReplyHistory: (enquiryId, data) => api.post(`/enquiries/${enquiryId}/reply-history`, data),

  // ── Offers (the seller quotes, the retailer accepts/declines) ──
  listOffers: (enquiryId) =>
    api.get(`/enquiries/${enquiryId}/offers`),
  respondToOffer: (enquiryId, offerId, action) =>
    api.patch(`/enquiries/${enquiryId}/offers/${offerId}`, { action }),
};

export default enquiryService;
