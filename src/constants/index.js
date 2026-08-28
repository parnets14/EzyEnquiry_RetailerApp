export const APP_NAME = 'EzyEnquiry';
export const APP_TAGLINE = 'Find Stock Instantly';

// Auth Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@ezy_auth_token',
  USER_DATA: '@ezy_user_data',
  IS_LOGGED_IN: '@ezy_is_logged_in',
};

// Enquiry Statuses
export const ENQUIRY_STATUS = {
  NEW: 'New',
  VIEWED: 'Viewed',
  REPLIED: 'Replied',
  NEGOTIATION: 'Negotiation',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

// Order Statuses
export const ORDER_STATUS = {
  NEW: 'New',
  ACCEPTED: 'Accepted',
  PROCESSING: 'Processing',
  READY: 'Ready',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
};

// Navigation Screen Names
export const SCREENS = {
  // Auth
  SPLASH: 'Splash',
  LOGIN: 'Login',
  REGISTER: 'Register',
  OTP_VERIFY: 'OTPVerify',
  FORGOT_PASSWORD: 'ForgotPassword',
  RESET_PASSWORD: 'ResetPassword',

  // Main Tabs
  HOME: 'Home',
  SEARCH: 'Search',
  ENQUIRIES: 'Enquiries',
  ORDERS: 'Orders',
  PROFILE: 'Profile',

  // Products
  PRODUCT_DETAILS: 'ProductDetails',
  SEARCH_RESULTS: 'SearchResults',

  // Enquiry
  CREATE_ENQUIRY: 'CreateEnquiry',
  ENQUIRY_SUCCESS: 'EnquirySuccess',
  ENQUIRY_DETAILS: 'EnquiryDetails',
  NEGOTIATION: 'Negotiation',
  QUOTATION_CONFIRM: 'QuotationConfirm',

  // Orders
  ORDER_CONFIRMATION: 'OrderConfirmation',
  ORDER_SUCCESS: 'OrderSuccess',
  ORDER_DETAILS: 'OrderDetails',
  ORDER_TRACKING: 'OrderTracking',
  DISPATCH_DETAILS: 'DispatchDetails',

  // Notifications
  NOTIFICATIONS: 'Notifications',

  // Profile
  COMPANY_DETAILS: 'CompanyDetails',
  DOCUMENTS: 'Documents',
  SUBSCRIPTION: 'Subscription',
  NOTIFICATION_SETTINGS: 'NotificationSettings',
  CHANGE_PASSWORD: 'ChangePassword',
  HELP_SUPPORT: 'HelpSupport',
};

// Units
export const UNITS = ['Boxes', 'Sq Ft', 'Sq Mtr', 'Pieces', 'Pallets'];

// Notification types
export const NOTIFICATION_TYPES = {
  ENQUIRY: 'enquiry',
  ORDER: 'order',
  DELIVERY: 'delivery',
  SYSTEM: 'system',
};
