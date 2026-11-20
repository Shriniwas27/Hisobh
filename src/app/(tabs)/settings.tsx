import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { CurrencyDropdown } from '../../components/ui/CurrencyDropdown';
import { getAllBillsForExport, getTotalBillsCount, clearAllBillsData } from '../../db/queries';
import { exportBillsToCSV, createFullBackupZip } from '../../utils/exportImport';

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSettings, profile, security, triggerRefresh } = useApp();
  const router = useRouter();

  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  // 1. Export CSV
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const bills = getAllBillsForExport();
      if (bills.length === 0) {
        Alert.alert('No Data', 'There are no bills to export yet.');
        return;
      }
      const success = await exportBillsToCSV(bills, settings);
      if (success) {
        // Native share sheet was opened
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message || 'Could not export CSV file.');
    } finally {
      setExporting(false);
    }
  };

  // 2. Full ZIP Backup
  const handleFullBackup = async () => {
    try {
      setBackingUp(true);
      const total = getTotalBillsCount();
      const success = await createFullBackupZip(total);
      if (success) {
        // Native share sheet was opened
      }
    } catch (e: any) {
      Alert.alert('Backup Failed', e?.message || 'Could not create backup zip.');
    } finally {
      setBackingUp(false);
    }
  };

  // 3. Clear All Data
  const handleClearAll = () => {
    Alert.alert(
      'Reset All Bills?',
      'This will permanently delete all bills, line items, and receipt records from this device. Categories and app settings will be preserved.\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            clearAllBillsData();
            triggerRefresh();
            Alert.alert('Cleared', 'All bills have been removed.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Preferences, Categories & Data Management
          </Text>
        </View>

        {/* User Profile & App Security Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          USER PROFILE & SECURITY
        </Text>
        <Card style={styles.settingsCard}>
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
            style={styles.profileRow}
          >
            <View style={styles.profileRowLeft}>
              <View
                style={[
                  styles.profileAvatarCircle,
                  { backgroundColor: `${colors.accent}18`, borderColor: colors.border },
                ]}
              >
                {profile.avatarUri ? (
                  <Image source={{ uri: profile.avatarUri }} style={styles.profileAvatarImg} />
                ) : (
                  <Ionicons name="person" size={24} color={colors.accent} />
                )}
              </View>
              <View>
                <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.profileSub, { color: colors.textSecondary }]}>
                  {security.isLockEnabled ? '🔒 App Lock Active (PIN/Bio)' : '🔓 App Lock Disabled'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Currency & Formatting Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          CURRENCY & FORMATTING
        </Text>
        <Card style={styles.settingsCard}>
          <CurrencyDropdown
            label="Currency"
            selectedSymbol={settings.currencySymbol}
            onSelectCurrency={(c) =>
              updateSettings({
                currencySymbol: c.symbol,
                currencyCode: c.code as any,
                useIndianGrouping: c.symbol === '₹',
              })
            }
          />

          <View style={[styles.settingRow, { borderTopColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingRowTitle, { color: colors.text }]}>
                Indian Digit Grouping (Lakhs/Crores)
              </Text>
              <Text style={[styles.settingRowSub, { color: colors.textMuted }]}>
                e.g. {settings.currencySymbol}1,23,456.00 vs {settings.currencySymbol}123,456.00
              </Text>
            </View>
            <Switch
              value={settings.useIndianGrouping}
              onValueChange={(val) => updateSettings({ useIndianGrouping: val })}
              trackColor={{ false: colors.inputBg, true: colors.accent }}
            />
          </View>

          <View style={[styles.settingRow, { borderTopColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingRowTitle, { color: colors.text }]}>Date Format</Text>
              <Text style={[styles.settingRowSub, { color: colors.textMuted }]}>
                Default: DD/MM/YYYY
              </Text>
            </View>
            <View style={[styles.lockedBadge, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.lockedBadgeText, { color: colors.textSecondary }]}>DD/MM/YYYY</Text>
            </View>
          </View>
        </Card>

        {/* Banking & Accounts Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          BANKING & ACCOUNTS
        </Text>
        <Card style={styles.settingsCard}>
          <TouchableOpacity
            onPress={() => router.push('/manage-accounts')}
            activeOpacity={0.7}
            style={styles.navRow}
          >
            <View style={styles.navRowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.accent}18` }]}>
                <Ionicons name="wallet-outline" size={20} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.navRowTitle, { color: colors.text }]}>
                  Manage Bank Accounts & Wallets
                </Text>
                <Text style={[styles.navRowSub, { color: colors.textSecondary }]}>
                  Configure bank accounts, UPI IDs, cash in hand, and starting balances
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Categories Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>CATEGORIES</Text>
        <Card style={styles.settingsCard}>
          <TouchableOpacity
            onPress={() => router.push('/manage-categories')}
            activeOpacity={0.7}
            style={styles.navRow}
          >
            <View style={styles.navRowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="pricetags-outline" size={20} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.navRowTitle, { color: colors.text }]}>
                  Manage Categories
                </Text>
                <Text style={[styles.navRowSub, { color: colors.textSecondary }]}>
                  Add, recolor, rename, or delete spending categories
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Appearance Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>APPEARANCE</Text>
        <Card style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingRowTitle, { color: colors.text }]}>Dark Mode</Text>
              <Text style={[styles.settingRowSub, { color: colors.textMuted }]}>
                {isDark ? 'Dark theme enabled' : 'Light warm theme enabled'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(val) => updateSettings({ theme: val ? 'dark' : 'light' })}
              trackColor={{ false: colors.inputBg, true: colors.accent }}
            />
          </View>
        </Card>

        {/* Data & Backup Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          DATA BACKUP & EXPORT
        </Text>
        <Card style={styles.settingsCard}>
          {/* CSV Export */}
          <TouchableOpacity
            onPress={handleExportCSV}
            activeOpacity={0.7}
            style={styles.navRow}
            disabled={exporting}
          >
            <View style={styles.navRowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.infoLight }]}>
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.info} />
                ) : (
                  <Ionicons name="document-text-outline" size={20} color={colors.info} />
                )}
              </View>
              <View>
                <Text style={[styles.navRowTitle, { color: colors.text }]}>Export to CSV</Text>
                <Text style={[styles.navRowSub, { color: colors.textSecondary }]}>
                  Share complete bills ledger spreadsheet
                </Text>
              </View>
            </View>
            <Ionicons name="share-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Full ZIP Backup */}
          <TouchableOpacity
            onPress={handleFullBackup}
            activeOpacity={0.7}
            style={[styles.navRow, { borderTopWidth: 1, borderTopColor: colors.borderLight }]}
            disabled={backingUp}
          >
            <View style={styles.navRowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.successLight }]}>
                {backingUp ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <Ionicons name="archive-outline" size={20} color={colors.success} />
                )}
              </View>
              <View>
                <Text style={[styles.navRowTitle, { color: colors.text }]}>
                  Full Backup (Database + Images)
                </Text>
                <Text style={[styles.navRowSub, { color: colors.textSecondary }]}>
                  Export entire ledger and bill photos into a ZIP archive
                </Text>
              </View>
            </View>
            <Ionicons name="arrow-up-circle-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>

        </Card>

        {/* Maintenance Tools */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          DATA MAINTENANCE
        </Text>
        <Card style={styles.settingsCard}>
          <TouchableOpacity
            onPress={handleClearAll}
            activeOpacity={0.7}
            style={styles.navRow}
          >
            <View style={styles.navRowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </View>
              <View>
                <Text style={[styles.navRowTitle, { color: colors.danger }]}>
                  Clear All Bills Data
                </Text>
                <Text style={[styles.navRowSub, { color: colors.textSecondary }]}>
                  Reset ledger while keeping categories and settings
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Card>

        <View style={styles.footerNote}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Expense Ledger v1.0.0 · 100% Offline SQLite
          </Text>
        </View>
      </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingsCard: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  profileRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileSub: {
    fontSize: 12,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  settingRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  lockedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  navRowSub: {
    fontSize: 12,
    marginTop: 2,
    paddingRight: 10,
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

