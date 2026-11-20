import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { getTotalBillsCount, getCategories } from '../db/queries';
import { saveImagePermanently } from '../utils/fileStorage';

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { profile, updateProfile, security, updateSecurity, logout } = useApp();
  const router = useRouter();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatarUri);

  // Security states
  const [isLockEnabled, setIsLockEnabled] = useState(security.isLockEnabled);
  const [isBioEnabled, setIsBioEnabled] = useState(security.isBiometricEnabled);
  const [pinCode, setPinCode] = useState<string | null>(security.pinCode);

  // Biometrics hardware capability
  const [hasBioHardware, setHasBioHardware] = useState(false);
  const [bioName, setBioName] = useState('Fingerprint / Face ID');

  // Change PIN modal
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Stats
  const [totalBills, setTotalBills] = useState(0);
  const [totalCats, setTotalCats] = useState(0);

  useEffect(() => {
    try {
      setTotalBills(getTotalBillsCount());
      setTotalCats(getCategories().length);
    } catch (e) {
      console.warn('Failed to load profile stats:', e);
    }

    async function checkBio() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBioHardware(hasHardware && isEnrolled);

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBioName('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBioName('Fingerprint Scanner');
        }
      } catch (e) {
        console.warn('Bio check error:', e);
      }
    }
    checkBio();
  }, []);

  // Pick avatar photo
  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Photo library access is needed to select an avatar.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const permanent = await saveImagePermanently(res.assets[0].uri);
        setAvatarUri(res.assets[0].uri);
        updateProfile({ avatarUri: res.assets[0].uri });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not select photo.');
    }
  };

  // Toggle App Lock
  const handleToggleLock = (enabled: boolean) => {
    if (enabled && !pinCode) {
      // Must set a PIN first before enabling
      setIsPinModalVisible(true);
      return;
    }

    setIsLockEnabled(enabled);
    updateSecurity({ isLockEnabled: enabled });
  };

  // Toggle Biometric
  const handleToggleBio = async (enabled: boolean) => {
    if (enabled) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware) {
          Alert.alert(
            'Biometric Sensor Notice',
            'No biometric hardware sensor detected on this device. PIN will remain your primary unlock method.'
          );
        } else if (!isEnrolled) {
          Alert.alert(
            'Enroll Fingerprint',
            'No fingerprint is currently registered in your phone Settings. Please add a fingerprint in Android / iOS Settings to use it.'
          );
        }
      } catch (e) {
        console.warn('Bio check failed:', e);
      }
    }
    setIsBioEnabled(enabled);
    updateSecurity({ isBiometricEnabled: enabled });
  };

  // Save PIN
  const handleSavePin = () => {
    if (newPin.length !== 4) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setPinCode(newPin);
    setIsLockEnabled(true);
    updateSecurity({ pinCode: newPin, isLockEnabled: true });
    setIsPinModalVisible(false);
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    Alert.alert('Security Enabled', 'Your 4-digit PIN has been set successfully.');
  };

  // Save profile name/email
  const handleSaveProfile = () => {
    updateProfile({
      name: name.trim() || 'User',
      email: email.trim(),
    });
    Alert.alert('Profile Saved', 'Your profile details have been updated.');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile & Security</Text>
        <TouchableOpacity onPress={handleSaveProfile} style={styles.saveBtn}>
          <Text style={[styles.saveBtnText, { color: colors.accent }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Avatar & Personal Info Card */}
        <Card style={styles.card}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarWrap}>
              <View
                style={[
                  styles.avatarCircle,
                  { backgroundColor: `${colors.accent}18`, borderColor: colors.border },
                ]}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={44} color={colors.accent} />
                )}
              </View>
              <View style={[styles.cameraBadge, { backgroundColor: colors.accent }]}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              Tap to change profile picture
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>YOUR NAME</Text>
            <View style={[styles.textInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.borderLight }]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, { color: colors.text }]}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ACCOUNT TITLE</Text>
            <View style={[styles.textInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.borderLight }]}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. Personal Ledger"
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, { color: colors.text }]}
              />
            </View>
          </View>
        </Card>

        {/* 2. Security & Biometric Lock Card */}
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>App Lock & Security</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Secure your financial ledger with PIN or biometrics
          </Text>

          {/* Master Lock Toggle */}
          <View style={[styles.toggleRow, { borderBottomColor: colors.borderLight }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Enable App Lock</Text>
              <Text style={[styles.toggleSub, { color: colors.textMuted }]}>
                Require PIN or biometric authentication to open
              </Text>
            </View>
            <Switch
              value={isLockEnabled}
              onValueChange={handleToggleLock}
              trackColor={{ false: colors.inputBg, true: colors.accent }}
            />
          </View>

          {/* Biometric Toggle - Always accessible when App Lock is active */}
          {isLockEnabled && (
            <View style={[styles.toggleRow, { borderBottomColor: colors.borderLight }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Unlock with Fingerprint
                </Text>
                <Text style={[styles.toggleSub, { color: colors.textMuted }]}>
                  {hasBioHardware ? `${bioName} sensor ready` : 'Touch device fingerprint sensor to unlock'}
                </Text>
              </View>
              <Switch
                value={isBioEnabled}
                onValueChange={handleToggleBio}
                trackColor={{ false: colors.inputBg, true: colors.accent }}
              />
            </View>
          )}

          {/* Change PIN Action */}
          {isLockEnabled && (
            <TouchableOpacity
              onPress={() => {
                setNewPin('');
                setConfirmPin('');
                setPinError('');
                setIsPinModalVisible(true);
              }}
              activeOpacity={0.7}
              style={[styles.actionRow, { borderBottomColor: colors.borderLight }]}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="key-outline" size={20} color={colors.accent} />
                <View>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>
                    {pinCode ? 'Change 4-Digit PIN' : 'Set 4-Digit PIN'}
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                    {pinCode ? 'PIN is configured' : 'Required for app lock'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </Card>

        {/* 3. Account Ledger Summary */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>
            Ledger Statistics
          </Text>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{totalBills}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Bills</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{totalCats}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Categories</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>Offline</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Storage</Text>
            </View>
          </View>
        </Card>

        {/* 4. Hisobh Account */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>
            Hisobh Account
          </Text>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Log Out / Switch Account',
                'This will return to the Hisobh Welcome & Sign-In screen. Your offline data remains completely safe.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: () => {
                      logout();
                      router.replace('/welcome');
                    },
                  },
                ]
              );
            }}
            style={styles.actionRow}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <View>
                <Text style={[styles.actionTitle, { color: colors.danger }]}>
                  Log Out / Switch Account
                </Text>
                <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                  Sign out and return to the main gate
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Change PIN Modal */}
      <Modal
        visible={isPinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPinModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.pinModalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.pinModalHeader}>
              <Text style={[styles.pinModalTitle, { color: colors.text }]}>Set 4-Digit PIN</Text>
              <TouchableOpacity onPress={() => setIsPinModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.pinModalSub, { color: colors.textSecondary }]}>
              Enter a 4-digit PIN to secure your Expense Ledger.
            </Text>

            {pinError ? (
              <Text style={[styles.pinErrorText, { color: colors.danger }]}>{pinError}</Text>
            ) : null}

            <View style={{ marginBottom: 14 }}>
              <Text style={[styles.pinInputLabel, { color: colors.textMuted }]}>NEW PIN</Text>
              <TextInput
                value={newPin}
                onChangeText={setNewPin}
                placeholder="4 digits"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                style={[
                  styles.pinInputField,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.pinInputLabel, { color: colors.textMuted }]}>CONFIRM PIN</Text>
              <TextInput
                value={confirmPin}
                onChangeText={setConfirmPin}
                placeholder="Re-enter 4 digits"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                style={[
                  styles.pinInputField,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
              />
            </View>

            <TouchableOpacity
              onPress={handleSavePin}
              style={[styles.savePinBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.savePinBtnText}>Save PIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    marginBottom: 16,
    padding: 18,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: {
    fontSize: 12,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  textInputWrap: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 12,
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  lockNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
    marginTop: 14,
  },
  lockNowText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pinModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 22,
    paddingBottom: 40,
  },
  pinModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  pinModalSub: {
    fontSize: 13,
    marginBottom: 16,
  },
  pinErrorText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  pinInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pinInputField: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 8,
    textAlign: 'center',
  },
  savePinBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePinBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

