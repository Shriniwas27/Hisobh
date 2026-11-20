import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { ImageViewerModal } from '../../components/bill/ImageViewerModal';
import { getBillById, deleteBill } from '../../db/queries';
import { resolveImagePath, deleteImageFile } from '../../utils/fileStorage';
import { formatCurrency, fromPaise } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/dates';
import { Bill } from '../../types';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const billId = parseInt(id || '0', 10);
  const router = useRouter();

  const { colors } = useTheme();
  const { settings, triggerRefresh, refreshTrigger } = useApp();

  const [bill, setBill] = useState<Bill | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (billId > 0) {
      const data = getBillById(billId);
      setBill(data);
    }
  }, [billId, refreshTrigger]);

  if (!bill) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.notFoundContainer}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Bill not found or has been deleted.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle Delete with confirmation
  const handleDelete = () => {
    Alert.alert(
      'Delete Bill Entry?',
      'Are you sure you want to permanently delete this bill entry and its attached receipt photos?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from DB and get image paths to clean up
              const imagePaths = deleteBill(bill.id);
              for (const p of imagePaths) {
                await deleteImageFile(p);
              }
              triggerRefresh();
              router.back();
            } catch (e: any) {
              Alert.alert('Error', 'Failed to delete bill.');
            }
          },
        },
      ]
    );
  };

  // Handle Share image / bill summary
  const handleShare = async () => {
    try {
      if (bill.images && bill.images.length > 0) {
        const fullUri = resolveImagePath(bill.images[0].file_path);
        const isAvail = await Sharing.isAvailableAsync();
        if (isAvail) {
          await Sharing.shareAsync(fullUri, {
            dialogTitle: `Receipt: ${bill.vendor}`,
          });
        }
      } else {
        Alert.alert(
          'Share Bill',
          `${bill.vendor} - ${formatCurrency(bill.total_amount, settings)} on ${bill.date} (${bill.payment_method})`
        );
      }
    } catch (e: any) {
      console.warn('Share error:', e);
    }
  };

  const images = bill.images || [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Bill Detail</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push(`/edit-bill/${bill.id}`)}
            style={styles.iconBtn}
          >
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Bill Card */}
        <Card style={styles.mainCard}>
          <View style={styles.vendorRow}>
            <View
              style={[
                styles.categoryDotWrap,
                { backgroundColor: `${bill.category_color || colors.accent}20` },
              ]}
            >
              <Ionicons
                name={(bill.category_icon || 'receipt-outline') as any}
                size={24}
                color={bill.category_color || colors.accent}
              />
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/vendor-bills', params: { vendor: bill.vendor } })}
              style={{ flex: 1 }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.vendorText, { color: colors.text }]}>
                  {bill.vendor}
                  {bill.items && bill.items.length === 1 && bill.items[0].name && bill.items[0].name !== bill.vendor
                    ? ` · ${bill.items[0].name}`
                    : ''}
                </Text>
                <Ionicons name="storefront-outline" size={14} color={colors.accent} />
              </View>
              <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                {bill.category_name} · View all from {bill.vendor}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.amountContainer}>
            <Text style={[styles.amountText, { color: colors.text }]}>
              {formatCurrency(bill.total_amount, settings)}
            </Text>
          </View>

          {/* Details Table */}
          <View style={[styles.detailsTable, { borderTopColor: colors.borderLight }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: colors.textMuted }]}>DATE</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatDisplayDate(bill.date, settings.dateFormat)}
              </Text>
            </View>

            {bill.items && bill.items.length === 1 && bill.items[0].name ? (
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>COMMODITY / ITEM</Text>
                <Text style={[styles.detailValue, { color: colors.text, fontWeight: '700' }]}>
                  {bill.items[0].name}
                </Text>
              </View>
            ) : null}

            {bill.account_name ? (
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>PAID FROM</Text>
                <Text style={[styles.detailValue, { color: colors.accent, fontWeight: '700' }]}>
                  {bill.account_name}
                </Text>
              </View>
            ) : null}

            {bill.notes ? (
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>NOTES</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{bill.notes}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* Attached Images Gallery Card */}
        <Card style={styles.imagesCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="camera-outline" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Receipt Photos ({images.length})
              </Text>
            </View>

            {images.length > 0 && (
              <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
                <Ionicons name="share-outline" size={18} color={colors.accent} />
                <Text style={[styles.shareBtnText, { color: colors.accent }]}>Share</Text>
              </TouchableOpacity>
            )}
          </View>

          {images.length === 0 ? (
            <View style={styles.noImagesWrap}>
              <Text style={[styles.noImagesText, { color: colors.textMuted }]}>
                No photos attached to this bill.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryContent}
            >
              {images.map((img, idx) => {
                const uri = resolveImagePath(img.file_path);
                return (
                  <TouchableOpacity
                    key={img.id || idx}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedImageIndex(idx);
                      setIsViewerVisible(true);
                    }}
                    style={styles.galleryItem}
                  >
                    <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                    <View style={styles.tapToZoomBadge}>
                      <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Card>

        {/* Line Items Table if any */}
        {bill.items && bill.items.length > 0 && (
          <Card style={styles.itemsCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="list-outline" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Line Items ({bill.items.length})
              </Text>
            </View>

            {bill.items.map((item, idx) => (
              <View
                key={idx}
                style={[styles.itemRow, { borderBottomColor: colors.borderLight }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                    {item.category_name ? (
                      <View style={[styles.itemCatBadge, { backgroundColor: `${item.category_color || colors.accent}20` }]}>
                        <View style={[styles.itemCatDot, { backgroundColor: item.category_color || colors.accent }]} />
                        <Text style={[styles.itemCatText, { color: colors.text }]}>
                          {item.category_name}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.itemSub, { color: colors.textMuted }]}>
                    Qty: {item.quantity} × {formatCurrency(item.unit_price, settings)}
                  </Text>
                </View>
                <Text style={[styles.itemTotal, { color: colors.text }]}>
                  {formatCurrency(item.line_total, settings)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Full-screen Pinch-to-Zoom Viewer */}
      <ImageViewerModal
        visible={isViewerVisible}
        images={images}
        initialIndex={selectedImageIndex}
        onClose={() => setIsViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  mainCard: {
    padding: 20,
    marginBottom: 16,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  categoryDotWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorText: {
    fontSize: 20,
    fontWeight: '800',
  },
  categoryText: {
    fontSize: 14,
    marginTop: 2,
  },
  amountContainer: {
    marginVertical: 18,
  },
  amountText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detailsTable: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagesCard: {
    padding: 18,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noImagesWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noImagesText: {
    fontSize: 13,
  },
  galleryContent: {
    gap: 12,
  },
  galleryItem: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 14,
  },
  tapToZoomBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 4,
    borderRadius: 6,
  },
  itemsCard: {
    padding: 18,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 4,
  },
  itemCatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemCatText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  notFoundText: {
    fontSize: 16,
  },
  backBtn: {
    padding: 12,
  },
});

