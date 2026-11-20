import React, { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../context/AppContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { getDatabase } from '../db/database';
import { ensureBillsDirectoryExists } from '../utils/fileStorage';
import { AppLockOverlay } from '../components/auth/AppLockOverlay';
import { AnimatedSplashScreen } from '../components/common/AnimatedSplashScreen';
import { syncAllRemindersWithNotifications } from '../services/notificationService';

// Suppress known Expo Go notifications limitations in development
LogBox.ignoreLogs([
  '[expo-notifications]',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'Set notification channel warning',
  'ExpoNotificationChannelManager.setNotificationChannelAsync',
]);

// Filter out Expo Go notification warnings from Metro terminal console
if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';
    if (
      firstArg.includes('[expo-notifications]') ||
      firstArg.includes('expo-notifications') ||
      firstArg.includes('ExpoNotificationChannelManager') ||
      firstArg.includes('Set notification channel warning')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

function RootNavigation() {
  const { colors, isDark } = useTheme();
  const { isLocked, security, isOnboarded } = useApp();
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isOnboarded && !showSplash) {
      router.replace('/welcome');
    }
  }, [isOnboarded, showSplash]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-bill"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="bill/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="edit-bill/[id]"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="manage-categories" options={{ headerShown: false }} />
        <Stack.Screen name="manage-accounts" options={{ headerShown: false }} />
        <Stack.Screen name="category-bills" options={{ headerShown: false }} />
        <Stack.Screen name="vendor-bills" options={{ headerShown: false }} />
        <Stack.Screen name="reminders" options={{ headerShown: false }} />
      </Stack>

      {/* Full App Security Lock Screen */}
      {isLocked && security.isLockEnabled && security.pinCode ? (
        <AppLockOverlay />
      ) : null}

      {/* App Opening Animation */}
      {showSplash && (
        <AnimatedSplashScreen onAnimationComplete={() => setShowSplash(false)} />
      )}
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize SQLite database and file directories on app startup
    try {
      getDatabase();
      ensureBillsDirectoryExists();
      syncAllRemindersWithNotifications().catch((e) => console.warn('Sync reminders error:', e));
    } catch (e) {
      console.error('Failed to initialize database or storage:', e);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider>
          <RootNavigation />
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
