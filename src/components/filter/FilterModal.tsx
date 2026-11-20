import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BillFilter, Category, PaymentMethod, Account } from '../../types';
import { PAYMENT_METHODS } from '../../constants/categories';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { toPaise, fromPaise, formatCurrency } from '../../utils/currency';
import { getFilteredBillsSummary, getAccounts } from '../../db/queries';
import { getDateRangeForPreset } from '../../utils/dates';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  accounts?: Account[];
  currentFilter: BillFilter;
  onApplyFilter: (filter: BillFilter) => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  categories,
  accounts,
  currentFilter,
  onApplyFilter,
}) => {
  const { colors, isDark } = useTheme();
  const { settings } = useApp();

  const [localFilter, setLocalFilter] = useState<BillFilter>(currentFilter);
  const [minAmountStr, setMinAmountStr] = useState<string>(
    currentFilter.minAmount ? String(fromPaise(currentFilter.minAmount)) : ''
  );
  const [maxAmountStr, setMaxAmountStr] = useState<string>(
    currentFilter.maxAmount ? String(fromPaise(currentFilter.maxAmount)) : ''
  );
  const [datePreset, setDatePreset] = useState<string>('custom');

  const availableAccounts = accounts && accounts.length > 0 ? accounts : getAccounts();

  useEffect(() => {
    setLocalFilter(currentFilter);
    setMinAmountStr(currentFilter.minAmount ? String(fromPaise(currentFilter.minAmount)) : '');
    setMaxAmountStr(currentFilter.maxAmount ? String(fromPaise(currentFilter.maxAmount)) : '');
  }, [currentFilter, visible]);

  // Compute live preview of matching bills and total amount
  const liveSummary = getFilteredBillsSummary(localFilter);

  const toggleCategory = (catId: number) => {
    const existing = localFilter.categoryIds || [];
    const updated = existing.includes(catId)
      ? existing.filter((id) => id !== catId)
      : [...existing, catId];
    setLocalFilter({ ...localFilter, categoryIds: updated });
  };

  const toggleAccount = (accId: number) => {
    const existing = localFilter.accountIds || [];
    const updated = existing.includes(accId)
      ? existing.filter((id) => id !== accId)
      : [...existing, accId];
    setLocalFilter({ ...localFilter, accountIds: updated });
  };

  const togglePaymentMethod = (pm: PaymentMethod) => {
    const existing = localFilter.paymentMethods || [];
    const updated = existing.includes(pm)
      ? existing.filter((p) => p !== pm)
      : [...existing, pm];
    setLocalFilter({ ...localFilter, paymentMethods: updated });
  };

  const applyPreset = (preset: 'this_month' | 'last_month' | 'this_year' | 'all_time') => {
    setDatePreset(preset);
    const range = getDateRangeForPreset(preset);
    setLocalFilter({
      ...localFilter,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  };

  const handleApply = () => {
    const finalFilter: BillFilter = {
      ...localFilter,
      minAmount: minAmountStr ? toPaise(minAmountStr) : undefined,
      maxAmount: maxAmountStr ? toPaise(maxAmountStr) : undefined,
    };
    onApplyFilter(finalFilter);
    onClose();
  };

  const handleReset = () => {
    setLocalFilter({});
    setMinAmountStr('');
    setMaxAmountStr('');
    setDatePreset('all_time');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Filters</Text>
              <Text style={[styles.summarySubtitle, { color: colors.textSecondary }]}>
                {liveSummary.count} matching · {formatCurrency(liveSummary.total_amount, settings)}
              </Text>
            </View>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Text style={[styles.resetText, { color: colors.accent }]}>Reset All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Quick Date Presets */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATE RANGE</Text>
            <View style={styles.chipRow}>
              {[
                { label: 'All Time', value: 'all_time' },
                { label: 'This Month', value: 'this_month' },
                { label: 'Last Month', value: 'last_month' },
                { label: 'This Year', value: 'this_year' },
              ].map((p) => {
                const isSelected = datePreset === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => applyPreset(p.value as any)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.pillActive : colors.pillInactive,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.pillActiveText : colors.pillInactiveText },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Has Bill Image Toggle */}
            <View style={[styles.toggleRow, { borderColor: colors.borderLight }]}>
              <View>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Attached Receipt Photo Only</Text>
                <Text style={[styles.toggleSub, { color: colors.textMuted }]}>
                  Show only bills with image proof
                </Text>
              </View>
              <Switch
                value={Boolean(localFilter.hasImagesOnly)}
                onValueChange={(val) => setLocalFilter({ ...localFilter, hasImagesOnly: val })}
                trackColor={{ false: colors.inputBg, true: colors.accent }}
              />
            </View>

            {/* Categories Multi-Select */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CATEGORIES</Text>
            <View style={styles.chipRow}>
              {categories.map((cat) => {
                const isSelected = localFilter.categoryIds?.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => toggleCategory(cat.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#2A2723'
                            : '#FAF7F2'
                          : isDark
                          ? '#1E1E22'
                          : '#FFFFFF',
                        borderColor: isSelected ? colors.accent : colors.borderLight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: cat.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected ? colors.text : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Accounts, Bank & UPI Handles */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                ACCOUNTS & PAYMENT SOURCES
              </Text>
              {localFilter.accountIds && localFilter.accountIds.length > 0 && (
                <TouchableOpacity onPress={() => setLocalFilter({ ...localFilter, accountIds: undefined })}>
                  <Text style={[styles.clearLink, { color: colors.accent }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.chipRow}>
              {availableAccounts.map((acc) => {
                const isSelected = localFilter.accountIds?.includes(acc.id);
                const defaultIcon =
                  acc.type === 'bank'
                    ? 'business-outline'
                    : acc.type === 'cash'
                    ? 'cash-outline'
                    : acc.type === 'upi'
                    ? 'phone-portrait-outline'
                    : 'wallet-outline';
                const typeLabel =
                  acc.type === 'bank'
                    ? 'Bank'
                    : acc.type === 'cash'
                    ? 'Cash'
                    : acc.type === 'upi'
                    ? 'UPI'
                    : 'Wallet';

                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => toggleAccount(acc.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.accountChip,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#2A2723'
                            : '#FFF7ED'
                          : isDark
                          ? '#1E1E22'
                          : '#FFFFFF',
                        borderColor: isSelected ? (acc.color || colors.accent) : colors.borderLight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.accountIconBox,
                        { backgroundColor: acc.color ? `${acc.color}25` : `${colors.accent}20` },
                      ]}
                    >
                      <Ionicons
                        name={(acc.icon as any) || defaultIcon}
                        size={14}
                        color={acc.color || colors.accent}
                      />
                    </View>
                    <Text
                      style={[
                        styles.accountNameText,
                        {
                          color: isSelected ? colors.text : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {acc.name}
                    </Text>
                    <View
                      style={[
                        styles.typeBadge,
                        {
                          backgroundColor: isDark ? '#2C2C30' : '#F1F1F3',
                        },
                      ]}
                    >
                      <Text style={[styles.typeBadgeText, { color: colors.textMuted }]}>
                        {typeLabel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount Range */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AMOUNT RANGE</Text>
            <View style={styles.amountInputRow}>
              <View style={[styles.amountInputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>{settings.currencySymbol}</Text>
                <TextInput
                  value={minAmountStr}
                  onChangeText={setMinAmountStr}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.amountInput, { color: colors.text }]}
                />
              </View>
              <Text style={{ color: colors.textMuted }}>to</Text>
              <View style={[styles.amountInputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>{settings.currencySymbol}</Text>
                <TextInput
                  value={maxAmountStr}
                  onChangeText={setMaxAmountStr}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.amountInput, { color: colors.text }]}
                />
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleApply}
              activeOpacity={0.8}
              style={[styles.applyButton, { backgroundColor: colors.pillActive }]}
            >
              <Text style={[styles.applyButtonText, { color: colors.pillActiveText }]}>
                Show {liveSummary.count} Results
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  summarySubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resetButton: {
    padding: 6,
  },
  scrollContent: {
    maxHeight: 460,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginTop: 10,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  amountInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  clearLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 7,
  },
  accountIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountNameText: {
    fontSize: 13,
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 16,
  },
  applyButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

