import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as StoreProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { store } from './store/store';
import AppNavigator from './components/navigation/AppNavigator';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import ErrorBoundary from './components/common/ErrorBoundary';
import { theme } from './assets/theme';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StoreProvider store={store}>
          <PaperProvider theme={theme}>
            <ThemeProvider>
              <AuthProvider>
                <NavigationContainer>
                  <StatusBar style="auto" />
                  <AppNavigator />
                </NavigationContainer>
              </AuthProvider>
            </ThemeProvider>
          </PaperProvider>
        </StoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}