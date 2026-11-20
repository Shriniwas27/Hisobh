import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface CategoryDropdownProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  label?: string;
  placeholder?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  allowClear?: boolean;
  compact?: boolean;
  containerStyle?: ViewStyle;
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  label,
  placeholder = 'Select Category',
  includeAllOption = false,
  allOptionLabel = 'All Categories',
  allowClear = false,
  compact = false,
  containerStyle,
}) => {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const isAllSelected = selectedCategoryId === null && includeAllOption;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}

      {/* Dropdown Trigger Button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
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
          {isAllSelected ? (
            <View style={styles.selectedRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDark ? '#27272A' : '#F2EFE9' },
                ]}
              >
                <Ionicons name="layers-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={[styles.selectedText, { color: colors.text }]}>
                {allOptionLabel}
              </Text>
            </View>
          ) : selectedCategory ? (
            <View style={styles.selectedRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${selectedCategory.color}18` },
                ]}
              >
                <Ionicons
                  name={(selectedCategory.icon || 'folder-outline') as any}
                  size={16}
                  color={selectedCategory.color}
                />
              </View>
              <Text style={[styles.selectedText, { color: colors.text }]}>
                {selectedCategory.name}
              </Text>
            </View>
          ) : (
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              {placeholder}
            </Text>
          )}
        </View>

        <View style={styles.triggerRight}>
          {allowClear && selectedCategory && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onSelectCategory(null);
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

      {/* Dropdown Selection Modal */}
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
                  Choose Category
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {includeAllOption ? 'Filter transactions by category' : 'Categorize your expenditure'}
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

            {/* Category Options List */}
            <FlatList
              data={includeAllOption ? [{ id: -1 } as any, ...categories] : categories}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                if (item.id === -1) {
                  // "All Categories" option
                  const isSelected = selectedCategoryId === null;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        onSelectCategory(null);
                        setModalVisible(false);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.categoryOption,
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
                            styles.optionIconCircle,
                            { backgroundColor: isDark ? '#2D2D32' : '#F2EFE9' },
                          ]}
                        >
                          <Ionicons
                            name="layers-outline"
                            size={18}
                            color={colors.textSecondary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.optionName,
                            {
                              color: isSelected ? colors.text : colors.textSecondary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {allOptionLabel}
                        </Text>
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
                }

                // Normal category item
                const isSelected = item.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSelectCategory(item.id);
                      setModalVisible(false);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.categoryOption,
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
                          styles.optionIconCircle,
                          {
                            backgroundColor: `${item.color}18`,
                          },
                        ]}
                      >
                        <Ionicons
                          name={(item.icon || 'folder-outline') as any}
                          size={18}
                          color={item.color}
                        />
                      </View>
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
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  dropdownButtonCompact: {
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 14,
  },
  clearBtn: {
    padding: 2,
  },
  chevronWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
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
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 7,
    borderWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionName: {
    fontSize: 14,
  },
});
