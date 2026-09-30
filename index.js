/**
 * EzyEnquiry – Retailer App
 * @format
 */

import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import messaging from '@react-native-firebase/messaging';
import { backgroundMessageHandler } from './src/services/pushNotificationService';
import App from './App';
import { name as appName } from './app.json';

// Enable native screens for better performance
enableScreens();

// ─── FCM Background / Quit-state handler ─────────────────────────────────────
// This headless task runs even when the app is killed.
// Must be registered BEFORE AppRegistry.registerComponent.
messaging().setBackgroundMessageHandler(backgroundMessageHandler);

AppRegistry.registerComponent(appName, () => App);
