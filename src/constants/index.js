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

// Order Statuses — Sales Order lifecycle (retailer-facing)
// QUOTATION → SALES ORDER → PICKING → DISPATCH → OUT FOR DELIVERY → DELIVERED
export const ORDER_STATUS = {
  NEW: 'New',                    // Order created, awaiting seller acceptance
  ACCEPTED: 'Accepted',          // Order Confirmed by seller
  PROCESSING: 'Processing',      // Being prepared / picking
  READY: 'ReadyForDispatch',     // Picked & ready
  DISPATCHED: 'Dispatched',      // Handed to transport
  IN_TRANSIT: 'InTransit',       // Out for delivery
  DELIVERED: 'Delivered',        // OTP verified & delivered
  CANCELLED: 'Cancelled',
};

// Human-readable labels for the retailer order lifecycle
export const ORDER_STATUS_LABEL = {
  New: 'Order Placed',
  Accepted: 'Order Confirmed',
  Processing: 'Processing',
  ReadyForDispatch: 'Ready / Picking',
  Dispatched: 'Dispatched',
  InTransit: 'Out for Delivery',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};

// Ordered lifecycle steps used to render the retailer order timeline
export const ORDER_LIFECYCLE = [
  'New',
  'Accepted',
  'Processing',
  'ReadyForDispatch',
  'Dispatched',
  'InTransit',
  'Delivered',
];

// Payment Statuses (invoice-level)
export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  PARTIAL: 'Partial',
  PAID: 'Paid',
};

// Payment Methods
export const PAYMENT_METHOD = {
  ONLINE: 'Online',   // UPI / card / net-banking via gateway
  CASH: 'Cash',       // Collected by staff
  CHEQUE: 'Cheque',
  UPI: 'UPI',
};

// Navigation Screen Names
export const SCREENS = {
  // Auth
  SPLASH: 'Splash',
  LOGIN: 'Login',
  REGISTER: 'Register',
  OTP_VERIFY: 'OTPVerify',
  PENDING_APPROVAL: 'PendingApproval',
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
  ADD_PRODUCT: 'AddProduct',
  MY_PRODUCTS: 'MyProducts',

  // Enquiry
  CREATE_ENQUIRY: 'CreateEnquiry',
  ENQUIRY_SUCCESS: 'EnquirySuccess',
  ENQUIRY_DETAILS: 'EnquiryDetails',
  NEGOTIATION: 'Negotiation',
  QUOTATION_CONFIRM: 'QuotationConfirm',

  // Quotations (Send Enquiry → Quotation)
  QUOTATIONS: 'Quotations',
  QUOTATION_DETAILS: 'QuotationDetails',

  // Orders
  ORDER_CONFIRMATION: 'OrderConfirmation',
  ORDER_SUCCESS: 'OrderSuccess',
  ORDER_DETAILS: 'OrderDetails',
  ORDER_TRACKING: 'OrderTracking',
  DISPATCH_DETAILS: 'DispatchDetails',
  DELIVERY_OTP: 'DeliveryOTP',

  // Invoices & Payments
  INVOICES: 'Invoices',
  INVOICE_DETAILS: 'InvoiceDetails',
  PAYMENT: 'Payment',
  PAYMENTS: 'Payments',

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
