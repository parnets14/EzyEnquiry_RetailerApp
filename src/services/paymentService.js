// src/services/paymentService.js
//
// Online payment against an invoice (the retailer paying a seller).
// Mirrors wholesalerapp/src/services/paymentService.js in shape; the endpoints
// differ because the wholesaler's twin reads the receivables/payables ledgers
// (that side of the ledger lives in accountsService.js here).
import api from './api';

export const paymentService = {
  /** Initiate an online payment → returns gateway order details. */
  initiate: (invoiceId, method = 'Online') =>
    api.post(`/invoices/${invoiceId}/pay`, { method }),

  /** Confirm the gateway result (called after the gateway SDK returns). */
  confirm: (invoiceId, payload) =>
    api.post(`/invoices/${invoiceId}/pay/confirm`, payload),
};

export default paymentService;
