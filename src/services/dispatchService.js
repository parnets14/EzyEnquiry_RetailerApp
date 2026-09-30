// src/services/dispatchService.js
//
// Retailer ERP — Dispatch (this company's own final stock-out step:
// create → In Transit → Delivered).
// Mirrors wholesalerapp/src/services/dispatchService.js (retailer-scoped routes).
import api from './api';

const ERP = '/erp';

export const dispatchService = {
  list:   (params) => api.get(`${ERP}/dispatches`, { params }),
  get:    (id)     => api.get(`${ERP}/dispatches/${id}`),
  create: (data)   => api.post(`${ERP}/dispatches`, data),
  update: (id, d)  => api.put(`${ERP}/dispatches/${id}`, d),

  /**
   * Orders this retailer can still dispatch, for the entry form's order picker.
   * Returns { orders, counts }. Orders that already have a dispatch are excluded
   * because createDispatch rejects them with 409.
   */
  dispatchableOrders: () => api.get(`${ERP}/dispatches/dispatchable-orders`),

  markInTransit: (id)     => api.patch(`${ERP}/dispatches/${id}/intransit`, {}),
  markDelivered: (id, d)  => api.patch(`${ERP}/dispatches/${id}/deliver`, d || {}),

  /**
   * Upload a proof-of-delivery image and return `{ url }`.
   * `file` is a picker result: { uri, type, name }. The backend multer field is
   * literally "pod" — the name below must match `podUpload` in
   * middleware/podUpload.js or the request 400s with "No image received."
   */
  uploadPod(file) {
    const form = new FormData();
    form.append('pod', {
      uri:  file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || `pod_${Date.now()}.jpg`,
    });
    return api.upload(`${ERP}/dispatches/upload-pod`, form);
  },
};

export default dispatchService;
