import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { CurrencyCode } from '../../types';

interface WelcomeScreenProps {
  onComplete?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const { colors, isDark } = useTheme();
  const { profile, updateProfile, settings, updateSettings, security, updateSecurity, setOnboarded } = useApp();
  const { height: screenHeight } = useWindowDimensions();

  // Top static hero height based on screen size
  const topHeroHeight = screenHeight < 720 ? 250 : screenHeight < 860 ? 285 : 320;

  // Mode: 'get_started' | 'login'
  const [mode, setMode] = useState<'get_started' | 'login'>('get_started');

  // Form states
  const [userName, setUserName] = useState(profile.name || '');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(settings.currencyCode || 'INR');
  const [pinSetup, setPinSetup] = useState('');
  const [confirmPinSetup, setConfirmPinSetup] = useState('');

  // Login states
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0.4)).current;
  const sheetTranslateY = useRef(new Animated.Value(60)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance animation for the bottom sheet
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Continuous floating animation for mascot
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Continuous twinkle animation for sparkles
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0.3,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim, sparkleAnim, sheetOpacity, sheetTranslateY]);

  const finishWelcome = () => {
    setOnboarded(true);
    if (onComplete) {
      onComplete();
    }
  };

  const handleCreateAccountAndPin = () => {
    const trimmed = userName.trim();
    if (!trimmed) {
      Alert.alert('Name Required', 'Please enter your name to personalize your ledger.');
      return;
    }

    if (pinSetup.length !== 4) {
      Alert.alert('4-Digit PIN Required', 'Please create a 4-digit security PIN to log into Hisobh.');
      return;
    }

    if (confirmPinSetup.length !== 4) {
      Alert.alert('Confirm PIN', 'Please re-enter your 4-digit PIN in the confirmation box.');
      return;
    }

    if (pinSetup !== confirmPinSetup) {
      Alert.alert('PIN Mismatch', 'The PINs you entered do not match. Please try again.');
      return;
    }

    // Save profile details
    updateProfile({
      name: trimmed,
      email: 'Personal Ledger',
    });

    // Save currency choice
    const symbolMap: Record<CurrencyCode, string> = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      AED: 'د.إ',
      CAD: '$',
      AUD: '$',
    };
    updateSettings({
      currencyCode: selectedCurrency,
      currencySymbol: symbolMap[selectedCurrency] || '₹',
      useIndianGrouping: selectedCurrency === 'INR',
    });

    // Enable security PIN lock
    updateSecurity({
      isLockEnabled: true,
      pinCode: pinSetup,
    });

    // Complete first-time onboarding
    finishWelcome();
  };

  const handleBiometricLogin = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometrics Not Available',
          'Biometric sensor is not available or no fingerprint/face is registered on this device.'
        );
        return;
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Hisobh',
        fallbackLabel: 'Use PIN',
      });

      if (res.success) {
        finishWelcome();
      }
    } catch (e) {
      console.warn('Biometric error on login:', e);
    }
  };

  const handlePinLogin = () => {
    if (security.isLockEnabled && security.pinCode) {
      if (loginPin === security.pinCode) {
        finishWelcome();
      } else {
        setLoginError('Incorrect PIN. Please try again.');
        setLoginPin('');
      }
    } else {
      finishWelcome();
    }
  };

  return (
    <View style={[styles.rootContainer, { backgroundColor: isDark ? '#141210' : '#FF9C26' }]}>
      <StatusBar style="light" />

      {/* ======================================================== */}
      {/* 1. TOP STATIC PART (Fixed in place with animations)     */}
      {/* ======================================================== */}
      <View
        style={[
          styles.staticTopSection,
          {
            height: topHeroHeight,
            backgroundColor: isDark ? '#1C150E' : '#FF9A24',
          },
        ]}
      >
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.staticTopSafe}>
          {/* Top Bar with Brand Pill (No Explore as Guest) */}
          <View style={styles.topBar}>
            <View style={styles.topBrandPill}>
              <Ionicons name="sparkles" size={13} color="#FFFFFF" />
              <Text style={styles.topBrandPillText}>HISOBH</Text>
            </View>
          </View>

          {/* Centered Animated Mascot Hero & Brand Header */}
          <View style={styles.heroCenter}>
            <Animated.View
              style={[
                styles.logoOuterWrapper,
                { transform: [{ translateY: floatAnim }] },
              ]}
            >
              {/* Twinkling Sparkles */}
              <Animated.View style={[styles.sparkleLeft, { opacity: sparkleAnim }]}>
                <Ionicons name="sparkles" size={17} color="#FFE6A3" />
              </Animated.View>
              <Animated.View style={[styles.sparkleRight, { opacity: sparkleAnim }]}>
                <Ionicons name="sparkles" size={19} color="#FFE6A3" />
              </Animated.View>

              <View style={styles.logoSquircle}>
                <Image
                  source={require('../../../assets/hisobh-logo.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>

            {/* Title with Gold Underline */}
            <View style={styles.brandTitleWrap}>
              <Text style={styles.brandTitleText}>Hisobh</Text>
              <View style={styles.goldUnderline} />
            </View>

            <Text style={styles.brandTaglineText}>
              Your Friendly Personal Ledger
            </Text>
          </View>
        </SafeAreaView>
      </View>

      {/* ======================================================== */}
      {/* 2. BOTTOM MOVABLE PART (Curved Animated Sheet Below)    */}
      {/* ======================================================== */}
      <Animated.View
        style={[
          styles.movableBottomSection,
          {
            backgroundColor: isDark ? '#17171C' : '#FFFFFF',
            shadowColor: isDark ? '#000000' : '#8C5611',
            opacity: sheetOpacity,
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        {/* Grabber indicator handle */}
        <View style={styles.grabberContainer}>
          <View style={[styles.grabberPill, { backgroundColor: isDark ? '#33333E' : '#E2DDD4' }]} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.sheetScrollView}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* ----------------- FIRST-TIME SETUP MODE ----------------- */}
            {mode === 'get_started' ? (
              <View style={styles.sheetInnerContainer}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    Get Started with Hisobh
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                    Set up your account & PIN for first-time access.
                  </Text>
                </View>

                {/* 1. Name Input */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>YOUR NAME</Text>
                  <TextInput
                    value={userName}
                    onChangeText={setUserName}
                    placeholder="Enter your name (e.g. Shrinidhi)"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.fieldInput,
                      {
                        backgroundColor: isDark ? '#22222A' : '#FAF8F4',
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                </View>

                {/* 2. Primary Currency */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PRIMARY CURRENCY</Text>
                  <View style={styles.currencyPillsRow}>
                    {[
                      { code: 'INR', symbol: '₹', label: 'INR (₹)' },
                      { code: 'USD', symbol: '$', label: 'USD ($)' },
                      { code: 'EUR', symbol: '€', label: 'EUR (€)' },
                      { code: 'GBP', symbol: '£', label: 'GBP (£)' },
                    ].map((cur) => {
                      const active = selectedCurrency === cur.code;
                      return (
                        <TouchableOpacity
                          key={cur.code}
                          activeOpacity={0.8}
                          onPress={() => setSelectedCurrency(cur.code as CurrencyCode)}
                          style={[
                            styles.currencyPill,
                            {
                              backgroundColor: active ? '#E58A2B' : isDark ? '#22222A' : '#FAF8F4',
                              borderColor: active ? '#E58A2B' : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.currencyPillText,
                              { color: active ? '#FFFFFF' : colors.text },
                              active && { fontWeight: '700' },
                            ]}
                          >
                            {cur.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Create 4-Digit Security PIN */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    CREATE 4-DIGIT PIN (REQUIRED TO LOG IN)
                  </Text>
                  <TextInput
                    value={pinSetup}
                    onChangeText={(val) => setPinSetup(val.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="••••"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    style={[
                      styles.fieldInput,
                      {
                        backgroundColor: isDark ? '#22222A' : '#FAF8F4',
                        borderColor: colors.border,
                        color: colors.text,
                        textAlign: 'center',
                        letterSpacing: 14,
                        fontSize: 22,
                        fontWeight: '800',
                      },
                    ]}
                  />
                </View>

                {/* 4. Confirm 4-Digit Security PIN */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    CONFIRM 4-DIGIT PIN
                  </Text>
                  <TextInput
                    value={confirmPinSetup}
                    onChangeText={(val) => setConfirmPinSetup(val.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="••••"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    style={[
                      styles.fieldInput,
                      {
                        backgroundColor: isDark ? '#22222A' : '#FAF8F4',
                        borderColor: colors.border,
                        color: colors.text,
                        textAlign: 'center',
                        letterSpacing: 14,
                        fontSize: 22,
                        fontWeight: '800',
                      },
                    ]}
                  />
                  <Text style={[styles.pinHintText, { color: colors.textMuted }]}>
                    You will use this PIN to log in each time you open the app.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtonsArea}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleCreateAccountAndPin}
                    style={[styles.primaryActionBtn, { backgroundColor: '#E58A2B' }]}
                  >
                    <Text style={styles.primaryActionText}>Create Account & Set PIN</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setMode('login')}
                    style={styles.switchModeBtn}
                  >
                    <Text style={[styles.switchModeText, { color: colors.accent }]}>
                      Already created account? Log In with PIN →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ----------------- DIRECT LOGIN MODE ----------------- */
              <View style={styles.sheetInnerContainer}>
                <TouchableOpacity
                  onPress={() => setMode('get_started')}
                  style={styles.sheetBackRow}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                  <Text style={[styles.sheetBackText, { color: colors.text }]}>Back to Account Setup</Text>
                </TouchableOpacity>

                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Welcome Back</Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                    {profile.name ? `Account: ${profile.name}` : 'Enter your 4-digit PIN to sign in'}
                  </Text>
                </View>

                {/* 4-Digit PIN Input */}
                <View style={styles.loginPinContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                    ENTER YOUR 4-DIGIT PIN
                  </Text>
                  <TextInput
                    value={loginPin}
                    onChangeText={(val) => {
                      setLoginPin(val.replace(/[^0-9]/g, '').slice(0, 4));
                      setLoginError('');
                    }}
                    placeholder="••••"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    autoFocus
                    style={[
                      styles.fieldInput,
                      {
                        backgroundColor: isDark ? '#22222A' : '#FAF8F4',
                        borderColor: loginError ? colors.danger : colors.border,
                        color: colors.text,
                        textAlign: 'center',
                        letterSpacing: 14,
                        fontSize: 22,
                        height: 52,
                        fontWeight: '800',
                      },
                    ]}
                  />
                  {loginError ? (
                    <Text style={[styles.loginErrorText, { color: colors.danger }]}>{loginError}</Text>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handlePinLogin}
                    style={[styles.primaryActionBtn, { backgroundColor: '#E58A2B', marginTop: 16 }]}
                  >
                    <Text style={styles.primaryActionText}>Unlock Hisobh</Text>
                    <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Biometric Option */}
                  {security.isBiometricEnabled && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleBiometricLogin}
                      style={[
                        styles.biometricBtn,
                        { borderColor: colors.border, backgroundColor: isDark ? '#22222A' : '#FAF8F4' },
                      ]}
                    >
                      <Ionicons name="finger-print" size={22} color="#E58A2B" />
                      <Text style={[styles.biometricBtnText, { color: colors.text }]}>
                        Scan Fingerprint / Face ID
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  // 1. TOP STATIC PART
  staticTopSection: {
    width: '100%',
    overflow: 'hidden',
  },
  staticTopSafe: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 22,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  topBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
  },
  topBrandPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  heroCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  logoOuterWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  sparkleLeft: {
    position: 'absolute',
    top: -4,
    left: -14,
    zIndex: 2,
  },
  sparkleRight: {
    position: 'absolute',
    bottom: 2,
    right: -14,
    zIndex: 2,
  },
  logoSquircle: {
    width: 96,
    height: 96,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitleWrap: {
    alignItems: 'center',
  },
  brandTitleText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  goldUnderline: {
    width: 50,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#FFE182',
    marginTop: 2,
  },
  brandTaglineText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  // 2. BOTTOM MOVABLE PART
  movableBottomSection: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
    marginTop: -16,
  },
  grabberContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabberPill: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
  },
  sheetScrollView: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 36,
  },
  sheetInnerContainer: {
    flex: 1,
  },
  sheetHeader: {
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  fieldInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  currencyPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyPill: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinHintText: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  actionButtonsArea: {
    gap: 12,
    marginTop: 6,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#E58A2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchModeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  sheetBackText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  loginPinContainer: {
    marginTop: 10,
  },
  loginErrorText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
  },
  biometricBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
