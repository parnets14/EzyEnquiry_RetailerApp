export const APP_NAME = 'EzyEnquiry';
export const APP_TAGLINE = 'Find Stock Instantly';

// Auth Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN:  '@ezy_auth_token',
  USER_DATA:   '@ezy_user_data',
  IS_LOGGED_IN:'@ezy_is_logged_in',
  FCM_TOKEN:   '@ezy_fcm_token',
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

  // Bottom tabs — mirrors the wholesaler's five tabs
  // (Home · Enquiries · Products · Sales · Profile).
  // SEARCH and ORDERS are no longer tabs but remain registered stack screens.
  HOME: 'Home',
  SEARCH: 'Search',
  ENQUIRIES: 'Enquiries',
  ORDERS: 'Orders',
  PROFILE: 'Profile',

  // Products
  PRODUCT_DETAILS: 'ProductDetails',
  ADD_PRODUCT: 'AddProduct',
  CATEGORIES_BRANDS: 'CategoriesBrands',
  MY_PRODUCTS: 'MyProducts',

  // Enquiry
  ENQUIRY_DETAILS: 'EnquiryDetails',
  // Raise a new enquiry from the retailer app (product-backed form, POST
  // /retailer/enquiries). Reached from the Enquiries tab's FAB.
  CREATE_ENQUIRY:  'CreateEnquiry',

  // Quotations
  QUOTATIONS: 'Quotations',
  // Order-confirmation step reached from an accepted enquiry offer
  // (EnquiryDetailsScreen → QuotationConfirmScreen), and the success screen it
  // hands off to. Both were navigated to by SCREENS.* while the constant was
  // missing, so the call evaluated to `undefined` and threw at runtime.
  QUOTATION_CONFIRM: 'QuotationConfirm',
  ORDER_SUCCESS:     'OrderSuccess',

  // Orders
  ORDER_DETAILS: 'OrderDetails',

  // Invoices
  INVOICES: 'Invoices',
  INVOICE_DETAILS: 'InvoiceDetails',

  // Notifications
  NOTIFICATIONS: 'Notifications',

  // Staff Management
  STAFF_LIST:       'StaffList',
  STAFF_ADD_EDIT:   'StaffAddEdit',

  // Profile
  SUBSCRIPTION: 'Subscription',
  // Profile-adjacent screens. All five were navigated to by
  // `screens/profile/ProfileScreen.jsx` while the constant itself was MISSING, so
  // `SCREENS.X` evaluated to `undefined` and the navigation threw at runtime
  // ("The action 'NAVIGATE' with payload {"name":undefined} was not handled").
  // ESLint cannot catch this — `SCREENS` is defined, so `no-undef` never fires.
  // The screen files all existed; they were simply registered nowhere.
  // Fixed 2026-09-30.
  COMPANY_DETAILS:       'CompanyDetails',        // edit the company record
  DOCUMENTS:             'Documents',             // KYC verification (4 fixed slots)
  SUPPLIER_LIST:         'SupplierList',          // ERP suppliers (module: purchases)
  NOTIFICATION_SETTINGS: 'NotificationSettings',  // push / in-app notification prefs
  HELP_SUPPORT:          'HelpSupport',

  // ── ERP modules (wholesaler parity) ──────────────────────────
  // Sales
  SALES_LIST:       'SalesList',
  SALES_ENTRY:      'SalesEntry',
  SALES_REPORT:     'SalesReport',
  // Expense
  EXPENSE_LIST:     'ExpenseList',
  EXPENSE_ENTRY:    'ExpenseEntry',
  EXPENSE_REPORT:   'ExpenseReport',
  // Profit & Loss
  PROFIT_LOSS:      'ProfitLoss',
  // Purchase
  PURCHASE_LIST:    'PurchaseList',
  PURCHASE_ENTRY:   'PurchaseEntry',
  // Inventory
  INVENTORY:        'Inventory',
  STOCK_ADJUST:     'StockAdjust',
  STOCK_TRANSFER:   'StockTransfer',
  WAREHOUSE_LIST:   'WarehouseList',
  // Payments & accounts
  PAYMENT_RECEIVABLE: 'PaymentReceivable',
  PAYMENT_PAYABLE:    'PaymentPayable',
  ACCOUNTS:           'Accounts',
  CUSTOMER_LEDGER:    'CustomerLedger',
  // CRM
  LEAD_LIST:        'LeadList',
  CUSTOMER_LIST:    'CustomerList',
  // Reports
  REPORT_CENTER:    'ReportCenter',
  ANALYTICS:        'Analytics',
  // Dispatch — OUTBOUND shipments the retailer raises for its own orders.
  // Distinct from DISPATCH_DETAILS above, which is the read-only view of an
  // INBOUND dispatch raised by a seller against one of the retailer's orders.
  DISPATCH_TRACKING: 'DispatchTracking',
  DISPATCH_ENTRY:    'DispatchEntry',
  // Order fulfilment — the SELLER side of the order lifecycle. "Orders I am
  // Selling" lists buyer enquiries/orders raised against products this company
  // owns (company_id === my company). From there the owner accepts the order,
  // then packs & dispatches it in one or more partial shipments. ORDER_PACK is
  // the pack form that captures the sent quantity + vehicle details and lets the
  // backend auto-raise the invoice for the dispatched quantity.
  ORDER_FULFILMENT:  'OrderFulfilment',
  ORDER_PACK:        'OrderPack',
  // Documents — free-form repository (typed uploads, filter tabs, list, open,
  // delete), matching the wholesaler's Documents screen. Distinct from the KYC
  // screen at DOCUMENTS above, which is a fixed 4-slot verification flow.
  DOCUMENT_REPOSITORY: 'DocumentRepository',
  // Tools (client-side only — no backend routes)
  STONE_CALC:       'StoneCalculation',
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
