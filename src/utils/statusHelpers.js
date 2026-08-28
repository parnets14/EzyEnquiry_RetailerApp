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
      return { color: Colors.enquiryConfirmed, backgroundColor: Colors.enquiryConfirmedBg };
    case 'Cancelled':
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
      return { color: Colors.orderReady, backgroundColor: Colors.orderReadyBg };
    case 'Dispatched':
      return { color: Colors.orderDispatched, backgroundColor: Colors.orderDispatchedBg };
    case 'Delivered':
      return { color: Colors.orderDelivered, backgroundColor: Colors.orderDeliveredBg };
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
    case 'system': return 'information-circle-outline';
    default: return 'notifications-outline';
  }
};
