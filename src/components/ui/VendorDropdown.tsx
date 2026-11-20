import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/currency';

export interface VendorItem {
  vendor: string;
  count: number;
  total_spent: number;
  last_date?: string;
}

interface VendorDropdownProps {
  vendors: VendorItem[];
  selectedVendor: string | null;
  onSelectVendor: (vendor: string | null) => void;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
  compact?: boolean;
  containerStyle?: ViewStyle;
}

export const VendorDropdown: React.FC<VendorDropdownProps> = ({
  vendors,
  selectedVendor,
  onSelectVendor,
  label,
  placeholder = 'Select Vendor...',
  allowClear = false,
  compact = false,
  containerStyle,
}) => {
  const { colors, isDark } = useTheme();
  const { settings } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = useMemo(() => {
    if (!selectedVendor) return null;
    return vendors.find((v) => v.vendor.toLowerCase() === selectedVendor.toLowerCase()) || {
      vendor: selectedVendor,
      count: 0,
      total_spent: 0,
    };
  }, [vendors, selectedVendor]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors;
    const q = searchQuery.toLowerCase().trim();
    return vendors.filter((v) => v.vendor.toLowerCase().includes(q));
  }, [vendors, searchQuery]);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}

      {/* Trigger Button */}
      <TouchableOpacity
        onPress={() => {
          setSearchQuery('');
          setModalVisible(true);
        }}
        activeOpacity={0.75}
        style={[
          styles.dropdownButton,
          compact && styles.dropdownButtonCompact,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.triggerLeft}>
          {selectedItem ? (
            <View style={styles.selectedRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${colors.accent}18` },
                ]}
              >
                <Ionicons name="storefront-outline" size={16} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.selectedText, { color: colors.text }]}>
                  {selectedItem.vendor}
                </Text>
                {selectedItem.count > 0 && (
                  <Text style={[styles.selectedSubtext, { color: colors.textMuted }]}>
                    {selectedItem.count} {selectedItem.count === 1 ? 'bill' : 'bills'} • {formatCurrency(selectedItem.total_spent, settings)}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.placeholderRow}>
              <Ionicons name="storefront-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                {placeholder}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.triggerRight}>
          {allowClear && selectedItem && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onSelectVendor(null);
              }}
              style={styles.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Dropdown Modal */}
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
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Choose Vendor Ledger
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Inspect complete spending history by store or payee
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.closeIconCircle, { backgroundColor: colors.inputBg }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search vendor name..."
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.text }]}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Vendor List */}
            <FlatList
              data={filteredVendors}
              keyExtractor={(item) => item.vendor}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="search-outline" size={28} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No vendors match "{searchQuery}"
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedVendor?.toLowerCase() === item.vendor.toLowerCase();

                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSelectVendor(item.vendor);
                      setModalVisible(false);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.vendorOption,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#2A2723'
                            : '#FFF7ED'
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
                          styles.vendorIconBox,
                          { backgroundColor: `${colors.accent}18` },
                        ]}
                      >
                        <Ionicons name="business" size={15} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionName, { color: colors.text }]}>
                          {item.vendor}
                        </Text>
                        <Text style={[styles.optionSub, { color: colors.textMuted }]}>
                          {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.optionRight}>
                      <Text style={[styles.optionSpend, { color: colors.text }]}>
                        {formatCurrency(item.total_spent, settings)}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                      )}
                    </View>
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
    width: '100%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  dropdownButtonCompact: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectedSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    padding: 2,
  },
  chevronWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  vendorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  vendorIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionName: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 11,
    marginTop: 1,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionSpend: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
});

