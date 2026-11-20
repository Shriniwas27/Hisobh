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
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { CategoryDropdown } from '../../components/ui/CategoryDropdown';
import { CompactDateInput } from '../../components/ui/CompactDateInput';
import { AccountDropdown } from '../../components/ui/AccountDropdown';
import { CategoryGroupedItemsEditor } from '../../components/bill/CategoryGroupedItemsEditor';
import { getBillById, updateBill, getCategories, getVendorSuggestions, getAccounts } from '../../db/queries';
import { saveImagePermanently, resolveImagePath, deleteImageFile } from '../../utils/fileStorage';
import { toPaise, fromPaise } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/dates';
import { Category, BillItem, BillImage, PaymentMethod, Account } from '../../types';
import { PAYMENT_METHODS } from '../../constants/categories';

export default function EditBillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const billId = parseInt(id || '0', 10);
  const router = useRouter();

  const { colors } = useTheme();
  const { settings, triggerRefresh } = useApp();

  const [amountStr, setAmountStr] = useState('');
  const [commodity, setCommodity] = useState('');
  const [vendor, setVendor] = useState('');
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [dateStr, setDateStr] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<Omit<BillItem, 'id' | 'bill_id'>[]>([]);

  // Existing images from DB
  const [existingImages, setExistingImages] = useState<BillImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);
  const [deletedImagePaths, setDeletedImagePaths] = useState<string[]>([]);

  // Newly added local image URIs
  const [newImageUris, setNewImageUris] = useState<string[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<{ amount?: string; category?: string; vendor?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cats = getCategories();
    setCategories(cats);

    const accs = getAccounts();
    setAccounts(accs);

    if (billId > 0) {
      const b = getBillById(billId);
      if (b) {
        setAmountStr(String(fromPaise(b.total_amount)));
        setVendor(b.vendor);
        setDateStr(b.date);
        setSelectedCategoryId(b.category_id);
        setPaymentMethod(b.payment_method);
        if (b.account_id) {
          setSelectedAccountId(b.account_id);
        } else if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
        setNotes(b.notes || '');
        if (b.items && b.items.length > 0) {
          if (b.items.length === 1) {
            setCommodity(b.items[0].name);
          }
          setLineItems(
            b.items.map((it) => ({
              name: it.name,
              quantity: it.quantity,
              unit_price: it.unit_price,
              line_total: it.line_total,
              category_id: it.category_id || b.category_id,
            }))
          );
        }
        if (b.images) {
          setExistingImages(b.images);
        }
      }
    }
  }, [billId]);

  const handleVendorChange = (text: string) => {
    setVendor(text);
    if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: undefined }));
    if (text.trim().length > 0) {
      const suggestions = getVendorSuggestions(text);
      setVendorSuggestions(suggestions);
    } else {
      setVendorSuggestions([]);
    }
  };

  // Image actions
  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera permission is required to take photos of bills.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setNewImageUris((prev) => [...prev, res.assets[0].uri]);
    }
  };

  const handlePickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Gallery permission is required to attach bill photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setNewImageUris((prev) => [...prev, ...res.assets.map((a) => a.uri)]);
    }
  };

  const removeExistingImage = (img: BillImage) => {
    if (img.id) {
      setDeletedImageIds((prev) => [...prev, img.id!]);
      setDeletedImagePaths((prev) => [...prev, img.file_path]);
    }
    setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
  };

  const removeNewImage = (idx: number) => {
    setNewImageUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const newErrors: { amount?: string; category?: string; vendor?: string } = {};

    let totalPaise = toPaise(amountStr);
    if (lineItems.length > 0 && totalPaise <= 0) {
      totalPaise = lineItems.reduce((acc, i) => acc + (i.line_total || 0), 0);
    }

    if (totalPaise <= 0) newErrors.amount = 'Please enter amount > 0';
    if (!selectedCategoryId) newErrors.category = 'Please choose a category';
    if (!vendor.trim()) newErrors.vendor = 'Please enter vendor name';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSaving(true);

      const newStoredPaths: string[] = [];
      for (const uri of newImageUris) {
        const p = await saveImagePermanently(uri);
        newStoredPaths.push(p);
      }

      for (const path of deletedImagePaths) {
        await deleteImageFile(path);
      }

      // Normalize date to YYYY-MM-DD
      let normalizedDate = dateStr;
      if (normalizedDate.includes('/')) {
        const parts = normalizedDate.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
          normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      let finalItems = lineItems;
      if (lineItems.length <= 1) {
        if (commodity.trim()) {
          finalItems = [
            {
              name: commodity.trim(),
              quantity: 1,
              unit_price: totalPaise,
              line_total: totalPaise,
              category_id: selectedCategoryId!,
            },
          ];
        } else if (lineItems.length === 1 && !commodity.trim()) {
          finalItems = [];
        }
      }

      updateBill(
        billId,
        {
          vendor: vendor.trim(),
          date: normalizedDate,
          category_id: selectedCategoryId!,
          total_amount: totalPaise,
          payment_method: paymentMethod,
          account_id: selectedAccountId,
          notes: notes.trim() || null,
        },
        finalItems,
        newStoredPaths,
        deletedImageIds
      );

      triggerRefresh();
      router.back();
    } catch (e: any) {
      Alert.alert('Save Failed', 'Could not update bill.');
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Entry</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Native Amount Input */}
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
              style={[styles.amountInput, { color: colors.text }]}
            />
          </View>
          {errors.amount && (
            <Text style={[styles.inlineError, { color: colors.danger }]}>{errors.amount}</Text>
          )}

          {/* Photo Actions */}
          <View style={styles.photoActionRow}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              style={[styles.photoActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="camera-outline" size={18} color={colors.accent} />
              <Text style={[styles.photoActionText, { color: colors.text }]}>Add Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickGallery}
              style={[styles.photoActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="images-outline" size={18} color={colors.accent} />
              <Text style={[styles.photoActionText, { color: colors.text }]}>Add from Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Existing & New Attached Photos */}
          {(existingImages.length > 0 || newImageUris.length > 0) && (
            <View style={styles.attachedImagesContainer}>
              <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary }]}>
                ATTACHED PHOTOS ({existingImages.length + newImageUris.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {existingImages.map((img) => (
                  <View key={img.id} style={styles.thumbnailWrapper}>
                    <Image
                      source={{ uri: resolveImagePath(img.file_path) }}
                      style={styles.thumbnailImage}
                    />
                    <TouchableOpacity
                      onPress={() => removeExistingImage(img)}
                      style={styles.thumbnailRemoveBtn}
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {newImageUris.map((uri, idx) => (
                  <View key={idx} style={styles.thumbnailWrapper}>
                    <Image source={{ uri }} style={styles.thumbnailImage} />
                    <TouchableOpacity
                      onPress={() => removeNewImage(idx)}
                      style={styles.thumbnailRemoveBtn}
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Primary Category Dropdown */}
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
              label="PRIMARY CATEGORY"
            />
            {errors.category && (
              <Text style={[styles.inlineError, { color: colors.danger, marginTop: 4 }]}>
                {errors.category}
              </Text>
            )}
          </View>

          {/* Form details */}
          <View style={styles.formSection}>
            {/* Commodity / Item Name (when single item) */}
            {lineItems.length <= 1 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary }]}>
                  COMMODITY / ITEM PURCHASED
                </Text>
                <View style={[styles.textInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    value={commodity}
                    onChangeText={setCommodity}
                    placeholder="e.g. Coffee, Milk & Bread, Petrol, Medicines"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>
            )}

            <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary }]}>
              VENDOR / STORE
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
                placeholder="Merchant name"
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, { color: colors.text }]}
              />
            </View>

            {/* Date Input (Clean compact DD/MM/YYYY) */}
            <CompactDateInput
              storageDate={dateStr}
              onChangeStorageDate={setDateStr}
              label="DATE"
            />

            {/* Paid From Account */}
            <View style={{ marginTop: 12 }}>
              <AccountDropdown
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelectAccount={(acc) => {
                  setSelectedAccountId(acc.id);
                  if (acc.type === 'cash') setPaymentMethod('Cash');
                  else if (acc.type === 'upi') setPaymentMethod('UPI');
                  else if (acc.type === 'bank') setPaymentMethod('Bank Transfer');
                  else setPaymentMethod('Other');
                }}
                label="PAID FROM (BANK / CASH / UPI)"
                placeholder="Select payment account"
              />
            </View>

            {/* Notes */}
            <Text style={[styles.fieldSectionLabel, { color: colors.textSecondary, marginTop: 12 }]}>
              NOTES
            </Text>
            <View style={[styles.textInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, { color: colors.text }]}
              />
            </View>

            {/* Line items with category tag grouping */}
            <CategoryGroupedItemsEditor
              initialItems={lineItems}
              onChangeFlatItems={setLineItems}
              onAutoSumTotal={(sum) => setAmountStr(String(fromPaise(sum)))}
              categories={categories}
              defaultCategoryId={selectedCategoryId || undefined}
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving Changes...' : 'Save Changes'}
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  currencySymbol: { fontSize: 34, fontWeight: '700', marginRight: 8 },
  amountInput: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.5,
    minWidth: 120,
    textAlign: 'left',
  },
  inlineError: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  photoActionRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
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
  categoryScroll: { marginBottom: 14 },
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
  formSection: { marginBottom: 10 },
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
  datePreviewText: { fontSize: 12, fontWeight: '600' },
  pmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pmChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16 },
  pmText: { fontSize: 13, fontWeight: '600' },
  saveButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
