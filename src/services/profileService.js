// src/services/profileService.js
//
// Profile / company / address / KYC for the signed-in retailer.
//
// The wholesaler folds these calls into authService (updateProfile) and has no
// equivalent for addresses or the company record, so there is no exact twin —
// this is the retailer's own grouping, named to match the rest of the layer.
import api from './api';

export const profileService = {
  // ── Personal profile ──
  getProfile:    ()     => api.get('/profile'),
  updateProfile: (body) => api.put('/profile', body),

  // ── Company record ──
  getCompany:    ()     => api.get('/company'),
  updateCompany: (body) => api.put('/company', body),

  changePassword: (currentPassword, newPassword) =>
    api.patch('/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  // ── Delivery addresses ──
  listAddresses:    ()         => api.get('/addresses'),
  addAddress:       (body)     => api.post('/addresses', body),
  updateAddress:    (id, body) => api.put(`/addresses/${id}`, body),
  deleteAddress:    (id)       => api.delete(`/addresses/${id}`),

  // ── KYC ──
  // Distinct from documentService.js: KYC feeds the company's verification
  // record and is reviewed by the CRM; the document repository is free-form.
  getKycDocuments: () => api.get('/kyc/documents'),
};

export default profileService;
