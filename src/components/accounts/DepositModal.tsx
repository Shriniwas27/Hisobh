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
import { addIncome } from '../../db/queries';
import { toPaise } from '../../utils/currency';
import { getTodayString } from '../../utils/dates';

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  accounts: Account[];
  onDepositSuccess?: () => void;
}

const COMMON_SOURCES = ['Monthly Salary', 'Client Payment', 'Freelance Work', 'Investment Return', 'Cash Deposit', 'Gift'];

export const DepositModal: React.FC<DepositModalProps> = ({
  visible,
  onClose,
  accounts,
  onDepositSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { settings, triggerRefresh } = useApp();

  const [amountStr, setAmountStr] = useState('');
  const [source, setSource] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [dateStr, setDateStr] = useState(getTodayString());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; account?: string; source?: string }>({});

  // Default to primary bank or first account
  useEffect(() => {
    if (visible && accounts.length > 0) {
      const defaultBank = accounts.find((a) => a.type === 'bank' || a.is_default === 1) || accounts[0];
      setSelectedAccountId(defaultBank.id);
      setAmountStr('');
      setSource('');
      setDateStr(getTodayString());
      setNotes('');
      setErrors({});
    }
  }, [visible, accounts]);

  const handleSave = () => {
    const newErrors: typeof errors = {};
    const paise = toPaise(amountStr);

    if (paise <= 0) {
      newErrors.amount = 'Please enter a valid deposit amount';
    }
    if (!selectedAccountId) {
      newErrors.account = 'Please select a deposit destination account';
    }
    if (!source.trim()) {
      newErrors.source = 'Please enter the payment source (e.g. Salary)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSaving(true);
      // Normalize date if needed
      let normalizedDate = dateStr;
      if (normalizedDate.includes('/')) {
        const parts = normalizedDate.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
          normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      addIncome({
        date: normalizedDate,
        source: source.trim(),
        amount: paise,
        account_id: selectedAccountId!,
        notes: notes.trim() || null,
      });

      triggerRefresh();
      if (onDepositSuccess) onDepositSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to record deposit.');
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
                <View style={[styles.iconWrap, { backgroundColor: `${colors.success}20` }]}>
                  <Ionicons name="arrow-down-circle" size={24} color={colors.success} />
                </View>
                <View>
                  <Text style={[styles.title, { color: colors.text }]}>Add Deposit / Salary</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Receive money into bank, cash, or UPI
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
              {/* Amount Input */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AMOUNT RECEIVED</Text>
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

              {/* Destination Account */}
              <View style={{ marginTop: 12 }}>
                <AccountDropdown
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={(acc) => {
                    setSelectedAccountId(acc.id);
                    if (errors.account) setErrors((prev) => ({ ...prev, account: undefined }));
                  }}
                  label="DEPOSIT INTO ACCOUNT"
                  placeholder="Select destination account"
                  error={errors.account}
                />
              </View>

              {/* Source / Description */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                PAYMENT SOURCE / SENDER
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.source ? colors.danger : colors.border,
                  },
                ]}
              >
                <TextInput
                  value={source}
                  onChangeText={(val) => {
                    setSource(val);
                    if (errors.source) setErrors((prev) => ({ ...prev, source: undefined }));
                  }}
                  placeholder="e.g. Monthly Salary, Freelance Client"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
              {errors.source && <Text style={[styles.errorText, { color: colors.danger }]}>{errors.source}</Text>}

              {/* Quick Preset Chips for Sources */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
                {COMMON_SOURCES.map((src) => (
                  <TouchableOpacity
                    key={src}
                    onPress={() => {
                      setSource(src);
                      if (errors.source) setErrors((prev) => ({ ...prev, source: undefined }));
                    }}
                    style={[styles.presetChip, { backgroundColor: colors.inputBg }]}
                  >
                    <Text style={[styles.presetText, { color: colors.textSecondary }]}>{src}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Date */}
              <View style={{ marginTop: 12 }}>
                <CompactDateInput
                  storageDate={dateStr}
                  onChangeStorageDate={setDateStr}
                  label="DATE OF DEPOSIT"
                />
              </View>

              {/* Notes */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                NOTES (OPTIONAL)
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Reference number, month, remarks..."
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
                style={[styles.saveBtn, { backgroundColor: colors.success }]}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving...' : 'Record Deposit'}
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
  presetsRow: {
    marginTop: 8,
    flexDirection: 'row',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
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
