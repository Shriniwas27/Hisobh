import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { EmptyState } from '../components/common/EmptyState';
import { SearchBar } from '../components/ui/SearchBar';
import { CategoryDropdown } from '../components/ui/CategoryDropdown';
import {
  getCategoryTransactions,
  getCategoryDrilldownSummary,
  getCategoryById,
  getCategories,
} from '../db/queries';
import { Bill, Category } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate } from '../utils/dates';

export default function CategoryBillsScreen() {
  const { categoryId, categoryName, categoryColor } = useLocalSearchParams<{
    categoryId: string;
    categoryName?: string;
    categoryColor?: string;
  }>();

  const initialCatId = parseInt(categoryId || '0', 10);
  const [currentCatId, setCurrentCatId] = useState<number>(initialCatId);
  const router = useRouter();
  const { colors } = useTheme();
  const { settings, refreshTrigger } = useApp();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState({ count: 0, total_amount: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadCategoryData = (targetId: number) => {
    if (targetId > 0) {
      const cats = getCategories();
      setAllCategories(cats);

      const cat = getCategoryById(targetId);
      setCategory(cat);

      // Uses the category transactions query matching both single bills and itemized lines
      const list = getCategoryTransactions(targetId);
      setBills(list);

      const summ = getCategoryDrilldownSummary(targetId);
      setSummary(summ);
    }
  };

  useEffect(() => {
    loadCategoryData(currentCatId);
  }, [currentCatId, refreshTrigger]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCategoryData(currentCatId);
    setRefreshing(false);
  };

  // Filter bills by person, vendor, commodity/item, notes, or account
  const filteredBills = useMemo(() => {
    if (!searchQuery.trim()) return bills;
    const q = searchQuery.toLowerCase().trim();
    return bills.filter((b) => {
      const vendorMatch = b.vendor.toLowerCase().includes(q);
      const notesMatch = b.notes ? b.notes.toLowerCase().includes(q) : false;
      const itemsMatch = b.items_summary ? b.items_summary.toLowerCase().includes(q) : false;
      const matchedItemsMatch = b.matched_items_summary ? b.matched_items_summary.toLowerCase().includes(q) : false;
      const accountMatch = b.account_name ? b.account_name.toLowerCase().includes(q) : false;
      return vendorMatch || notesMatch || itemsMatch || matchedItemsMatch || accountMatch;
    });
  }, [bills, searchQuery]);

  const filteredTotal = useMemo(() => {
    return filteredBills.reduce((acc, b) => {
      const amt = b.matched_category_amount || b.total_amount;
      return acc + amt;
    }, 0);
  }, [filteredBills]);

  const displayName = category?.name || categoryName || 'Category';
  const displayColor = category?.color || categoryColor || colors.accent;
  const displayIcon = (category?.icon || 'folder-outline') as any;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={[styles.colorDot, { backgroundColor: displayColor }]} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {displayName}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Category Dropdown Switcher */}
      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <CategoryDropdown
          categories={allCategories}
          selectedCategoryId={currentCatId}
          onSelectCategory={(newId) => {
            if (newId) setCurrentCatId(newId);
          }}
          placeholder="Switch Category"
          compact={true}
        />
      </View>

      {/* Hero Category Summary Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.summaryTopRow}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: `${displayColor}20` },
            ]}
          >
            <Ionicons name={displayIcon} size={28} color={displayColor} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              TOTAL {displayName.toUpperCase()} SPEND
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.text }]}>
              {formatCurrency(summary.total_amount, settings)}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: colors.inputBg }]}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
              {summary.count} {summary.count === 1 ? 'bill' : 'bills'}
            </Text>
          </View>
        </View>

        {summary.count > 0 && (
          <View style={[styles.summaryBottomRow, { borderTopColor: colors.borderLight }]}>
            <Text style={[styles.subStatText, { color: colors.textMuted }]}>
              Average per transaction:{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {formatCurrency(Math.round(summary.total_amount / summary.count), settings)}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {/* Search Bar for Person, Vendor, Commodity, or Notes */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={`Search person, vendor, item in ${displayName}...`}
        />
      </View>

      {/* Section Subheading */}
      <View style={styles.subheadingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subheadingText, { color: colors.textSecondary }]}>
            PREVIOUS TRANSACTIONS ({filteredBills.length}{searchQuery ? ` of ${bills.length}` : ''})
          </Text>
          {searchQuery ? (
            <Text style={[styles.filteredSumText, { color: colors.accent }]}>
              Filtered Total: {formatCurrency(filteredTotal, settings)}
            </Text>
          ) : (
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              Tap any entry to inspect full bill
            </Text>
          )}
        </View>

        {searchQuery ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={[styles.clearFilterBtn, { backgroundColor: colors.inputBg }]}
          >
            <Ionicons name="close-circle-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.clearFilterText, { color: colors.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Complete Previous Transactions List */}
      <FlatList
        data={filteredBills}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => {
          const isItemizedMatch = Boolean(item.matched_items_summary);
          const displayAmount = item.matched_category_amount || item.total_amount;
          const hasImages = (item.image_count ?? 0) > 0;
          const commodityText = item.items_summary || item.matched_items_summary;

          return (
            <TouchableOpacity
              onPress={() => router.push(`/bill/${item.id}`)}
              activeOpacity={0.7}
              style={[
                styles.billItemCard,
                { backgroundColor: colors.card, borderColor: colors.borderLight },
              ]}
            >
              <View style={styles.cardMainRow}>
                {/* Left Icon */}
                <View
                  style={[
                    styles.itemIconCircle,
                    { backgroundColor: `${displayColor}18` },
                  ]}
                >
                  <Ionicons name={displayIcon} size={20} color={displayColor} />
                </View>

                {/* Details */}
                <View style={styles.itemInfo}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/vendor-bills', params: { vendor: item.vendor } });
                    }}
                    style={styles.vendorClickRow}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.vendorText, { color: colors.text }]} numberOfLines={1}>
                      {item.vendor}
                    </Text>
                    <Ionicons name="storefront-outline" size={12} color={colors.accent} />
                  </TouchableOpacity>

                  {/* Commodity / Item name */}
                  {commodityText ? (
                    <Text style={[styles.matchedItemsText, { color: colors.accent }]} numberOfLines={1}>
                      {isItemizedMatch ? `Items: ${commodityText}` : commodityText}
                    </Text>
                  ) : null}

                  <View style={styles.subInfoRow}>
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                      {formatDisplayDate(item.date, settings.dateFormat)}
                    </Text>

                    {/* Paid From Account Pill */}
                    {item.account_name && (
                      <View style={[styles.accountPill, { backgroundColor: colors.inputBg }]}>
                        <Ionicons
                          name={
                            item.account_type === 'cash'
                              ? 'cash-outline'
                              : item.account_type === 'upi'
                              ? 'phone-portrait-outline'
                              : 'business-outline'
                          }
                          size={10}
                          color={item.account_color || colors.textSecondary}
                        />
                        <Text style={[styles.accountPillText, { color: colors.textSecondary }]}>
                          {item.account_name}
                        </Text>
                      </View>
                    )}

                    {hasImages && (
                      <View style={[styles.imageBadge, { backgroundColor: colors.inputBg }]}>
                        <Ionicons name="camera-outline" size={11} color={colors.textSecondary} />
                        <Text style={[styles.imageBadgeText, { color: colors.textSecondary }]}>
                          Photo
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Amount */}
                <View style={styles.itemAmountWrap}>
                  <Text style={[styles.amountText, { color: colors.text }]}>
                    -{formatCurrency(displayAmount, settings)}
                  </Text>

                  {isItemizedMatch && item.total_amount !== displayAmount ? (
                    <Text style={[styles.totalBillSub, { color: colors.textMuted }]}>
                      of {formatCurrency(item.total_amount, settings)} bill
                    </Text>
                  ) : null}
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          bills.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={`No entries for ${displayName}`}
              description="Add a transaction or itemized bill mapped to this category."
              actionLabel="Add Transaction"
              onAction={() => router.push(`/add-bill?categoryId=${currentCatId}`)}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No matching transactions"
              description={`No bills, items, or persons match "${searchQuery}".`}
              actionLabel="Clear Search Filter"
              onAction={() => setSearchQuery('')}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryBottomRow: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  subStatText: {
    fontSize: 12,
  },
  subheadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  subheadingText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  filteredSumText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 11,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  billItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  vendorClickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  vendorText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  matchedItemsText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3,
    gap: 6,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  accountPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
  },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemAmountWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalBillSub: {
    fontSize: 10,
    marginTop: 2,
  },
});
