import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { CategoryDropdown } from '../components/ui/CategoryDropdown';
import { CompactDateInput } from '../components/ui/CompactDateInput';
import { AccountDropdown } from '../components/ui/AccountDropdown';
import { CategoryGroupedItemsEditor } from '../components/bill/CategoryGroupedItemsEditor';
import { getCategories, getVendorSuggestions, addBill, getAccounts } from '../db/queries';
import { saveImagePermanently } from '../utils/fileStorage';
import { toPaise, fromPaise } from '../utils/currency';
import { getTodayString, formatDisplayDate } from '../utils/dates';
import { Category, BillItem, PaymentMethod, Account } from '../types';
import { PAYMENT_METHODS } from '../constants/categories';

type EntryMode = 'transaction' | 'bill';

export default function AddBillScreen() {
  const { categoryId: initialCatId, mode: initialMode } = useLocalSearchParams<{
    categoryId?: string;
    mode?: string;
  }>();

  const { colors } = useTheme();
  const { settings, triggerRefresh } = useApp();
  const router = useRouter();

  // Mode: 'transaction' (single category) vs 'bill' (itemized with per-item categories)
  const [entryMode, setEntryMode] = useState<EntryMode>(
    initialMode === 'bill' ? 'bill' : 'transaction'
  );

  // Common fields
  const [vendor, setVendor] = useState('');
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [dateStr, setDateStr] = useState(getTodayString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]); // local picker URIs

  // Mode 1: Single Transaction fields
  const [amountStr, setAmountStr] = useState('');
  const [commodity, setCommodity] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    initialCatId ? parseInt(initialCatId, 10) : null
  );

  // Mode 2: Multi-Item Bill fields
  const [lineItems, setLineItems] = useState<Omit<BillItem, 'id' | 'bill_id'>[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<{ amount?: string; category?: string; vendor?: string; items?: string; account?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cats = getCategories();
    setCategories(cats);
    if (!selectedCategoryId && cats.length > 0) {
      if (initialCatId) {
        setSelectedCategoryId(parseInt(initialCatId, 10));
      } else {
        setSelectedCategoryId(cats[0].id);
      }
    }

    const accs = getAccounts();
    setAccounts(accs);
    if (accs.length > 0) {
      const defaultAcc = accs.find((a) => a.is_default === 1) || accs[0];
      setSelectedAccountId(defaultAcc.id);
      if (defaultAcc.type === 'cash') setPaymentMethod('Cash');
      else if (defaultAcc.type === 'upi') setPaymentMethod('UPI');
      else if (defaultAcc.type === 'bank') setPaymentMethod('Bank Transfer');
    }
  }, [initialCatId]);

  const handleSelectAccount = (acc: Account) => {
    setSelectedAccountId(acc.id);
    if (acc.type === 'cash') setPaymentMethod('Cash');
    else if (acc.type === 'upi') setPaymentMethod('UPI');
    else if (acc.type === 'bank') setPaymentMethod('Bank Transfer');
    else setPaymentMethod('Other');
  };

  // When switching to 'bill' mode, pre-populate with 1 empty item if list is empty
  useEffect(() => {
    if (entryMode === 'bill' && lineItems.length === 0 && categories.length > 0) {
      setLineItems([
        {
          name: '',
          quantity: 1,
          unit_price: 0,
          line_total: 0,
          category_id: selectedCategoryId || categories[0].id,
        },
      ]);
    }
  }, [entryMode, categories]);

  const handleVendorChange = (text: string) => {
    setVendor(text);
    if (errors.vendor) {
      setErrors((prev) => ({ ...prev, vendor: undefined }));
    }
    if (text.trim().length > 0) {
      const suggestions = getVendorSuggestions(text);
      setVendorSuggestions(suggestions);
    } else {
      setVendorSuggestions([]);
    }
  };

  // Image Handlers
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Expense Ledger needs camera access to photograph your bills and receipts for offline records.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImages((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Expense Ledger needs photo library access to attach receipt photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map((a) => a.uri);
        setSelectedImages((prev) => [...prev, ...uris]);
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not access photo library.');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Validation & Save
  const handleSave = async () => {
    const newErrors: { amount?: string; category?: string; vendor?: string; items?: string } = {};

    let finalVendor = vendor.trim();
    if (!finalVendor) {
      if (entryMode === 'transaction' && commodity.trim()) {
        finalVendor = commodity.trim();
      } else {
        newErrors.vendor = 'Please enter vendor or merchant name';
      }
    }

    let finalTotalPaise = 0;
    let finalItems: Omit<BillItem, 'id' | 'bill_id'>[] = [];
    let primaryCatId = selectedCategoryId || (categories.length > 0 ? categories[0].id : 1);

    if (entryMode === 'transaction') {
      finalTotalPaise = toPaise(amountStr);
      if (finalTotalPaise <= 0) {
        newErrors.amount = 'Please enter an amount greater than 0';
      }
      if (!selectedCategoryId) {
        newErrors.category = 'Please select a category';
      }
      if (commodity.trim()) {
        finalItems.push({
          name: commodity.trim(),
          quantity: 1,
          unit_price: finalTotalPaise,
          line_total: finalTotalPaise,
          category_id: primaryCatId,
        });
      }
    } else {
      // Bill Mode with line items
      const validItems = lineItems.filter((i) => i.name.trim() || i.line_total > 0);
      if (validItems.length === 0) {
        newErrors.items = 'Please add at least one item or group to this bill';
      }

      finalItems = validItems.map((item) => ({
        ...item,
        name: item.name.trim() || 'General Item',
        category_id: item.category_id || primaryCatId,
      }));

      const sumItemsPaise = finalItems.reduce((acc, i) => acc + (i.line_total || 0), 0);
      const manualPaise = toPaise(amountStr);

      finalTotalPaise = manualPaise > 0 ? manualPaise : sumItemsPaise;
      if (finalTotalPaise <= 0) {
        newErrors.amount = 'Bill total must be greater than 0';
      }

      if (finalItems.length > 0 && finalItems[0].category_id) {
        primaryCatId = finalItems[0].category_id;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSaving(true);

      // Save photos permanently
      const permanentPaths: string[] = [];
      for (const uri of selectedImages) {
        const storedPath = await saveImagePermanently(uri);
        permanentPaths.push(storedPath);
      }

      // Normalize date to YYYY-MM-DD
      let normalizedDate = dateStr;
      if (normalizedDate.includes('/')) {
        const parts = normalizedDate.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
          normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // Add to SQLite
      addBill(
        {
          date: normalizedDate,
          vendor: finalVendor,
          category_id: primaryCatId,
          total_amount: finalTotalPaise,
          payment_method: paymentMethod,
          account_id: selectedAccountId,
          notes: notes.trim() || null,
        },
        finalItems,
        permanentPaths
      );

      triggerRefresh();
      router.back();
    } catch (e: any) {
      console.error('Failed to save:', e);
      Alert.alert('Error', 'Failed to save to database.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {entryMode === 'bill' ? 'Add Itemized Bill' : 'Add Quick Transaction'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode Selector Tabs: Add Transaction vs Add Bill */}
          <View style={[styles.modeSelectorWrap, { backgroundColor: colors.pillInactive }]}>
            <TouchableOpacity
              onPress={() => setEntryMode('transaction')}
              activeOpacity={0.8}
              style={[
                styles.modeBtn,
                entryMode === 'transaction' && {
                  backgroundColor: colors.pillActive,
                  elevation: 2,
                },
              ]}
            >
              <Ionicons
                name="flash-outline"
                size={16}
                color={entryMode === 'transaction' ? colors.pillActiveText : colors.pillInactiveText}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  {
                    color: entryMode === 'transaction' ? colors.pillActiveText : colors.pillInactiveText,
                    fontWeight: entryMode === 'transaction' ? '700' : '500',
                  },
                ]}
              >
                Add Transaction
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEntryMode('bill')}
              activeOpacity={0.8}
              style={[
                styles.modeBtn,
                entryMode === 'bill' && {
                  backgroundColor: colors.pillActive,
                  elevation: 2,
                },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={16}
                color={entryMode === 'bill' ? colors.pillActiveText : colors.pillInactiveText}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  {
                    color: entryMode === 'bill' ? colors.pillActiveText : colors.pillInactiveText,
                    fontWeight: entryMode === 'bill' ? '700' : '500',
                  },
                ]}
              >
                Add Bill (Multi-Item)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Description helper for the selected mode */}
          <Text style={[styles.modeHelperText, { color: colors.textSecondary }]}>
            {entryMode === 'transaction'
              ? 'Quick single-expense with one category (e.g. coffee, commute, lunch).'
              : 'Add an itemized store bill where each item or group has its own category (e.g. Supermarket, Pharmacy).'}
          </Text>

          {/* Mode 1: Single Transaction Amount Input */}
          {entryMode === 'transaction' ? (
            <View>
              <View
                style={[
                  styles.amountInputContainer,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.amount ? colors.danger : colors.border,
                  },
                ]}
              >
                <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>
                  {settings.currencySymbol}
                </Text>
                <TextInput
                  value={amountStr}
                  onChangeText={(text) => {
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setAmountStr(cleaned);
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus={true}
                  style={[styles.amountInput, { color: colors.text }]}
                />
              </View>
              {errors.amount && (
                <Text style={[styles.inlineError, { color: colors.danger }]}>{errors.amount}</Text>
              )}
            </View>
          ) : (
            // Mode 2: Multi-Item Bill Total Overview
            <View style={[styles.billTotalBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.billTotalLabel, { color: colors.textSecondary }]}>
                  TOTAL BILL AMOUNT
                </Text>
                <Text style={[styles.billTotalAmount, { color: colors.text }]}>
                  {settings.currencySymbol}
                  {amountStr ||
                    fromPaise(
                      lineItems.reduce((acc, i) => acc + (i.line_total || 0), 0)
                    ).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.itemCountBadge, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.itemCountBadgeText, { color: colors.textSecondary }]}>
                  {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
            </View>
          )}

          {/* Photo Action Buttons */}
          <View style={styles.photoActionRow}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              activeOpacity={0.7}
              style={[styles.photoActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="camera-outline" size={20} color={colors.accent} />
              <Text style={[styles.photoActionText, { color: colors.text }]}>
                {entryMode === 'bill' ? 'Take Bill Photo' : 'Take Receipt Photo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickFromGallery}
              activeOpacity={0.7}
              style={[styles.photoActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="images-outline" size={20} color={colors.accent} />
              <Text style={[styles.photoActionText, { color: colors.text }]}>Choose Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Attached Images Previews */}
          {selectedImages.length > 0 && (
            <View style={styles.attachedImagesContainer}>
              <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary }]}>
                ATTACHED BILL PHOTOS ({selectedImages.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {selectedImages.map((uri, idx) => (
                  <View key={idx} style={styles.thumbnailWrapper}>
                    <Image source={{ uri }} style={styles.thumbnailImage} />
                    <TouchableOpacity
                      onPress={() => removeImage(idx)}
                      style={styles.thumbnailRemoveBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Mode 1: Single Category Selection with Easy Dropdown */}
          {entryMode === 'transaction' && (
            <View style={{ marginBottom: 14 }}>
              <CategoryDropdown
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={(id) => {
                  setSelectedCategoryId(id);
                  if (errors.category) {
                    setErrors((prev) => ({ ...prev, category: undefined }));
                  }
                }}
                label="CATEGORY"
              />
              {errors.category && (
                <Text style={[styles.inlineError, { color: colors.danger, marginTop: 4 }]}>
                  {errors.category}
                </Text>
              )}
            </View>
          )}

          {/* Mode 1: Commodity / Item Purchased */}
          {entryMode === 'transaction' && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary }]}>
                COMMODITY / ITEM PURCHASED
              </Text>
              <View
                style={[
                  styles.textInputWrap,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <TextInput
                  value={commodity}
                  onChangeText={setCommodity}
                  placeholder="e.g. Coffee, Milk & Bread, Petrol, Dinner, Medicine"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.text }]}
                />
              </View>
            </View>
          )}

          {/* Vendor Name */}
          <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary }]}>
            {entryMode === 'bill' ? 'STORE / VENDOR NAME' : 'VENDOR / STORE NAME'}
          </Text>
          <View
            style={[
              styles.textInputWrap,
              { backgroundColor: colors.card, borderColor: errors.vendor ? colors.danger : colors.border },
            ]}
          >
            <TextInput
              value={vendor}
              onChangeText={handleVendorChange}
              placeholder={entryMode === 'bill' ? 'e.g. Supermarket, Departmental Store, Pharmacy' : 'e.g. Starbucks, Shell, Local Market'}
              placeholderTextColor={colors.textMuted}
              style={[styles.textInput, { color: colors.text }]}
            />
          </View>
          {errors.vendor && (
            <Text style={[styles.inlineError, { color: colors.danger }]}>{errors.vendor}</Text>
          )}

          {/* Vendor Autocomplete suggestions */}
          {vendorSuggestions.length > 0 && (
            <View style={[styles.suggestionsRow, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.suggestionLabel, { color: colors.textMuted }]}>Suggestions:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {vendorSuggestions.map((sug, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setVendor(sug);
                      setVendorSuggestions([]);
                    }}
                    style={[styles.suggestionChip, { backgroundColor: colors.card }]}
                  >
                    <Text style={[styles.suggestionText, { color: colors.text }]}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Mode 2: Multi-Item Bill Items with Category Tag Groups */}
          {entryMode === 'bill' && (
            <View>
              {errors.items && (
                <Text style={[styles.inlineError, { color: colors.danger, marginBottom: 8 }]}>
                  {errors.items}
                </Text>
              )}
              <CategoryGroupedItemsEditor
                initialItems={lineItems}
                onChangeFlatItems={setLineItems}
                onAutoSumTotal={(sumPaise) => setAmountStr(String(fromPaise(sumPaise)))}
                categories={categories}
                defaultCategoryId={selectedCategoryId || (categories.length > 0 ? categories[0].id : undefined)}
              />
            </View>
          )}

          {/* Date Input (Clean compact DD/MM/YYYY) */}
          <CompactDateInput
            storageDate={dateStr}
            onChangeStorageDate={setDateStr}
            label="DATE"
          />

          {/* Paid From Account (Bank / Cash / UPI) */}
          <View style={{ marginTop: 12 }}>
            <AccountDropdown
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelectAccount={handleSelectAccount}
              label="PAID FROM (BANK / CASH / UPI)"
              placeholder="Select payment account"
            />
          </View>

          {/* Notes */}
          <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary, marginTop: 12 }]}>
            NOTES (OPTIONAL)
          </Text>
          <View style={[styles.textInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Invoice reference, warranty or purpose notes"
              placeholderTextColor={colors.textMuted}
              style={[styles.textInput, { color: colors.text }]}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.saveButtonText}>
              {saving
                ? 'Saving...'
                : entryMode === 'bill'
                ? 'Save Itemized Bill'
                : 'Save Transaction'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  modeSelectorWrap: {
    flexDirection: 'row',
    borderRadius: 26,
    padding: 4,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 22,
  },
  modeBtnText: {
    fontSize: 13,
  },
  modeHelperText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  currencySymbol: { fontSize: 34, fontWeight: '700', marginRight: 8 },
  amountInput: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.5,
    minWidth: 120,
    textAlign: 'left',
  },
  billTotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 10,
  },
  billTotalLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  billTotalAmount: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  itemCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  itemCountBadgeText: { fontSize: 12, fontWeight: '600' },
  inlineError: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  photoActionRow: { flexDirection: 'row', gap: 12, marginVertical: 12 },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  photoActionText: { fontSize: 13, fontWeight: '600' },
  attachedImagesContainer: { marginBottom: 14 },
  thumbnailWrapper: { position: 'relative', marginRight: 10 },
  thumbnailImage: { width: 68, height: 68, borderRadius: 12 },
  thumbnailRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  fieldSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoryChipText: { fontSize: 13, fontWeight: '600' },
  textInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  textInput: { flex: 1, fontSize: 14, height: '100%' },
  suggestionsRow: { borderRadius: 12, padding: 8, marginBottom: 10 },
  suggestionLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  suggestionChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  suggestionText: { fontSize: 12, fontWeight: '600' },
  rowField: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 },
  datePreviewText: { fontSize: 12, fontWeight: '600' },
  quickDateBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickDateText: { fontSize: 13, fontWeight: '600' },
  pmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pmChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16 },
  pmText: { fontSize: 13, fontWeight: '600' },
  saveButton: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#E58A2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
