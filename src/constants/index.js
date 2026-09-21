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

// Order Statuses — unified 6-stage Sales Order lifecycle
// New → Accepted → Packing → Dispatched → Out for Delivery → Delivered
export const ORDER_STATUS = {
  NEW:              'New',             // Order created, awaiting seller acceptance
  ACCEPTED:         'Accepted',        // Confirmed by seller
  PACKING:          'Packing',         // Being packed & prepared
  DISPATCHED:       'Dispatched',      // Handed to transport
  OUT_FOR_DELIVERY: 'Out for Delivery',// In transit / out for delivery
  DELIVERED:        'Delivered',       // OTP verified & delivered
  CANCELLED:        'Cancelled',
};

// Human-readable labels shown in the retailer UI
export const ORDER_STATUS_LABEL = {
  'New':             'Order Placed',
  'Accepted':        'Order Confirmed',
  'Packing':         'Being Packed',
  'Dispatched':      'Dispatched',
  'Out for Delivery':'Out for Delivery',
  'Delivered':       'Delivered',
  'Cancelled':       'Cancelled',
};

// Ordered lifecycle steps used to render the retailer order timeline
export const ORDER_LIFECYCLE = [
  'New',
  'Accepted',
  'Packing',
  'Dispatched',
  'Out for Delivery',
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

  // Staff Management
  STAFF_LIST:       'StaffList',
  STAFF_ADD_EDIT:   'StaffAddEdit',

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
