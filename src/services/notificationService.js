// src/services/notificationService.js
//
// In-app notification feed (the bell list) + FCM token registration.
// Mirrors wholesalerapp/src/services/notificationService.js.
//
// NOTE ON THE NAME: the Retailer app's push/Notifee plumbing (permissions,
// channels, foreground display, background handler) lives in
// pushNotificationService.js. This file is the API half only — which is
// exactly what the wholesaler's identically-named file contains.
import api from './api';

export const notificationService = {
  /** GET /api/retailer/notifications?page=&limit= */
  list: (params = {}) => api.get('/notifications', { params }),

  markRead: (id) =>
    api.patch(`/notifications/${id}/read`, {}),

  markAllRead: () =>
    api.patch('/notifications/read-all', {}),

  remove: (id) =>
    api.delete(`/notifications/${id}`),

  /** Register (or refresh) the device FCM push token with the backend. */
  saveFCMToken: (token, deviceInfo = '') =>
    api.post('/auth/fcm-token', { token, deviceInfo }),
};

export default notificationService;
