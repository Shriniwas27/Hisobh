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
import { CurrencyCode } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export interface CurrencyItem {
  symbol: string;
  code: CurrencyCode;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyItem[] = [
  { symbol: '₹', code: 'INR', name: 'Indian Rupee (INR)' },
  { symbol: '$', code: 'USD', name: 'US Dollar (USD)' },
  { symbol: '€', code: 'EUR', name: 'Euro (EUR)' },
  { symbol: '£', code: 'GBP', name: 'British Pound (GBP)' },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen (JPY)' },
  { symbol: 'AED', code: 'AED', name: 'UAE Dirham (AED)' },
  { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar (CAD)' },
  { symbol: 'A$', code: 'AUD', name: 'Australian Dollar (AUD)' },
];

interface CurrencyDropdownProps {
  selectedSymbol: string;
  onSelectCurrency: (currency: CurrencyItem) => void;
  label?: string;
}

export const CurrencyDropdown: React.FC<CurrencyDropdownProps> = ({
  selectedSymbol,
  onSelectCurrency,
  label,
}) => {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedItem =
    SUPPORTED_CURRENCIES.find((c) => c.symbol === selectedSymbol) ||
    SUPPORTED_CURRENCIES[0];

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}

      {/* Dropdown Button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.75}
        style={[
          styles.dropdownBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.btnLeft}>
          <View
            style={[
              styles.symbolCircle,
              { backgroundColor: isDark ? '#2D2D32' : '#F2EFE9' },
            ]}
          >
            <Text style={[styles.symbolCircleText, { color: colors.accent }]}>
              {selectedItem.symbol}
            </Text>
          </View>
          <View>
            <Text style={[styles.btnTitle, { color: colors.text }]}>
              {selectedItem.name}
            </Text>
            <Text style={[styles.btnCode, { color: colors.textMuted }]}>
              Code: {selectedItem.code}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Currency Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Currency
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Choose your primary currency symbol
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.closeIconCircle, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
              data={SUPPORTED_CURRENCIES}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.symbol === selectedSymbol;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSelectCurrency(item);
                      setModalVisible(false);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.optionItem,
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
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.optionSymbolCircle,
                          {
                            backgroundColor: isSelected
                              ? `${colors.accent}20`
                              : isDark
                              ? '#2A2A2F'
                              : '#F4F2EC',
                          },
                        ]}
                      >
                        <Text style={[styles.optionSymbolText, { color: colors.accent }]}>
                          {item.symbol}
                        </Text>
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.optionName,
                            {
                              color: colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text style={[styles.optionCode, { color: colors.textMuted }]}>
                          {item.code}
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
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  btnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  symbolCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolCircleText: {
    fontSize: 16,
    fontWeight: '800',
  },
  btnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnCode: {
    fontSize: 11,
    marginTop: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    maxHeight: '75%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionSymbolCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSymbolText: {
    fontSize: 16,
    fontWeight: '800',
  },
  optionName: {
    fontSize: 14,
  },
  optionCode: {
    fontSize: 11,
    marginTop: 1,
  },
});

