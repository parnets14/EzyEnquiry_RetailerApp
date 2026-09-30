// src/services/reportsService.js
//
// Retailer ERP — reports and exports.
// Mirrors wholesalerapp/src/services/reportsService.js, including the
// authenticated-export-URL helper.
import api, { BASE_URL } from './api';
import { getToken } from '../utils/storage';

const ERP = '/erp';

/**
 * Build an authenticated export URL (token as a query param) for PDF/Excel
 * download. The token rides in the query because Linking.openURL — which is
 * what opens the file — cannot set an Authorization header.
 *
 * type ∈ sales | purchases | expenses | inventory (what the controller supports).
 */
export async function reportExportUrl(type, { format = 'excel', from_date, to_date, group_by } = {}) {
  const token = await getToken().catch(() => null);
  const qs = new URLSearchParams({ format });
  if (from_date) qs.append('from_date', from_date);
  if (to_date)   qs.append('to_date', to_date);
  if (group_by)  qs.append('group_by', group_by);
  if (token)     qs.append('token', token);
  return `${BASE_URL}/retailer${ERP}/reports/${type}/export?${qs.toString()}`;
}

export const reportsService = {
  sales:     (params) => api.get(`${ERP}/reports/sales`, { params }),
  purchases: (params) => api.get(`${ERP}/reports/purchases`, { params }),
  customers: (params) => api.get(`${ERP}/reports/customers`, { params }),
  suppliers: (params) => api.get(`${ERP}/reports/suppliers`, { params }),
  inventory: (params) => api.get(`${ERP}/reports/inventory`, { params }),
  analytics: (params) => api.get(`${ERP}/reports/analytics`, { params }),
};

export default reportsService;
