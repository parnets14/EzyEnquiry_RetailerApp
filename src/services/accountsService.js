// src/services/accountsService.js
//
// Retailer ERP — Accounts: receivables, payables, transactions and the ledgers.
// Mirrors wholesalerapp/src/services/accountsService.js (retailer-scoped routes).
import api from './api';

const ERP = '/erp';

export const accountsService = {
  // ── Receivables (money coming IN) ──
  listReceivables:   (params) => api.get(`${ERP}/payments/receivables`, { params }),
  collectReceivable: (id, b)  => api.post(`${ERP}/payments/receivables/${id}/collect`, b),

  // ── Payables (money going OUT) ──
  listPayables:      (params) => api.get(`${ERP}/payments/payables`, { params }),
  payPayable:        (id, b)  => api.post(`${ERP}/payments/payables/${id}/pay`, b),

  // ── Transactions ledger ──
  listTransactions:  (params) => api.get(`${ERP}/payments/transactions`, { params }),

  // ── Books ──
  cashBook: (params) => api.get(`${ERP}/accounts/cash-book`, { params }),
  bankBook: (params) => api.get(`${ERP}/accounts/bank-book`, { params }),

  /** Whole-company ledger. */
  companyLedger: (params) => api.get(`${ERP}/accounts/company`, { params }),

  // Ledger routes carry the id BOTH as a path segment and as a query param —
  // the shared controller historically read `req.query.customer_id`, so sending
  // both makes the call work regardless of which form the backend resolves.
  customerLedger: (id, p = {}) =>
    api.get(`${ERP}/accounts/customer/${id}`, { params: { customer_id: id, ...p } }),
  supplierLedger: (id, p = {}) =>
    api.get(`${ERP}/accounts/supplier/${id}`, { params: { supplier_id: id, ...p } }),

  // ── Profit & Loss ──
  profitLoss: (params) => api.get(`${ERP}/profit-loss`, { params }),
};

export default accountsService;
