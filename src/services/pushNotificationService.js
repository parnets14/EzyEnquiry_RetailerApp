/**
 * notificationService.js
 *
 * Handles all FCM push notification logic:
 *  - Permission request (Android 13+)
 *  - Notification channel creation (Notifee)
 *  - FCM token fetch + registration with backend
 *  - Foreground message display (Notifee)
 *  - Background / quit-state message handler (registered in index.js)
 *  - Notification tap → navigation (handled in App.jsx via navigationRef)
 */

import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import { notificationService } from './notificationService';
import { getFcmToken, setFcmToken, removeFcmToken } from '../utils/storage';

// ─── Channel IDs ─────────────────────────────────────────────────────────────
export const CHANNELS = {
  DEFAULT:  'ezyenquiry_default',
  ORDERS:   'ezyenquiry_orders',
  ENQUIRY:  'ezyenquiry_enquiry',
};

// ─── Create Android notification channels ────────────────────────────────────
export async function createNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id:         CHANNELS.DEFAULT,
    name:       'General',
    importance: AndroidImportance.HIGH,
    vibration:  true,
    sound:      'default',
    visibility: AndroidVisibility.PUBLIC,
  });
  await notifee.createChannel({
    id:         CHANNELS.ORDERS,
    name:       'Orders & Dispatch',
    importance: AndroidImportance.HIGH,
    vibration:  true,
    sound:      'default',
    visibility: AndroidVisibility.PUBLIC,
  });
  await notifee.createChannel({
    id:         CHANNELS.ENQUIRY,
    name:       'Enquiries & Offers',
    importance: AndroidImportance.HIGH,
    vibration:  true,
    sound:      'default',
    visibility: AndroidVisibility.PUBLIC,
  });
}

// ─── Request permission (Android 13+ / iOS) ──────────────────────────────────
export async function requestPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  return enabled;
}

// ─── Get FCM token and save to backend ───────────────────────────────────────
export async function registerFcmToken() {
  try {
    // Ensure the app is registered with APNs on iOS (no-op on Android)
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    if (!token) return;

    // Avoid re-registering the same token
    const stored = await getFcmToken();
    if (stored === token) return;

    await notificationService.saveFCMToken(token);
    await setFcmToken(token);
  } catch (err) {
    console.warn('[FCM] Token registration failed:', err.message);
  }
}

// ─── Clear FCM token on logout ────────────────────────────────────────────────
export async function clearFcmToken() {
  try {
    await removeFcmToken();
  } catch { /* silent */ }
}

// ─── Pick the right channel for a message type ───────────────────────────────
function channelForType(type = '') {
  if (type.includes('order') || type.includes('dispatch') || type.includes('delivery'))
    return CHANNELS.ORDERS;
  if (type.includes('enquiry') || type.includes('offer'))
    return CHANNELS.ENQUIRY;
  return CHANNELS.DEFAULT;
}

// ─── Display a notification via Notifee ──────────────────────────────────────
export async function displayNotification(remoteMessage) {
  const { notification = {}, data = {} } = remoteMessage;
  const title   = notification.title || data.title  || 'EzyEnquiry';
  const body    = notification.body  || data.body   || '';
  const type    = data.type || '';
  const channel = channelForType(type);

  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId:   channel,
      smallIcon:   'ic_launcher',
      importance:  AndroidImportance.HIGH,
      pressAction: { id: 'default' },
      sound:       'default',
    },
  });
}

// ─── Foreground message listener (call inside App.jsx useEffect) ──────────────
export function setupForegroundListener() {
  // FCM foreground message → display via Notifee
  const unsubscribeFCM = messaging().onMessage(async remoteMessage => {
    await displayNotification(remoteMessage);
  });

  // Notifee foreground event → handle press
  const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      handleNotificationPress(detail.notification?.data);
    }
  });

  return () => {
    unsubscribeFCM();
    unsubscribeNotifee();
  };
}

// ─── Navigation on notification press ────────────────────────────────────────
// navigationRef is set in AppNavigator and passed here so we can navigate
// from outside React tree (background tap, quit-state tap).
let _navigationRef = null;
export function setNavigationRef(ref) { _navigationRef = ref; }

export function handleNotificationPress(data = {}) {
  if (!_navigationRef?.isReady?.()) return;
  const type = (data?.type || '').toLowerCase();

  if ((type.includes('enquiry') || type.includes('offer')) && data?.reference_id) {
    _navigationRef.navigate('ENQUIRY_DETAILS', { enquiryId: data.reference_id });
  } else if (type.includes('order') && data?.reference_id) {
    _navigationRef.navigate('ORDER_DETAILS', { orderId: data.reference_id });
  } else if (type.includes('invoice') && data?.reference_id) {
    _navigationRef.navigate('INVOICE_DETAILS', { invoiceId: data.reference_id });
  } else {
    _navigationRef.navigate('NOTIFICATIONS');
  }
}

// ─── Background + quit-state handler (register in index.js) ──────────────────
// Called by Firebase when a data-only message arrives while app is background/quit.
// For notification messages, the system tray handles display automatically.
export async function backgroundMessageHandler(remoteMessage) {
  await createNotificationChannels();
  // Only display if it's a data-only message (no notification block)
  if (!remoteMessage.notification) {
    await displayNotification(remoteMessage);
  }
}

// ─── Notification-open handler (quit state tap) ───────────────────────────────
// Call once on app launch in App.jsx to handle taps from quit state.
export async function handleInitialNotification() {
  // FCM quit-state tap
  const initial = await messaging().getInitialNotification();
  if (initial?.data) {
    // Delay slightly to ensure navigation is ready
    setTimeout(() => handleNotificationPress(initial.data), 1000);
  }

  // Notifee quit-state tap
  const notifeeInitial = await notifee.getInitialNotification();
  if (notifeeInitial?.notification?.data) {
    setTimeout(() => handleNotificationPress(notifeeInitial.notification.data), 1000);
  }
}
