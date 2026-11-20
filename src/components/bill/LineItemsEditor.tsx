import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BillItem, Category } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { toPaise, fromPaise, formatCurrency } from '../../utils/currency';

interface LineItemsEditorProps {
  items: Omit<BillItem, 'id' | 'bill_id'>[];
  onChangeItems: (items: Omit<BillItem, 'id' | 'bill_id'>[]) => void;
  onAutoSumTotal: (totalPaise: number) => void;
  categories: Category[];
  defaultCategoryId?: number;
}

export const LineItemsEditor: React.FC<LineItemsEditorProps> = ({
  items,
  onChangeItems,
  onAutoSumTotal,
  categories,
  defaultCategoryId,
}) => {
  const { colors } = useTheme();
  const { settings } = useApp();
  const [autoUpdateTotal, setAutoUpdateTotal] = useState(true);

  const calculateSum = (itemList: Omit<BillItem, 'id' | 'bill_id'>[]) => {
    return itemList.reduce((sum, item) => sum + (item.line_total || 0), 0);
  };

  const addItem = () => {
    const newItem: Omit<BillItem, 'id' | 'bill_id'> = {
      name: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      category_id: defaultCategoryId || (categories.length > 0 ? categories[0].id : null),
    };
    const updated = [...items, newItem];
    onChangeItems(updated);
  };

  const updateItem = (
    index: number,
    field: keyof Omit<BillItem, 'id' | 'bill_id'>,
    val: any
  ) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: val };

    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? Number(val) || 0 : current.quantity;
      const p = field === 'unit_price' ? toPaise(val) : current.unit_price;
      current.quantity = q;
      current.unit_price = p;
      current.line_total = Math.round(q * p);
    }

    updated[index] = current;
    onChangeItems(updated);

    if (autoUpdateTotal) {
      const sum = calculateSum(updated);
      if (sum > 0) {
        onAutoSumTotal(sum);
      }
    }
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChangeItems(updated);
    if (autoUpdateTotal && updated.length > 0) {
      onAutoSumTotal(calculateSum(updated));
    }
  };

  return (
    <View style={styles.container}>
      {/* Items Section Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="list-outline" size={18} color={colors.accent} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Bill Items & Category Mapping ({items.length})
          </Text>
        </View>
        {items.length > 0 && (
          <Text style={[styles.itemsTotalBadge, { color: colors.accent }]}>
            Sum: {formatCurrency(calculateSum(items), settings)}
          </Text>
        )}
      </View>

      <Text style={[styles.helperNotice, { color: colors.textSecondary }]}>
        Add individual items or groups of items. Each item can be assigned to its own category!
      </Text>

      {items.length > 0 && (
        <View style={styles.autoCalcRow}>
          <Text style={[styles.autoCalcLabel, { color: colors.textSecondary }]}>
            Auto-update total bill amount from items sum
          </Text>
          <Switch
            value={autoUpdateTotal}
            onValueChange={setAutoUpdateTotal}
            trackColor={{ false: colors.inputBg, true: colors.accent }}
          />
        </View>
      )}

      {/* Items List */}
      {items.map((item, idx) => {
        const itemCategory = categories.find((c) => c.id === item.category_id);

        return (
          <View
            key={idx}
            style={[
              styles.itemCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Top row: Name & Delete */}
            <View style={styles.itemTopRow}>
              <TextInput
                placeholder={`Item ${idx + 1} (e.g. Milk & Eggs, Medicines)`}
                placeholderTextColor={colors.textMuted}
                value={item.name}
                onChangeText={(val) => updateItem(idx, 'name', val)}
                style={[styles.nameInput, { color: colors.text }]}
              />
              <TouchableOpacity
                onPress={() => removeItem(idx)}
                style={styles.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>

            {/* Category Selector for this Item */}
            <View style={styles.categorySelectSection}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                ITEM CATEGORY:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
              >
                {categories.map((c) => {
                  const isSelected = item.category_id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => updateItem(idx, 'category_id', c.id)}
                      style={[
                        styles.catMiniChip,
                        {
                          backgroundColor: isSelected ? colors.pillActive : colors.inputBg,
                        },
                      ]}
                    >
                      <View style={[styles.catMiniDot, { backgroundColor: c.color }]} />
                      <Text
                        style={[
                          styles.catMiniText,
                          {
                            color: isSelected ? colors.pillActiveText : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Price & Quantity Row */}
            <View style={styles.itemDetailsRow}>
              <View style={styles.detailColSmall}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Qty</Text>
                <TextInput
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  value={item.quantity ? String(item.quantity) : ''}
                  onChangeText={(val) => updateItem(idx, 'quantity', val)}
                  keyboardType="numeric"
                  style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.detailColMedium}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Price ({settings.currencySymbol})
                </Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={item.unit_price ? String(fromPaise(item.unit_price)) : ''}
                  onChangeText={(val) => updateItem(idx, 'unit_price', val)}
                  keyboardType="decimal-pad"
                  style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.detailColTotal}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Line Total</Text>
                <Text style={[styles.lineTotalText, { color: colors.text }]}>
                  {formatCurrency(item.line_total || 0, settings)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Add Item / Group Button */}
      <TouchableOpacity
        onPress={addItem}
        activeOpacity={0.7}
        style={[styles.addButton, { borderColor: colors.accent }]}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
        <Text style={[styles.addButtonText, { color: colors.accent }]}>
          + Add Item / Group to Bill
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemsTotalBadge: {
    fontSize: 13,
    fontWeight: '700',
  },
  helperNotice: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  autoCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoCalcLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  deleteBtn: {
    padding: 4,
  },
  categorySelectSection: {
    marginBottom: 12,
  },
  catMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 5,
  },
  catMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catMiniText: {
    fontSize: 11,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailColSmall: {
    width: 60,
  },
  detailColMedium: {
    flex: 1,
  },
  detailColTotal: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 80,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  smallInput: {
    height: 38,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  lineTotalText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 6,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
