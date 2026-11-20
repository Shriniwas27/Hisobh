import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  checkCategoryUsage,
  reassignCategoryBills,
} from '../db/queries';
import { Category } from '../types';
import { CATEGORY_PALETTE, CATEGORY_ICONS } from '../constants/categories';

export default function ManageCategoriesScreen() {
  const { colors } = useTheme();
  const { triggerRefresh } = useApp();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);

  // Add / Edit Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(CATEGORY_PALETTE[0]);
  const [catIcon, setCatIcon] = useState(CATEGORY_ICONS[0]);

  // Reassign & Delete state
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [billsCountInCat, setBillsCountInCat] = useState(0);
  const [selectedReplacementId, setSelectedReplacementId] = useState<number | null>(null);

  const loadCategories = () => {
    const list = getCategories();
    setCategories(list);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setCatName('');
    setCatColor(CATEGORY_PALETTE[0]);
    setCatIcon(CATEGORY_ICONS[0]);
    setModalVisible(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatColor(cat.color);
    setCatIcon(cat.icon);
    setModalVisible(true);
  };

  const handleSaveCategory = () => {
    if (!catName.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }

    try {
      if (editingCategory) {
        updateCategory(editingCategory.id, catName.trim(), catColor, catIcon);
      } else {
        addCategory(catName.trim(), catColor, catIcon);
      }
      setModalVisible(false);
      loadCategories();
      triggerRefresh();
    } catch (e: any) {
      Alert.alert('Error', 'Category name must be unique.');
    }
  };

  const handleDeletePress = (cat: Category) => {
    const usage = checkCategoryUsage(cat.id);
    if (usage > 0) {
      // Category is in use, require reassigning bills first!
      setCategoryToDelete(cat);
      setBillsCountInCat(usage);
      const otherCats = categories.filter((c) => c.id !== cat.id);
      setSelectedReplacementId(otherCats.length > 0 ? otherCats[0].id : null);
      setReassignModalVisible(true);
    } else {
      Alert.alert(
        'Delete Category?',
        `Are you sure you want to delete "${cat.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteCategory(cat.id);
              loadCategories();
              triggerRefresh();
            },
          },
        ]
      );
    }
  };

  const handleConfirmReassignAndDelete = () => {
    if (!categoryToDelete || !selectedReplacementId) return;

    try {
      // Reassign bills
      reassignCategoryBills(categoryToDelete.id, selectedReplacementId);
      // Delete old category
      deleteCategory(categoryToDelete.id);
      setReassignModalVisible(false);
      loadCategories();
      triggerRefresh();
      Alert.alert(
        'Reassigned & Deleted',
        `Reassigned ${billsCountInCat} bills to the new category and deleted "${categoryToDelete.name}".`
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to reassign bills.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Categories</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Categories organize your expenses. Categories currently in use cannot be deleted without
          reassigning their bills first.
        </Text>

        {categories.map((cat) => (
          <Card key={cat.id} style={styles.catCard}>
            <View style={styles.catRow}>
              {/* Category Icon */}
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${cat.color}20` },
                ]}
              >
                <Ionicons name={(cat.icon || 'folder-outline') as any} size={20} color={cat.color} />
              </View>

              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.7}
                onPress={() => {
                  router.push({
                    pathname: '/category-bills',
                    params: {
                      categoryId: cat.id,
                      categoryName: cat.name,
                      categoryColor: cat.color,
                    },
                  });
                }}
              >
                <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
                <Text style={[styles.catUsage, { color: colors.textMuted }]}>
                  {(cat.bill_count || 0)} {(cat.bill_count === 1 ? 'bill' : 'bills')} · Tap to view entries →
                </Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: '/category-bills',
                      params: {
                        categoryId: cat.id,
                        categoryName: cat.name,
                        categoryColor: cat.color,
                      },
                    });
                  }}
                  style={[styles.smallActionBtn, { backgroundColor: colors.inputBg }]}
                >
                  <Ionicons name="receipt-outline" size={16} color={colors.accent} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => openEditModal(cat)}
                  style={[styles.smallActionBtn, { backgroundColor: colors.inputBg }]}
                >
                  <Ionicons name="pencil-outline" size={16} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeletePress(cat)}
                  style={[styles.smallActionBtn, { backgroundColor: colors.dangerLight }]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}

        <TouchableOpacity
          onPress={openAddModal}
          style={[styles.addNewButton, { borderColor: colors.accent }]}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.addNewButtonText, { color: colors.accent }]}>
            Create New Category
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add / Edit Category Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingCategory ? 'Edit Category' : 'New Category'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Name Input */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>NAME</Text>
            <View
              style={[
                styles.textInputWrap,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={catName}
                onChangeText={setCatName}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text }]}
              />
            </View>

            {/* Color Palette Picker */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              COLOR
            </Text>
            <View style={styles.paletteGrid}>
              {CATEGORY_PALETTE.map((c) => {
                const isSelected = catColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCatColor(c)}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      isSelected && styles.selectedColorCircle,
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Icon Picker */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              ICON
            </Text>
            <View style={styles.iconsGrid}>
              {CATEGORY_ICONS.map((ic) => {
                const isSelected = catIcon === ic;
                return (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => setCatIcon(ic)}
                    style={[
                      styles.iconSelectBtn,
                      {
                        backgroundColor: isSelected ? colors.pillActive : colors.inputBg,
                      },
                    ]}
                  >
                    <Ionicons
                      name={ic as any}
                      size={20}
                      color={isSelected ? colors.pillActiveText : colors.text}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={handleSaveCategory}
              style={[styles.saveCatBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.saveCatBtnText}>Save Category</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reassign & Delete Modal */}
      <Modal visible={reassignModalVisible} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setReassignModalVisible(false)}>
          <Pressable
            style={[styles.reassignSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Ionicons name="warning-outline" size={36} color={colors.warning} style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={[styles.reassignTitle, { color: colors.text }]}>Reassign Bills Required</Text>
            <Text style={[styles.reassignDesc, { color: colors.textSecondary }]}>
              "{categoryToDelete?.name}" is currently used in {billsCountInCat} bills.
              Please select a replacement category to move these bills to before deleting.
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              MOVE BILLS TO:
            </Text>
            <ScrollView style={{ maxHeight: 200, marginVertical: 8 }}>
              {categories
                .filter((c) => c.id !== categoryToDelete?.id)
                .map((c) => {
                  const isSelected = selectedReplacementId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setSelectedReplacementId(c.id)}
                      style={[
                        styles.reassignRow,
                        {
                          backgroundColor: isSelected ? colors.pillActive : colors.inputBg,
                        },
                      ]}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: c.color }]} />
                      <Text
                        style={[
                          styles.reassignCatName,
                          { color: isSelected ? colors.pillActiveText : colors.text },
                        ]}
                      >
                        {c.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color={colors.pillActiveText} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <View style={styles.reassignActions}>
              <TouchableOpacity
                onPress={() => setReassignModalVisible(false)}
                style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmReassignAndDelete}
                style={[styles.reassignConfirmBtn, { backgroundColor: colors.danger }]}
              >
                <Text style={styles.reassignConfirmText}>Reassign & Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  catCard: {
    padding: 14,
    marginBottom: 10,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
  },
  catUsage: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 10,
    gap: 8,
  },
  addNewButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInputWrap: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    height: '100%',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColorCircle: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconSelectBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCatBtn: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveCatBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  reassignSheet: {
    margin: 24,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignSelf: 'center',
    width: '90%',
  },
  reassignTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  reassignDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  reassignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reassignCatName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  reassignActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reassignConfirmBtn: {
    flex: 1.3,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassignConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

