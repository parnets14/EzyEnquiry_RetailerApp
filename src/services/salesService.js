// src/services/salesService.js
//
// Retailer ERP — Sales.
// Mirrors wholesalerapp/src/services/salesService.js.
//
// DELTA FROM THE WHOLESALER: the wholesaler's twin hits the shared ERP routes
// (/api/sales). The backend blocks retailer tokens from every
// ERP_ROUTE_PREFIXES entry (server.js → denyRetailerErpAccess), so this app is
// served by /api/retailer/erp/* instead — the same company-scoped controllers
// re-mounted behind a retailer module guard. Method names and payloads are
// otherwise identical.
import api from './api';

const ERP = '/erp';

export const salesService = {
  list:          (params) => api.get(`${ERP}/sales`, { params }),
  get:           (id)     => api.get(`${ERP}/sales/${id}`),
  create:        (data)   => api.post(`${ERP}/sales`, data),
  recordPayment: (id, d)  => api.patch(`${ERP}/sales/${id}/payment`, d),
  report:        (params) => api.get(`${ERP}/sales/report`, { params }),
};

export default salesService;
