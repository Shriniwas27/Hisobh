import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Account } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { AccountDropdown } from '../ui/AccountDropdown';
import { CompactDateInput } from '../ui/CompactDateInput';
import { addTransfer } from '../../db/queries';
import { toPaise, formatCurrency } from '../../utils/currency';
import { getTodayString } from '../../utils/dates';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  accounts: Account[];
  isAtmWithdrawalMode?: boolean;
  onTransferSuccess?: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  onClose,
  accounts,
  isAtmWithdrawalMode = false,
  onTransferSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { settings, triggerRefresh } = useApp();

  const [amountStr, setAmountStr] = useState('');
  const [fromAccountId, setFromAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [dateStr, setDateStr] = useState(getTodayString());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; from?: string; to?: string }>({});

  useEffect(() => {
    if (visible && accounts.length > 0) {
      const bankAccounts = accounts.filter((a) => a.type === 'bank');
      const fromAcc = bankAccounts[0] || accounts[0];

      // If user has multiple bank accounts, default destination to second bank account (bank-to-bank)
      // Otherwise default to the next available account
      let toAcc = null;
      if (bankAccounts.length > 1) {
        toAcc = bankAccounts[1];
      } else {
        const otherAccounts = accounts.filter((a) => a.id !== fromAcc?.id);
        toAcc = otherAccounts[0] || null;
      }

      setFromAccountId(fromAcc?.id ?? null);
      setToAccountId(toAcc?.id ?? null);
      setNotes(''); // No note by default
      setAmountStr('');
      setDateStr(getTodayString());
      setErrors({});
    }
  }, [visible, accounts]);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);

  const handleAtmPreset = () => {
    const bankAcc = accounts.find((a) => a.type === 'bank');
    const cashAcc = accounts.find((a) => a.type === 'cash');
    if (bankAcc) setFromAccountId(bankAcc.id);
    if (cashAcc) setToAccountId(cashAcc.id);
  };

  const handleSave = () => {
    const newErrors: typeof errors = {};
    const paise = toPaise(amountStr);

    if (paise <= 0) {
      newErrors.amount = 'Please enter a valid transfer amount';
    }
    if (!fromAccountId) {
      newErrors.from = 'Please select source account';
    }
    if (!toAccountId) {
      newErrors.to = 'Please select destination account';
    }
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
      newErrors.to = 'Source and destination accounts must be different';
    }
    if (fromAccount && (fromAccount.current_balance ?? 0) < paise) {
      newErrors.amount = `Insufficient balance in ${fromAccount.name} (${formatCurrency(fromAccount.current_balance ?? 0, settings)})`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSaving(true);
      let normalizedDate = dateStr;
      if (normalizedDate.includes('/')) {
        const parts = normalizedDate.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
          normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      addTransfer({
        date: normalizedDate,
        from_account_id: fromAccountId!,
        to_account_id: toAccountId!,
        amount: paise,
        notes: notes.trim() || null,
      });

      triggerRefresh();
      if (onTransferSuccess) onTransferSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to record transfer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%' }}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.titleRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.accent}20` }]}>
                  <Ionicons name="swap-horizontal" size={24} color={colors.accent} />
                </View>
                <View>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {isAtmWithdrawalMode ? 'ATM Cash Withdrawal' : 'Transfer Money'}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Move funds between bank, cash, or UPI
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
              {/* Quick Preset Buttons */}
              <View style={styles.presetsBar}>
                <TouchableOpacity
                  onPress={handleAtmPreset}
                  style={[styles.atmPresetBtn, { backgroundColor: isDark ? '#2D2D32' : '#F1EFE9' }]}
                >
                  <Ionicons name="cash-outline" size={16} color={colors.accent} />
                  <Text style={[styles.atmPresetText, { color: colors.text }]}>
                    🏧 ATM Cash Withdrawal (Bank → Cash)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AMOUNT TO TRANSFER</Text>
              <View
                style={[
                  styles.amountInputWrap,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.amount ? colors.danger : colors.border,
                  },
                ]}
              >
                <Text style={[styles.currencyPrefix, { color: colors.accent }]}>
                  {settings.currencySymbol}
                </Text>
                <TextInput
                  value={amountStr}
                  onChangeText={(val) => {
                    setAmountStr(val.replace(/[^0-9.]/g, ''));
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.amountInput, { color: colors.text }]}
                  autoFocus={true}
                />
              </View>
              {errors.amount && <Text style={[styles.errorText, { color: colors.danger }]}>{errors.amount}</Text>}

              {/* FROM Account */}
              <View style={{ marginTop: 12 }}>
                <AccountDropdown
                  accounts={accounts}
                  selectedAccountId={fromAccountId}
                  onSelectAccount={(acc) => {
                    setFromAccountId(acc.id);
                    if (errors.from) setErrors((prev) => ({ ...prev, from: undefined }));
                  }}
                  label="TRANSFER FROM (SOURCE)"
                  placeholder="Select source account"
                  error={errors.from}
                />
              </View>

              {/* Arrow Indicator */}
              <View style={styles.arrowRow}>
                <View style={[styles.arrowCircle, { backgroundColor: colors.inputBg }]}>
                  <Ionicons name="arrow-down" size={16} color={colors.accent} />
                </View>
              </View>

              {/* TO Account */}
              <View>
                <AccountDropdown
                  accounts={accounts}
                  selectedAccountId={toAccountId}
                  onSelectAccount={(acc) => {
                    setToAccountId(acc.id);
                    if (errors.to) setErrors((prev) => ({ ...prev, to: undefined }));
                  }}
                  label="TRANSFER TO (DESTINATION)"
                  placeholder="Select destination account"
                  error={errors.to}
                />
              </View>

              {/* Date */}
              <View style={{ marginTop: 12 }}>
                <CompactDateInput
                  storageDate={dateStr}
                  onChangeStorageDate={setDateStr}
                  label="TRANSFER DATE"
                />
              </View>

              {/* Notes */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                REMARKS / NOTES
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. ATM Withdrawal, Load UPI wallet"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </ScrollView>

            {/* Footer Action */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
              >
                <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>
                  {saving ? 'Processing...' : 'Complete Transfer'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  presetsBar: {
    marginBottom: 12,
  },
  atmPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  atmPresetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  arrowRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
