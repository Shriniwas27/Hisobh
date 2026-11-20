import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

export const AppLockOverlay: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { profile, security, unlock } = useApp();

  const [enteredPin, setEnteredPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);

  // Check biometric capability
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (isMounted) {
          setHasBiometrics(hardware && enrolled && security.isBiometricEnabled);
        }
      } catch {
        if (isMounted) setHasBiometrics(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [security.isBiometricEnabled]);

  // Trigger biometric prompt
  const promptBiometric = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert(
          'Fingerprint Sensor Not Available',
          'This device does not have biometric hardware. Please use your 4-digit PIN to unlock.'
        );
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert(
          'No Fingerprint Registered',
          'Please register a fingerprint in your device Settings > Security > Fingerprint, or enter your 4-digit PIN.'
        );
        return;
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm fingerprint to unlock Hisobh',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (res.success) {
        unlock();
      } else {
        if (res.error !== 'user_cancel' && res.error !== 'system_cancel' && res.error !== 'app_cancel') {
          setErrorMessage('Fingerprint not recognized. Enter PIN to unlock.');
        }
      }
    } catch (e: any) {
      console.warn('Biometric auth error:', e);
    }
  }, [unlock]);

  // Prompt biometric automatically on mount after a short delay if enabled
  useEffect(() => {
    if (security.isBiometricEnabled) {
      const timer = setTimeout(() => {
        promptBiometric();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [security.isBiometricEnabled, promptBiometric]);

  // Handle keypad digit press
  const handleDigit = (digit: string) => {
    if (enteredPin.length >= 4) return;
    setErrorMessage('');
    const newPin = enteredPin + digit;
    setEnteredPin(newPin);

    if (newPin.length === 4) {
      if (newPin === security.pinCode) {
        // Correct PIN
        unlock();
        setEnteredPin('');
      } else {
        // Wrong PIN
        setErrorMessage('Incorrect PIN. Please try again.');
        setTimeout(() => {
          setEnteredPin('');
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        {/* User Profile Avatar & Greeting */}
        <View style={styles.profileSection}>
          <View style={[styles.avatarCircle, { backgroundColor: `${colors.accent}18`, borderColor: colors.border }]}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={36} color={colors.accent} />
            )}
          </View>
          <Text style={[styles.greetingName, { color: colors.text }]}>
            {profile.name}
          </Text>
          <Text style={[styles.lockSubtitle, { color: colors.textSecondary }]}>
            Hisobh is locked • Enter PIN
          </Text>
        </View>

        {/* 4-Digit Pin Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = enteredPin.length > idx;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isFilled ? colors.text : 'transparent',
                    borderColor: isFilled ? colors.text : colors.border,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Error message */}
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {errorMessage || ' '}
        </Text>

        {/* Keypad */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['bio', '0', 'del'],
          ].map((row, rowIdx) => (
            <View key={rowIdx} style={styles.keypadRow}>
              {row.map((item, colIdx) => {
                if (item === 'bio') {
                  if (!hasBiometrics) {
                    return <View key={colIdx} style={styles.keypadBtn} />;
                  }

                  return (
                    <TouchableOpacity
                      key={colIdx}
                      onPress={promptBiometric}
                      style={[
                        styles.keypadDigitBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.borderLight,
                        },
                      ]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="finger-print" size={26} color={colors.accent} />
                    </TouchableOpacity>
                  );
                }

                if (item === 'del') {
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      onPress={handleDelete}
                      style={styles.keypadBtn}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={colIdx}
                    onPress={() => handleDigit(item)}
                    style={[
                      styles.keypadDigitBtn,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.borderLight,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.keypadDigitText, { color: colors.text }]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  lockSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 10,
    marginBottom: 16,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    minHeight: 18,
    marginBottom: 18,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keypadBtn: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadDigitBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  keypadDigitText: {
    fontSize: 24,
    fontWeight: '700',
  },
});
