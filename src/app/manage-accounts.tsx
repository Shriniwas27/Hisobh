import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import {
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  getAccountTransactions,
} from '../db/queries';
import { Account, AccountType, AccountTransaction } from '../types';
import { formatCurrency, toPaise, fromPaise } from '../utils/currency';
import { formatDisplayDate } from '../utils/dates';
import { DepositModal } from '../components/accounts/DepositModal';
import { TransferModal } from '../components/accounts/TransferModal';
import { CATEGORY_PALETTE } from '../constants/categories';

const ACCOUNT_TYPES: { type: AccountType; label: string; icon: string }[] = [
  { type: 'bank', label: 'Bank Account', icon: 'business-outline' },
  { type: 'cash', label: 'Cash in Hand', icon: 'cash-outline' },
  { type: 'upi', label: 'UPI Handle', icon: 'phone-portrait-outline' },
  { type: 'wallet', label: 'Digital Wallet', icon: 'wallet-outline' },
];

export default function ManageAccountsScreen() {
  const { colors, isDark } = useTheme();
  const { settings, triggerRefresh, refreshTrigger } = useApp();
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<Account | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<AccountTransaction[]>([]);

  // Add / Edit Account Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [initialBalanceStr, setInitialBalanceStr] = useState('0');
  const [selectedColor, setSelectedColor] = useState(CATEGORY_PALETTE[2]);
  const [selectedIcon, setSelectedIcon] = useState('business-outline');
  const [linkedBankId, setLinkedBankId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deposit & Transfer Modals
  const [depositVisible, setDepositVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);

  const loadData = useCallback(() => {
    try {
      const accs = getAccounts();
      setAccounts(accs);

      if (selectedAccountForLedger) {
        const txs = getAccountTransactions(selectedAccountForLedger.id, 50);
        setLedgerTransactions(txs);
      }
    } catch (e) {
      console.error('Failed to load accounts:', e);
    }
  }, [selectedAccountForLedger]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const openAddModal = () => {
    setEditingAccount(null);
    setName('');
    setAccountType('bank');
    setAccountNumber('');
    setInitialBalanceStr('0');
    setSelectedColor(CATEGORY_PALETTE[2]);
    setSelectedIcon('business-outline');
    setLinkedBankId(null);
    setError(null);
    setModalVisible(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setAccountType(acc.type);
    setAccountNumber(acc.account_number || '');
    setInitialBalanceStr(String(fromPaise(acc.initial_balance)));
    setSelectedColor(acc.color);
    setSelectedIcon(acc.icon);
    setLinkedBankId(acc.linked_bank_id ?? null);
    setError(null);
    setModalVisible(true);
  };

  const handleSaveAccount = () => {
    if (!name.trim()) {
      setError('Please enter an account name');
      return;
    }

    try {
      const isLinkedToBank = (accountType === 'upi' || accountType === 'wallet') && linkedBankId !== null;
      const initialPaise = isLinkedToBank ? 0 : toPaise(initialBalanceStr);
      if (editingAccount) {
        updateAccount(editingAccount.id, {
          name: name.trim(),
          type: accountType,
          account_number: accountNumber.trim() || null,
          initial_balance: initialPaise,
          color: selectedColor,
          icon: selectedIcon,
          linked_bank_id: isLinkedToBank ? linkedBankId : null,
        });
      } else {
        addAccount({
          name: name.trim(),
          type: accountType,
          account_number: accountNumber.trim() || null,
          initial_balance: initialPaise,
          color: selectedColor,
          icon: selectedIcon,
          linked_bank_id: isLinkedToBank ? linkedBankId : null,
        });
      }
      triggerRefresh();
      setModalVisible(false);
    } catch (e) {
      setError('Failed to save account.');
    }
  };

  const handleDeleteAccount = (acc: Account) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${acc.name}"? This is only possible if there are no existing bills attached to it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const success = deleteAccount(acc.id);
            if (!success) {
              Alert.alert(
                'Cannot Delete',
                'This account has recorded transactions. You can rename or edit it instead.'
              );
            } else {
              triggerRefresh();
            }
          },
        },
      ]
    );
  };

  const openAccountLedger = (acc: Account) => {
    setSelectedAccountForLedger(acc);
    const txs = getAccountTransactions(acc.id, 50);
    setLedgerTransactions(txs);
  };

  const getAccountIcon = (type: AccountType, customIcon?: string) => {
    if (customIcon) return customIcon as any;
    switch (type) {
      case 'cash':
        return 'cash-outline';
      case 'bank':
        return 'business-outline';
      case 'upi':
        return 'phone-portrait-outline';
      case 'wallet':
        return 'wallet-outline';
      default:
        return 'card-outline';
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Accounts</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Action Banner */}
        <View style={styles.actionBanner}>
          <TouchableOpacity
            onPress={() => setDepositVisible(true)}
            style={[styles.actionBannerBtn, { backgroundColor: `${colors.success}18` }]}
          >
            <Ionicons name="add-circle" size={18} color={colors.success} />
            <Text style={[styles.actionBannerText, { color: colors.success }]}>
              + Deposit / Salary
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTransferVisible(true)}
            style={[styles.actionBannerBtn, { backgroundColor: `${colors.accent}18` }]}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.accent} />
            <Text style={[styles.actionBannerText, { color: colors.accent }]}>
              ⇄ Withdraw / Transfer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          YOUR BANK ACCOUNTS & WALLETS
        </Text>

        {accounts.map((acc) => {
          const isNegative = (acc.current_balance ?? 0) < 0;
          return (
            <Card key={acc.id} style={styles.accountCard}>
              <TouchableOpacity
                onPress={() => openAccountLedger(acc)}
                activeOpacity={0.8}
                style={styles.cardMain}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={[styles.accountIconWrap, { backgroundColor: `${acc.color}25` }]}>
                      <Ionicons
                        name={getAccountIcon(acc.type, acc.icon)}
                        size={22}
                        color={acc.color}
                      />
                    </View>
                    <View>
                      <View style={styles.nameRow}>
                        <Text style={[styles.accountName, { color: colors.text }]}>{acc.name}</Text>
                        <View style={[styles.typeBadge, { backgroundColor: isDark ? '#2D2D32' : '#F1EFE9' }]}>
                          <Text style={[styles.typeBadgeText, { color: colors.textSecondary }]}>
                            {acc.type.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {acc.linked_bank_name ? (
                        <View style={styles.linkedBadgeRow}>
                          <Ionicons name="link-outline" size={12} color={colors.accent} />
                          <Text style={[styles.linkedBadgeText, { color: colors.accent }]}>
                            Linked to {acc.linked_bank_name}
                          </Text>
                        </View>
                      ) : null}

                      {acc.account_number ? (
                        <Text style={[styles.accountSub, { color: colors.textMuted }]}>
                          {acc.account_number}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.cardRight}>
                    <Text
                      style={[
                        styles.accountBalance,
                        { color: isNegative ? colors.danger : colors.text },
                      ]}
                    >
                      {formatCurrency(acc.current_balance ?? 0, settings)}
                    </Text>
                    <Text style={[styles.billCountText, { color: colors.textMuted }]}>
                      {acc.bill_count || 0} bills
                    </Text>
                    {acc.linked_bank_id && (acc.total_outflow ?? 0) > 0 ? (
                      <Text style={[styles.spentViaUpiText, { color: colors.textMuted }]}>
                        {formatCurrency(acc.total_outflow ?? 0, settings)} via UPI
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Card Actions: Edit, Delete, View Transactions */}
                <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
                  <TouchableOpacity
                    onPress={() => openAccountLedger(acc)}
                    style={styles.cardFooterAction}
                  >
                    <Ionicons name="list-outline" size={14} color={colors.accent} />
                    <Text style={[styles.cardFooterText, { color: colors.accent }]}>
                      View Ledger
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.rightActions}>
                    <TouchableOpacity
                      onPress={() => openEditModal(acc)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.iconAction}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {acc.type !== 'cash' && (
                      <TouchableOpacity
                        onPress={() => handleDeleteAccount(acc)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.iconAction}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
          );
        })}
      </ScrollView>

      {/* Account Ledger Modal (Full Transaction Timeline for an Account) */}
      <Modal
        visible={!!selectedAccountForLedger}
        animationType="slide"
        onRequestClose={() => setSelectedAccountForLedger(null)}
      >
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
          {selectedAccountForLedger && (
            <View style={{ flex: 1 }}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setSelectedAccountForLedger(null)} style={styles.iconBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {selectedAccountForLedger.name}
                  </Text>
                  <Text style={[styles.headerSub, { color: colors.accent }]}>
                    {selectedAccountForLedger.linked_bank_name ? `Linked to ${selectedAccountForLedger.linked_bank_name} · ` : ''}
                    Balance: {formatCurrency(selectedAccountForLedger.current_balance ?? 0, settings)}
                  </Text>
                </View>
                <View style={{ width: 40 }} />
              </View>

              {/* Transactions List */}
              {ledgerTransactions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                    No transactions recorded for this account
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={ledgerTransactions}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ padding: 18 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isIncome = item.type === 'income' || item.type === 'transfer_in';
                    return (
                      <Card style={styles.txCard}>
                        <View style={styles.txRow}>
                          <View style={styles.txLeft}>
                            <View
                              style={[
                                styles.txIcon,
                                { backgroundColor: isIncome ? `${colors.success}20` : `${colors.danger}20` },
                              ]}
                            >
                              <Ionicons
                                name={
                                  item.type === 'income'
                                    ? 'arrow-down-circle'
                                    : item.type === 'transfer_in'
                                    ? 'swap-horizontal'
                                    : item.type === 'transfer_out'
                                    ? 'swap-horizontal'
                                    : 'arrow-up-circle'
                                }
                                size={20}
                                color={isIncome ? colors.success : colors.danger}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.txTitleRow}>
                                <Text style={[styles.txTitle, { color: colors.text }]}>{item.title}</Text>
                                {item.related_account_name ? (
                                  <View style={[styles.relatedAccountBadge, { backgroundColor: isDark ? '#2D2D32' : '#F1EFE9' }]}>
                                    <Ionicons name="phone-portrait-outline" size={10} color={colors.accent} />
                                    <Text style={[styles.relatedAccountText, { color: colors.accent }]}>
                                      via {item.related_account_name}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={[styles.txDate, { color: colors.textMuted }]}>
                                {formatDisplayDate(item.date, settings.dateFormat)}
                                {item.notes ? ` · ${item.notes}` : ''}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.txAmount,
                              { color: isIncome ? colors.success : colors.text },
                            ]}
                          >
                            {isIncome ? '+' : '-'}{formatCurrency(item.amount, settings)}
                          </Text>
                        </View>
                      </Card>
                    );
                  }}
                />
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Add / Edit Account Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalHeading, { color: colors.text }]}>
                {editingAccount ? 'Edit Account' : 'Add Bank / Cash Account'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 18 }} showsVerticalScrollIndicator={false}>
              {/* Account Type Selector */}
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>ACCOUNT TYPE</Text>
              <View style={styles.typeSelectorRow}>
                {ACCOUNT_TYPES.map((t) => {
                  const isSelected = accountType === t.type;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      onPress={() => {
                        setAccountType(t.type);
                        setSelectedIcon(t.icon);
                      }}
                      style={[
                        styles.typeSelectChip,
                        {
                          backgroundColor: isSelected ? colors.pillActive : colors.inputBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={15}
                        color={isSelected ? colors.pillActiveText : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeSelectText,
                          { color: isSelected ? colors.pillActiveText : colors.text },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Linked Bank Account (for UPI / Wallets) */}
              {(accountType === 'upi' || accountType === 'wallet') && (
                <View style={styles.linkedBankSection}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    LINKED BANK ACCOUNT
                  </Text>
                  <Text style={[styles.helperSubText, { color: colors.textMuted }]}>
                    Choose which bank account this UPI draws money from
                  </Text>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    <View style={styles.bankPickerRow}>
                      {/* Option: None (Standalone) */}
                      <TouchableOpacity
                        onPress={() => setLinkedBankId(null)}
                        style={[
                          styles.bankPickPill,
                          {
                            backgroundColor: linkedBankId === null ? colors.accent : colors.inputBg,
                            borderColor: linkedBankId === null ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name="wallet-outline"
                          size={14}
                          color={linkedBankId === null ? '#FFFFFF' : colors.text}
                        />
                        <Text
                          style={[
                            styles.bankPickText,
                            { color: linkedBankId === null ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          None (Standalone)
                        </Text>
                      </TouchableOpacity>

                      {/* Bank Accounts */}
                      {accounts
                        .filter((a) => a.type === 'bank')
                        .map((bank) => {
                          const isSelected = linkedBankId === bank.id;
                          return (
                            <TouchableOpacity
                              key={bank.id}
                              onPress={() => setLinkedBankId(bank.id)}
                              style={[
                                styles.bankPickPill,
                                {
                                  backgroundColor: isSelected ? colors.accent : colors.inputBg,
                                  borderColor: isSelected ? colors.accent : colors.border,
                                },
                              ]}
                            >
                              <Ionicons
                                name="business-outline"
                                size={14}
                                color={isSelected ? '#FFFFFF' : colors.text}
                              />
                              <Text
                                style={[
                                  styles.bankPickText,
                                  { color: isSelected ? '#FFFFFF' : colors.text },
                                ]}
                              >
                                {bank.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </ScrollView>

                  {linkedBankId !== null ? (
                    <View style={[styles.linkedInfoBox, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}30` }]}>
                      <Ionicons name="link-outline" size={16} color={colors.accent} />
                      <Text style={[styles.linkedInfoText, { color: colors.textSecondary }]}>
                        Expenses paid with this UPI handle will be debited directly from{' '}
                        <Text style={{ fontWeight: '700', color: colors.text }}>
                          {accounts.find((a) => a.id === linkedBankId)?.name || 'Bank'}
                        </Text>
                        . It will automatically reflect your bank balance.
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Account Name */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                ACCOUNT NAME
              </Text>
              <View style={[styles.textInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    setError(null);
                  }}
                  placeholder={accountType === 'upi' ? 'e.g. Google Pay, PhonePe, Paytm UPI' : 'e.g. HDFC Salary, SBI Savings, Cash in Hand'}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.text }]}
                />
              </View>

              {/* Account Number or UPI ID */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                {accountType === 'upi' ? 'UPI ID / VPA HANDLE (OPTIONAL)' : 'LAST 4 DIGITS / A/C NO (OPTIONAL)'}
              </Text>
              <View style={[styles.textInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder={accountType === 'upi' ? 'e.g. yourname@okhdfcbank' : 'e.g. 4829'}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.text }]}
                />
              </View>

              {/* Initial / Starting Balance (only for standalone / unlinked accounts) */}
              {linkedBankId === null && (
                <>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    STARTING BALANCE ({settings.currencySymbol})
                  </Text>
                  <View style={[styles.textInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      value={initialBalanceStr}
                      onChangeText={setInitialBalanceStr}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={[styles.textInput, { color: colors.text }]}
                    />
                  </View>
                </>
              )}

              {/* Color Palette */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                THEME COLOR
              </Text>
              <View style={styles.colorPalette}>
                {CATEGORY_PALETTE.map((c) => {
                  const isSelected = selectedColor === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSelectedColor(c)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c, borderColor: isSelected ? colors.text : 'transparent' },
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {error && <Text style={[styles.errorMsg, { color: colors.danger }]}>{error}</Text>}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveAccount} style={[styles.saveBtn, { backgroundColor: colors.accent }]}>
                <Text style={styles.saveBtnText}>{editingAccount ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Deposit Modal */}
      <DepositModal
        visible={depositVisible}
        onClose={() => setDepositVisible(false)}
        accounts={accounts}
        onDepositSuccess={loadData}
      />

      {/* Transfer Modal */}
      <TransferModal
        visible={transferVisible}
        onClose={() => setTransferVisible(false)}
        accounts={accounts}
        onTransferSuccess={loadData}
      />
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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBanner: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBannerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  actionBannerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  accountCard: {
    marginBottom: 12,
    padding: 0,
    overflow: 'hidden',
  },
  cardMain: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accountIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  accountSub: {
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  billCountText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  cardFooterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconAction: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  txCard: {
    marginBottom: 8,
    padding: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  typeSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  typeSelectText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textInputWrap: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    fontWeight: '600',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorMsg: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  linkedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  linkedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  spentViaUpiText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  relatedAccountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relatedAccountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  linkedBankSection: {
    marginBottom: 6,
  },
  helperSubText: {
    fontSize: 11,
    marginBottom: 6,
  },
  bankPickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  bankPickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  bankPickText: {
    fontSize: 12,
    fontWeight: '700',
  },
  linkedInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  linkedInfoText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
