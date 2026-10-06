// src/services/subscriptionService.js
//
// Mirrors wholesalerapp/src/services/subscriptionService.js — the retailer can now
// activate/upgrade a plan from the app, the same way the wholesaler's Subscription
// screen does. `subscribe` hits POST /api/retailer/subscription/subscribe, which logs
// a Subscription row and points Company.subscription_plan at the new plan.
import api from './api';

export const subscriptionService = {
  /** The plan this company is currently on. */
  current: () => api.get('/subscription/current'),

  /** Available plans for the upgrade screen. */
  plans: () => api.get('/subscription/plans'),

  /** Activate / upgrade a plan for a period (months). */
  subscribe: ({ plan, months = 1, amount_paid = 0 }) =>
    api.post('/subscription/subscribe', { plan, months, amount_paid }),
};

export default subscriptionService;
