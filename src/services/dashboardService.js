// src/services/dashboardService.js
//
// The retailer's home dashboard.
// Wholesaler equivalent: reportsService.dashboard() — the wholesaler's
// /reports/dashboard aggregate. The retailer backend serves the same idea from
// a dedicated retailer-scoped route, so it gets its own small service rather
// than being folded into reportsService.
import api from './api';

export const dashboardService = {
  /** GET /api/retailer/dashboard — KPI cards, recent activity, counters. */
  get: () => api.get('/dashboard'),
};

export default dashboardService;
