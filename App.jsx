import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import {
  setupForegroundListener,
  handleInitialNotification,
} from './src/services/pushNotificationService';

const App = () => {
  useEffect(() => {
    // Handle notification tap when app was in quit state
    handleInitialNotification();

    // Listen for foreground FCM messages + Notifee press events
    const unsubscribe = setupForegroundListener();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
