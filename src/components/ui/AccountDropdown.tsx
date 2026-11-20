import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Account, AccountType } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/currency';

interface AccountDropdownProps {
  accounts: Account[];
  selectedAccountId: number | null | undefined;
  onSelectAccount: (account: Account) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

export const AccountDropdown: React.FC<AccountDropdownProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  label = 'PAY FROM / ACCOUNT',
  placeholder = 'Select Bank Account or Cash',
  error,
}) => {
  const { colors, isDark } = useTheme();
  const { settings } = useApp();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

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

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'cash':
        return 'CASH';
      case 'bank':
        return 'BANK';
      case 'upi':
        return 'UPI';
      case 'wallet':
        return 'WALLET';
      default:
        return 'ACCOUNT';
    }
  };

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}

      {/* Main Dropdown Button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.75}
        style={[
          styles.dropdownBtn,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <View style={styles.btnLeft}>
          {selectedAccount ? (
            <>
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: `${selectedAccount.color}20` },
                ]}
              >
                <Ionicons
                  name={getAccountIcon(selectedAccount.type, selectedAccount.icon)}
                  size={18}
                  color={selectedAccount.color}
                />
              </View>
              <View style={styles.btnInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.btnTitle, { color: colors.text }]} numberOfLines={1}>
                    {selectedAccount.name}
                  </Text>
                  <View
                    style={[
                      styles.typeTag,
                      { backgroundColor: isDark ? '#2D2D32' : '#F1EFE9' },
                    ]}
                  >
                    <Text style={[styles.typeTagText, { color: colors.textSecondary }]}>
                      {getAccountTypeLabel(selectedAccount.type)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.btnBalance, { color: colors.textMuted }]}>
                  Balance: {formatCurrency(selectedAccount.current_balance ?? 0, settings)}
                  {selectedAccount.linked_bank_name ? ` · via ${selectedAccount.linked_bank_name}` : ''}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.placeholderRow}>
              <Ionicons name="wallet-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                {placeholder}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {/* Account Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Account
                </Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  Choose Bank, UPI, or Cash source
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Account List */}
            <FlatList
              data={accounts}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedAccountId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSelectAccount(item);
                      setModalVisible(false);
                    }}
                    style={[
                      styles.accountItem,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#2A2925'
                            : '#FBF4E8'
                          : 'transparent',
                        borderBottomColor: colors.borderLight,
                      },
                    ]}
                  >
                    <View style={styles.itemLeft}>
                      <View
                        style={[
                          styles.itemIconBadge,
                          { backgroundColor: `${item.color}20` },
                        ]}
                      >
                        <Ionicons
                          name={getAccountIcon(item.type, item.icon)}
                          size={20}
                          color={item.color}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={styles.itemNameRow}>
                          <Text
                            style={[
                              styles.itemName,
                              {
                                color: colors.text,
                                fontWeight: isSelected ? '700' : '600',
                              },
                            ]}
                          >
                            {item.name}
                          </Text>
                          <View
                            style={[
                              styles.typeTag,
                              { backgroundColor: isDark ? '#2D2D32' : '#F1EFE9' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.typeTagText,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {getAccountTypeLabel(item.type)}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.itemBalance, { color: colors.textMuted }]}>
                          Balance: {formatCurrency(item.current_balance ?? 0, settings)}
                          {item.linked_bank_name ? ` · via ${item.linked_bank_name}` : item.account_number ? ` · ${item.account_number}` : ''}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.accent}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnBalance: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '75%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 10,
  },
  itemIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 15,
  },
  itemBalance: {
    fontSize: 12,
    marginTop: 3,
  },
});
