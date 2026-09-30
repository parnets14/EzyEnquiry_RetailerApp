// src/services/authService.js
//
// All auth-related API calls for the Retailer app.
// Mirrors wholesalerapp/src/services/authService.js.
// Base URL is defined once in api.js — do not redefine here.
import api from './api';

export const authService = {
  /** Check if a mobile is already registered → WelcomeScreen routing */
  checkMobile: (mobile) =>
    api.post('/auth/check-mobile', { mobile }),

  /** Send OTP to a mobile */
  sendOtp: (mobile, purpose = 'login') =>
    api.post('/auth/send-otp', { mobile, purpose }),

  /** Verify OTP — returns { token, user } on login, { verified: true } otherwise */
  verifyOtp: (mobile, otp, purpose = 'login') =>
    api.post('/auth/verify-otp', { mobile, otp, purpose }),

  /** Password login (identifier = mobile or email) */
  login: (identifier, password) =>
    api.post('/auth/login', { identifier, password }),

  /** Register a new retailer company */
  register: (payload) =>
    api.post('/auth/register', payload),

  /** Get the logged-in user's profile + company status */
  me: () =>
    api.get('/auth/me'),

  /** Logout — server-side session cleanup */
  logout: () =>
    api.post('/auth/logout', {}),

  /**
   * Upload ONE KYC document — authenticated multipart POST.
   * `file` is a picker result: { uri, type, name }.
   */
  uploadDocs(fieldName, file) {
    const form = new FormData();
    form.append(fieldName, {
      uri:  file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || `${fieldName}.jpg`,
    });
    return api.upload('/kyc/documents', form);
  },

  /** Upload every document selected during registration in one request. */
  uploadRegistrationDocs(documents = {}) {
    const form = new FormData();
    let count = 0;
    for (const document of Object.values(documents)) {
      if (!document?.field || !document?.file?.uri) continue;
      form.append(document.field, {
        uri:  document.file.uri,
        type: document.file.type || 'application/octet-stream',
        name: document.file.name || `${document.field}.jpg`,
      });
      count += 1;
    }
    if (!count) return Promise.resolve({ uploaded: [], documents: [] });
    return api.upload('/kyc/documents', form, 60000);
  },
};

export default authService;
