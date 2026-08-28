import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

const App = () => (
  <SafeAreaProvider>
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  </SafeAreaProvider>
);

export default App;
