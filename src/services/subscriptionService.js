// src/services/subscriptionService.js
//
// Mirrors wholesalerapp/src/services/subscriptionService.js, but read-only:
// the wholesaler's twin can activate/upgrade a plan, whereas the retailer's
// backend exposes only the current plan and the plan catalogue.
import api from './api';

export const subscriptionService = {
  /** The plan this company is currently on. */
  current: () => api.get('/subscription/current'),

  /** Available plans for the upgrade screen. */
  plans: () => api.get('/subscription/plans'),
};

export default subscriptionService;
