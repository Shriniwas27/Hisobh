import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BillItem, Category } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { CategoryDropdown } from '../ui/CategoryDropdown';
import { toPaise, fromPaise, formatCurrency } from '../../utils/currency';

export interface ItemEntry {
  name: string;
  quantity: number;
  unit_price: number; // in paise
  line_total: number; // in paise
}

export interface CategoryTagGroup {
  id: string; // local unique id for react keys
  category_id: number;
  items: ItemEntry[];
}

interface CategoryGroupedItemsEditorProps {
  initialItems: Omit<BillItem, 'id' | 'bill_id'>[];
  onChangeFlatItems: (items: Omit<BillItem, 'id' | 'bill_id'>[]) => void;
  onAutoSumTotal: (totalPaise: number) => void;
  categories: Category[];
  defaultCategoryId?: number;
}

export const CategoryGroupedItemsEditor: React.FC<CategoryGroupedItemsEditorProps> = ({
  initialItems,
  onChangeFlatItems,
  onAutoSumTotal,
  categories,
  defaultCategoryId,
}) => {
  const { colors } = useTheme();
  const { settings } = useApp();
  const [autoUpdateTotal, setAutoUpdateTotal] = useState(true);

  // Convert flat BillItem list to CategoryTagGroup list
  const [tagGroups, setTagGroups] = useState<CategoryTagGroup[]>(() => {
    const fallbackCatId = defaultCategoryId || (categories.length > 0 ? categories[0].id : 1);

    if (initialItems.length === 0) {
      return [
        {
          id: `tag_${Date.now()}_1`,
          category_id: fallbackCatId,
          items: [
            {
              name: '',
              quantity: 1,
              unit_price: 0,
              line_total: 0,
            },
          ],
        },
      ];
    }

    // Group existing items by category_id
    const groupMap = new Map<number, ItemEntry[]>();
    for (const it of initialItems) {
      const cId = it.category_id || fallbackCatId;
      if (!groupMap.has(cId)) {
        groupMap.set(cId, []);
      }
      groupMap.get(cId)!.push({
        name: it.name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total,
      });
    }

    const groups: CategoryTagGroup[] = [];
    let idx = 0;
    groupMap.forEach((itemList, cId) => {
      groups.push({
        id: `tag_${Date.now()}_${idx++}`,
        category_id: cId,
        items: itemList,
      });
    });

    return groups;
  });

  // Calculate flat items and grand total whenever groups change
  const syncToParent = (groups: CategoryTagGroup[]) => {
    const flat: Omit<BillItem, 'id' | 'bill_id'>[] = [];
    let grandTotal = 0;

    for (const group of groups) {
      for (const item of group.items) {
        flat.push({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          category_id: group.category_id,
        });
        grandTotal += item.line_total || 0;
      }
    }

    onChangeFlatItems(flat);
    if (autoUpdateTotal && grandTotal > 0) {
      onAutoSumTotal(grandTotal);
    }
  };

  // Add a new Category Tag Group
  const addCategoryTagGroup = () => {
    // Pick next unused category if possible
    const usedCatIds = new Set(tagGroups.map((g) => g.category_id));
    const nextCat = categories.find((c) => !usedCatIds.has(c.id)) || categories[0];
    const catId = nextCat ? nextCat.id : 1;

    const newGroup: CategoryTagGroup = {
      id: `tag_${Date.now()}_${Math.random()}`,
      category_id: catId,
      items: [
        {
          name: '',
          quantity: 1,
          unit_price: 0,
          line_total: 0,
        },
      ],
    };

    const updated = [...tagGroups, newGroup];
    setTagGroups(updated);
    syncToParent(updated);
  };

  // Remove a Category Tag Group
  const removeCategoryTagGroup = (groupId: string) => {
    if (tagGroups.length <= 1) return; // Keep at least one tag
    const updated = tagGroups.filter((g) => g.id !== groupId);
    setTagGroups(updated);
    syncToParent(updated);
  };

  // Change Category for a Tag Group
  const changeGroupCategory = (groupId: string, newCategoryId: number) => {
    const updated = tagGroups.map((g) =>
      g.id === groupId ? { ...g, category_id: newCategoryId } : g
    );
    setTagGroups(updated);
    syncToParent(updated);
  };

  // Add an item under an existing Category Tag
  const addItemToTag = (groupId: string) => {
    const updated = tagGroups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          items: [
            ...g.items,
            {
              name: '',
              quantity: 1,
              unit_price: 0,
              line_total: 0,
            },
          ],
        };
      }
      return g;
    });

    setTagGroups(updated);
    syncToParent(updated);
  };

  // Update item details inside a Category Tag
  const updateItem = (
    groupId: string,
    itemIdx: number,
    field: keyof ItemEntry,
    val: any
  ) => {
    const updated = tagGroups.map((g) => {
      if (g.id === groupId) {
        const newItems = [...g.items];
        const cur = { ...newItems[itemIdx], [field]: val };

        if (field === 'quantity' || field === 'unit_price') {
          const q = field === 'quantity' ? Number(val) || 0 : cur.quantity;
          const p = field === 'unit_price' ? toPaise(val) : cur.unit_price;
          cur.quantity = q;
          cur.unit_price = p;
          cur.line_total = Math.round(q * p);
        }

        newItems[itemIdx] = cur;
        return { ...g, items: newItems };
      }
      return g;
    });

    setTagGroups(updated);
    syncToParent(updated);
  };

  // Remove item from a Category Tag
  const removeItem = (groupId: string, itemIdx: number) => {
    const updated = tagGroups.map((g) => {
      if (g.id === groupId) {
        // If it's the last item, keep an empty item instead of leaving empty tag
        const newItems = g.items.filter((_, idx) => idx !== itemIdx);
        if (newItems.length === 0) {
          newItems.push({
            name: '',
            quantity: 1,
            unit_price: 0,
            line_total: 0,
          });
        }
        return { ...g, items: newItems };
      }
      return g;
    });

    setTagGroups(updated);
    syncToParent(updated);
  };

  // Grand Total calculation
  const totalBillSum = tagGroups.reduce((acc, g) => {
    return acc + g.items.reduce((sum, i) => sum + (i.line_total || 0), 0);
  }, 0);

  return (
    <View style={styles.container}>
      {/* Header with Title and Auto-Sum Switch */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="pricetags-outline" size={20} color={colors.accent} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Categories & Items ({tagGroups.length} {tagGroups.length === 1 ? 'Tag' : 'Tags'})
          </Text>
        </View>

        <Text style={[styles.grandSumBadge, { color: colors.text }]}>
          Total: {formatCurrency(totalBillSum, settings)}
        </Text>
      </View>

      <Text style={[styles.subInstruction, { color: colors.textSecondary }]}>
        Add multiple items under each category tag. Use the dropdown to select the category for each group.
      </Text>

      {/* Auto-update switch */}
      <View style={styles.autoCalcRow}>
        <Text style={[styles.autoCalcLabel, { color: colors.textSecondary }]}>
          Auto-update total bill amount from items
        </Text>
        <Switch
          value={autoUpdateTotal}
          onValueChange={setAutoUpdateTotal}
          trackColor={{ false: colors.inputBg, true: colors.accent }}
        />
      </View>

      {/* Category Tag Groups */}
      {tagGroups.map((group, groupIdx) => {
        const catObj = categories.find((c) => c.id === group.category_id);
        const groupColor = catObj?.color || colors.accent;
        const groupTotal = group.items.reduce((s, it) => s + (it.line_total || 0), 0);

        return (
          <View
            key={group.id}
            style={[
              styles.tagGroupCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Tag Header: Category Dropdown + Subtotal + Remove Group */}
            <View style={styles.tagGroupHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.tagCategoryLabel, { color: colors.textSecondary }]}>
                  TAG {groupIdx + 1} CATEGORY
                </Text>
                {/* Easy Dropdown Box (No horizontal swiping!) */}
                <CategoryDropdown
                  categories={categories}
                  selectedCategoryId={group.category_id}
                  onSelectCategory={(newCatId) => {
                    if (newCatId) changeGroupCategory(group.id, newCatId);
                  }}
                  compact={true}
                />
              </View>

              <View style={styles.tagHeaderRight}>
                <Text style={[styles.tagSubtotalLabel, { color: colors.textMuted }]}>
                  TAG SUBTOTAL
                </Text>
                <Text style={[styles.tagSubtotalAmount, { color: colors.text }]}>
                  {formatCurrency(groupTotal, settings)}
                </Text>

                {tagGroups.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeCategoryTagGroup(group.id)}
                    style={styles.removeGroupBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.textSecondary} />
                    <Text style={[styles.removeGroupText, { color: colors.textSecondary }]}>
                      Remove Tag
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* List of Multiple Items Under this Category Tag */}
            <View style={styles.itemsListContainer}>
              <Text style={[styles.itemsListLabel, { color: colors.textSecondary }]}>
                ITEMS IN THIS CATEGORY ({group.items.length})
              </Text>

              {group.items.map((item, itemIdx) => (
                <View
                  key={itemIdx}
                  style={[
                    styles.itemEntryRow,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.borderLight,
                    },
                  ]}
                >
                  {/* Top row: Name & Remove */}
                  <View style={styles.itemNameRow}>
                    <TextInput
                      placeholder={`Item name (e.g. Milk, Apples, Jeans)`}
                      placeholderTextColor={colors.textMuted}
                      value={item.name}
                      onChangeText={(val) =>
                        updateItem(group.id, itemIdx, 'name', val)
                      }
                      style={[styles.itemNameInput, { color: colors.text }]}
                    />

                    {group.items.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeItem(group.id, itemIdx)}
                        style={styles.deleteItemBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Bottom details: Quantity, Unit Price, Line Total */}
                  <View style={styles.itemValuesRow}>
                    <View style={styles.colQty}>
                      <Text style={[styles.valLabel, { color: colors.textMuted }]}>Qty</Text>
                      <TextInput
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                        value={item.quantity ? String(item.quantity) : ''}
                        onChangeText={(val) =>
                          updateItem(group.id, itemIdx, 'quantity', val)
                        }
                        keyboardType="numeric"
                        style={[
                          styles.valInput,
                          { color: colors.text, borderColor: colors.border },
                        ]}
                      />
                    </View>

                    <View style={styles.colPrice}>
                      <Text style={[styles.valLabel, { color: colors.textMuted }]}>
                        Price ({settings.currencySymbol})
                      </Text>
                      <TextInput
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                        value={item.unit_price ? String(fromPaise(item.unit_price)) : ''}
                        onChangeText={(val) =>
                          updateItem(group.id, itemIdx, 'unit_price', val)
                        }
                        keyboardType="decimal-pad"
                        style={[
                          styles.valInput,
                          { color: colors.text, borderColor: colors.border },
                        ]}
                      />
                    </View>

                    <View style={styles.colTotal}>
                      <Text style={[styles.valLabel, { color: colors.textMuted }]}>
                        Line Total
                      </Text>
                      <Text style={[styles.valTotalText, { color: colors.text }]}>
                        {formatCurrency(item.line_total || 0, settings)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Add Another Item Under this same Category Tag */}
              <TouchableOpacity
                onPress={() => addItemToTag(group.id)}
                activeOpacity={0.7}
                style={[
                  styles.addItemToTagBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="add-circle-outline" size={17} color={colors.accent} />
                <Text style={[styles.addItemToTagText, { color: colors.text }]}>
                  + Add Another Item to {catObj?.name || 'Category'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Button to Add a New Category Tag Group to the Bill */}
      <TouchableOpacity
        onPress={addCategoryTagGroup}
        activeOpacity={0.75}
        style={[
          styles.addCategoryGroupBtn,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="duplicate-outline" size={18} color={colors.text} />
        <Text style={[styles.addCategoryGroupText, { color: colors.text }]}>
          + Add Another Category Tag to this Bill
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
    fontSize: 16,
    fontWeight: '800',
  },
  grandSumBadge: {
    fontSize: 14,
    fontWeight: '800',
  },
  subInstruction: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
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
  tagGroupCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  tagGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  tagCategoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  tagHeaderRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 110,
    paddingTop: 4,
  },
  tagSubtotalLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tagSubtotalAmount: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  removeGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  removeGroupText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemsListContainer: {
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
    paddingTop: 12,
  },
  itemsListLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  itemEntryRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  deleteItemBtn: {
    padding: 2,
  },
  itemValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colQty: {
    width: 55,
  },
  colPrice: {
    flex: 1,
  },
  colTotal: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 75,
  },
  valLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  valInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  valTotalText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  addItemToTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
    gap: 6,
  },
  addItemToTagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addCategoryGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
    marginBottom: 10,
    gap: 8,
  },
  addCategoryGroupText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

