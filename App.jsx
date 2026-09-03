import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

const App = () => (
  <SafeAreaProvider>
    {/* App-wide status bar: white background, dark (black) icons/text */}
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  </SafeAreaProvider>
);

export default App;
