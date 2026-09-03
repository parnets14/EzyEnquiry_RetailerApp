import { Colors } from '../theme/colors';

export const getEnquiryStatusStyle = (status) => {
  switch (status) {
    case 'New':
      return { color: Colors.enquiryNew, backgroundColor: Colors.enquiryNewBg };
    case 'Viewed':
      return { color: Colors.enquiryViewed, backgroundColor: Colors.enquiryViewedBg };
    case 'Replied':
      return { color: Colors.enquiryReplied, backgroundColor: Colors.enquiryRepliedBg };
    case 'Negotiation':
      return { color: Colors.enquiryNegotiation, backgroundColor: Colors.enquiryNegotiationBg };
    case 'Confirmed':
    case 'Accepted':
      return { color: Colors.enquiryConfirmed, backgroundColor: Colors.enquiryConfirmedBg };
    case 'Cancelled':
    case 'Rejected':
      return { color: Colors.enquiryCancelled, backgroundColor: Colors.enquiryCancelledBg };
    default:
      return { color: Colors.textSecondary, backgroundColor: Colors.border };
  }
};

export const getOrderStatusStyle = (status) => {
  switch (status) {
    case 'New':
      return { color: Colors.orderNew, backgroundColor: Colors.orderNewBg };
    case 'Accepted':
      return { color: Colors.orderAccepted, backgroundColor: Colors.orderAcceptedBg };
    case 'Processing':
      return { color: Colors.orderProcessing, backgroundColor: Colors.orderProcessingBg };
    case 'Ready':
    case 'ReadyForDispatch':
      return { color: Colors.orderReady, backgroundColor: Colors.orderReadyBg };
    case 'Dispatched':
      return { color: Colors.orderDispatched, backgroundColor: Colors.orderDispatchedBg };
    case 'InTransit':
      return { color: Colors.primary, backgroundColor: Colors.primaryBg };
    case 'Delivered':
      return { color: Colors.orderDelivered, backgroundColor: Colors.orderDeliveredBg };
    case 'Cancelled':
      return { color: Colors.error, backgroundColor: Colors.errorBg };
    default:
      return { color: Colors.textSecondary, backgroundColor: Colors.border };
  }
};

// Quotation lifecycle label (built on top of enquiry statuses)
export const getQuotationStatusLabel = (status) => {
  switch (status) {
    case 'New': return 'Sent · Awaiting Wholesaler';
    case 'Viewed': return 'Viewed by Wholesaler';
    case 'Replied': return 'Quoted';
    case 'Negotiation': return 'In Negotiation';
    case 'Confirmed': return 'Confirmed → Sales Order';
    case 'Cancelled': return 'Cancelled';
    default: return status || '—';
  }
};

// Payment status → badge style
export const getPaymentStatusStyle = (status) => {
  switch (status) {
    case 'Paid':
      return { color: Colors.success, backgroundColor: Colors.successBg };
    case 'Partial':
    case 'Partially Paid':
      return { color: Colors.warning, backgroundColor: Colors.warningBg };
    case 'Pending':
    case 'Unpaid':
    case 'Overdue':
      return { color: Colors.error, backgroundColor: Colors.errorBg };
    default:
      return { color: Colors.textSecondary, backgroundColor: Colors.border };
  }
};

export const getAvailabilityStyle = (availability) => {
  switch (availability) {
    case 'In Stock':
      return { color: Colors.success, backgroundColor: Colors.successBg };
    case 'Limited Stock':
      return { color: Colors.warning, backgroundColor: Colors.warningBg };
    case 'Out of Stock':
      return { color: Colors.error, backgroundColor: Colors.errorBg };
    default:
      return { color: Colors.textSecondary, backgroundColor: Colors.border };
  }
};

export const getNotificationIcon = (type) => {
  switch (type) {
    case 'enquiry': return 'document-text-outline';
    case 'order': return 'cube-outline';
    case 'delivery': return 'car-outline';
    case 'invoice': return 'receipt-outline';
    case 'payment': return 'card-outline';
    case 'system': return 'information-circle-outline';
    default: return 'notifications-outline';
  }
};
